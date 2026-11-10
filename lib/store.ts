import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";
import type { Db } from "./types";

// Two backends behind the same two functions:
// - Supabase Postgres when DATABASE_URL (or POSTGRES_URL, which the Vercel
//   Supabase integration sets) is present — production.
// - A local JSON file otherwise, for development without a database.
//
// The whole workflow state is one small JSON document (about one issue a week),
// stored in a single row. updateDb locks that row for the length of a change, so
// two people saving at once can't overwrite each other.
//
// The table lives in its own `pack_leader` schema, which Supabase's public Data
// API does not expose, and has row-level security on with no policies, so the
// anon/public keys can never read it. The app connects as the database owner.

const EMPTY: Db = { issues: [], runLog: [], problems: [], problemSeq: 0, imports: [] };
const withDefaults = (data: unknown): Db => ({ ...structuredClone(EMPTY), ...(data as Partial<Db>) });

const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

// ---------- Postgres ----------

const globalForPool = globalThis as unknown as { packLeaderPool?: Pool; packLeaderReady?: Promise<void> };

function pool(): Pool {
  if (!globalForPool.packLeaderPool) {
    // Supabase signs its database certificates with its own root CA. Download it
    // from Supabase (Project Settings → Database → SSL configuration) and store
    // its contents in DATABASE_CA_CERT so the connection is fully verified.
    // sslmode in the URL would override this, so it is removed.
    const url = new URL(databaseUrl());
    const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
    if (ca) url.searchParams.delete("sslmode");
    globalForPool.packLeaderPool = new Pool({
      connectionString: url.toString(),
      ssl: ca ? { ca, rejectUnauthorized: true } : undefined,
      max: 3,
    });
  }
  return globalForPool.packLeaderPool;
}

function ready(): Promise<void> {
  globalForPool.packLeaderReady ??= pool()
    .query(
      `CREATE SCHEMA IF NOT EXISTS pack_leader;
       CREATE TABLE IF NOT EXISTS pack_leader.state (
         id int PRIMARY KEY,
         data jsonb NOT NULL,
         updated_at timestamptz NOT NULL DEFAULT now()
       );
       ALTER TABLE pack_leader.state ENABLE ROW LEVEL SECURITY;
       INSERT INTO pack_leader.state (id, data) VALUES (1, '{"issues":[],"runLog":[]}')
       ON CONFLICT (id) DO NOTHING;`,
    )
    .then(() => undefined)
    .catch((err) => {
      globalForPool.packLeaderReady = undefined; // retry on the next request
      throw err;
    });
  return globalForPool.packLeaderReady;
}

async function readPg(): Promise<Db> {
  await ready();
  const { rows } = await pool().query("SELECT data FROM pack_leader.state WHERE id = 1");
  return withDefaults(rows[0]?.data);
}

async function updatePg<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT data FROM pack_leader.state WHERE id = 1 FOR UPDATE");
    const db = withDefaults(rows[0]?.data);
    const result = await fn(db);
    await client.query("UPDATE pack_leader.state SET data = $1, updated_at = now() WHERE id = 1", [JSON.stringify(db)]);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Local file ----------

const DB_PATH = path.join(process.cwd(), "data", "db.json");
let queue: Promise<unknown> = Promise.resolve();

async function readFile(): Promise<Db> {
  try {
    return withDefaults(JSON.parse(await fs.readFile(DB_PATH, "utf8")));
  } catch {
    return structuredClone(EMPTY);
  }
}

function updateFile<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readFile();
    const result = await fn(db);
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

// ---------- Public ----------

const hasDatabase = () => Boolean(databaseUrl());

export function readDb(): Promise<Db> {
  return hasDatabase() ? readPg() : readFile();
}

export function updateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  return hasDatabase() ? updatePg(fn) : updateFile(fn);
}

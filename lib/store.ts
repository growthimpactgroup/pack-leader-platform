import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Db } from "./types";

// Local JSON file store. This keeps the workflow usable while the database
// choice is paused. Vercel's filesystem is read-only, so production needs a
// real database adapter behind these two functions before going live.
const DB_PATH = path.join(process.cwd(), "data", "db.json");

const EMPTY: Db = { issues: [], runLog: [] };

let queue: Promise<unknown> = Promise.resolve();

export async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return { ...EMPTY, ...JSON.parse(raw) } as Db;
  } catch {
    return structuredClone(EMPTY);
  }
}

// Serialises writes so two quick form posts can't overwrite each other.
export function updateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

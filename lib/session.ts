import { accounts, type Account } from "./accounts";

// Signed sign-in cookie. Kept free of server-only imports so proxy.ts can use it.
//
// The cookie holds the username and an expiry, signed with HMAC-SHA256. The key
// is SESSION_SECRET when set, otherwise it is derived from all the role
// passwords — so rotating any password signs everyone out.

export const SESSION_COOKIE = "pl_session";
export const SESSION_DAYS = 7;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(): Promise<CryptoKey> {
  const secret =
    process.env.SESSION_SECRET ||
    "pack-leader-session:" + accounts().map((a) => `${a.role}:${a.user}:${a.pass}`).join("|");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(account: Account): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: account.user, exp: Date.now() + SESSION_DAYS * 86_400_000 })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function readSession(token: string | undefined): Promise<Account | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig) as BufferSource, enc.encode(payload));
    if (!ok) return null;
    const { u, exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u: string; exp: number };
    if (typeof exp !== "number" || exp < Date.now()) return null;
    return accounts().find((a) => a.user === u) ?? null;
  } catch {
    return null;
  }
}

// Compares every account in full so the time taken doesn't hint at which part was wrong.
export function checkLogin(user: string, pass: string): Account | null {
  let found: Account | null = null;
  for (const a of accounts()) {
    if (same(a.user, user) & same(a.pass, pass)) found = a;
  }
  return found;
}

function same(a: string, b: string): number {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0 ? 1 : 0;
}

// Only allow coming back to a page on this site after signing in.
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !next.startsWith("/login")
    ? next
    : "/";
}

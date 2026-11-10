import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "./session";
import type { Role, User } from "./types";

export async function signedInUser(): Promise<User | null> {
  const account = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return account ? { role: account.role, name: account.name } : null;
}

export async function currentUser(): Promise<User> {
  const user = await signedInUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await currentUser();
  if (!roles.includes(user.role)) {
    throw new Error(`This action needs the ${roles.join(" or ")} role.`);
  }
  return user;
}

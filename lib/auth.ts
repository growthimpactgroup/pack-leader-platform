import "server-only";
import { headers } from "next/headers";
import { matchAccount } from "./accounts";
import type { Role, User } from "./types";

export async function currentUser(): Promise<User> {
  const account = matchAccount((await headers()).get("authorization"));
  if (!account) throw new Error("Not signed in.");
  return { role: account.role, name: account.name };
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await currentUser();
  if (!roles.includes(user.role)) {
    throw new Error(`This action needs the ${roles.join(" or ")} role.`);
  }
  return user;
}

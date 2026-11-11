import type { Role } from "./types";

// Each role signs in with its own username, so an approval can only come from
// the Final Approver's login (manual section 3: one person never both approves
// and sends). The Operator and Reviewer also need a password; Grace (Final
// Approver) signs in with her username only, as Frances asked on 2026-11-11.
// An empty pass means "no password needed". Kept free of server-only imports
// so proxy.ts can use it too.
export type Account = { role: Role; user: string; pass: string; name: string };

export function accounts(): Account[] {
  const env = process.env;
  const list: (Account | null)[] = [
    env.OPERATOR_USER && env.OPERATOR_PASSWORD
      ? { role: "operator", user: env.OPERATOR_USER, pass: env.OPERATOR_PASSWORD, name: env.OPERATOR_NAME || "Operator" }
      : null,
    env.APPROVER_USER
      ? { role: "approver", user: env.APPROVER_USER, pass: "", name: env.APPROVER_NAME || "Grace" }
      : null,
    env.REVIEWER_USER && env.REVIEWER_PASSWORD
      ? { role: "reviewer", user: env.REVIEWER_USER, pass: env.REVIEWER_PASSWORD, name: env.REVIEWER_NAME || "Review Agent" }
      : null,
  ];
  return list.filter((a): a is Account => a !== null);
}

import type { Role } from "./types";

// Each role signs in with its own username and password, so an
// approval can only come from the Final Approver's login (manual section 3:
// one person never both approves and sends). Kept free of server-only imports
// so proxy.ts can use it too.
export type Account = { role: Role; user: string; pass: string; name: string };

export function accounts(): Account[] {
  const env = process.env;
  const list: (Account | null)[] = [
    env.OPERATOR_USER && env.OPERATOR_PASSWORD
      ? { role: "operator", user: env.OPERATOR_USER, pass: env.OPERATOR_PASSWORD, name: env.OPERATOR_NAME || "Operator" }
      : null,
    env.APPROVER_USER && env.APPROVER_PASSWORD
      ? { role: "approver", user: env.APPROVER_USER, pass: env.APPROVER_PASSWORD, name: env.APPROVER_NAME || "Grace" }
      : null,
    env.REVIEWER_USER && env.REVIEWER_PASSWORD
      ? { role: "reviewer", user: env.REVIEWER_USER, pass: env.REVIEWER_PASSWORD, name: env.REVIEWER_NAME || "Review Agent" }
      : null,
  ];
  return list.filter((a): a is Account => a !== null);
}

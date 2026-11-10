import { redirect } from "next/navigation";
import { signedInUser } from "@/lib/auth";
import { safeNext } from "@/lib/session";
import { signIn } from "./actions";

export const metadata = { title: "Sign in — The Pack Leader" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [params, user] = await Promise.all([searchParams, signedInUser()]);
  const next = safeNext(params.next);
  if (user) redirect(next);
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-xl text-white shadow-md">🐾</div>
          <h1 className="text-2xl font-semibold tracking-tight">The Pack Leader</h1>
          <p className="text-sm text-slate-500">Approvals and scheduling · CBI K9</p>
        </div>

        <form action={signIn} className="card space-y-4 shadow-md">
          <input type="hidden" name="next" value={next} />
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}
          {params.signedOut && !error && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">You’re signed out.</div>
          )}
          <label className="block">
            <span className="label">Username</span>
            <input name="username" autoComplete="username" required autoFocus className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input name="password" type="password" autoComplete="current-password" required className="input mt-1" />
          </label>
          <button className="btn-primary w-full">Sign in</button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Use the login for your role: Operator, Approver or Reviewer.</p>
      </div>
    </div>
  );
}

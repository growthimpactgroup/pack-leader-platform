import Link from "next/link";
import { redirect } from "next/navigation";
import { createProblem } from "@/app/problem-actions";
import { ErrorBox } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { ProblemFields } from "../problem-fields";

export default async function NewProblemPage({ searchParams }: PageProps<"/problems/new">) {
  const [user, params] = await Promise.all([currentUser(), searchParams]);
  if (user.role !== "operator") redirect("/problems");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/problems" className="text-sm text-slate-500 hover:text-slate-800">
        ← Problem Bank
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add a problem</h1>
      <ErrorBox message={typeof params.error === "string" ? params.error : undefined} />
      <form action={createProblem} className="card space-y-4">
        <ProblemFields />
        <button className="btn-primary">Add to the bank</button>
      </form>
    </div>
  );
}

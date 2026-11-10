import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/app/confirm-button";
import { createDraftFromProblem, deleteProblem, updateProblem } from "@/app/problem-actions";
import { ErrorBox, Notice, ProblemStatusBadge, StageBadge } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { problemStatus } from "@/lib/problems";
import { formatDate, formatPacific } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import { ProblemFields } from "../problem-fields";

export default async function ProblemPage({ params, searchParams }: PageProps<"/problems/[id]">) {
  const [{ id }, query, user, db] = await Promise.all([params, searchParams, currentUser(), readDb()]);
  const problem = db.problems.find((p) => p.id === id);
  if (!problem) notFound();
  const status = problemStatus(problem, db.issues);
  const operator = user.role === "operator";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/problems" className="text-sm text-slate-500 hover:text-slate-800">
          ← Problem Bank
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-sm font-semibold text-white">{problem.code}</span>
          <h1 className="text-2xl font-semibold tracking-tight">{problem.title}</h1>
          <ProblemStatusBadge label={status.label} stage={status.stage} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {problem.source} · added by {problem.createdBy}, {formatPacific(new Date(problem.createdAt))}
        </p>
      </div>

      <ErrorBox message={typeof query.error === "string" ? query.error : undefined} />
      {query.saved && <Notice>Saved.</Notice>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {operator ? (
          <form action={updateProblem} className="card space-y-4">
            <input type="hidden" name="id" value={problem.id} />
            <ProblemFields problem={problem} />
            <button className="btn-secondary">Save changes</button>
            <p className="text-xs text-slate-500">Changes here don’t alter drafts already made from this problem.</p>
          </form>
        ) : (
          <section className="card space-y-4 text-sm">
            <div>
              <div className="label">Body</div>
              <p className="whitespace-pre-wrap">{problem.body || "—"}</p>
            </div>
            <div>
              <div className="label">References and links</div>
              {problem.references.length === 0 ? (
                "—"
              ) : (
                <ul className="space-y-1">
                  {problem.references.map((r, i) => (
                    <li key={i}>
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                          {r.label}
                        </a>
                      ) : (
                        r.label
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="label">Context and notes</div>
              <p className="whitespace-pre-wrap">{problem.notes || "—"}</p>
            </div>
          </section>
        )}

        <aside className="space-y-5">
          {operator && (
            <section className="card space-y-2">
              <form action={createDraftFromProblem}>
                <input type="hidden" name="id" value={problem.id} />
                <button className="btn-primary w-full">{status.issues.length ? "Create another draft" : "Create draft"}</button>
              </form>
              <p className="text-xs text-slate-500">
                Starts an issue on the next open Wednesday with this title, body and references, linked to {problem.code}.
              </p>
            </section>
          )}

          <section className="card">
            <h2 className="label">Drafts from {problem.code}</h2>
            {status.issues.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Not drafted yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {status.issues.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/issues/${i.id}`} className="font-medium hover:underline">
                      Pack Leader #{i.number}
                    </Link>
                    <StageBadge stage={i.stage} />
                    <span className="w-full text-xs text-slate-500">
                      {i.stage === "SENT" && i.sentAt
                        ? `Sent ${formatPacific(new Date(i.sentAt))}`
                        : i.scheduledFor
                          ? `Scheduled for ${formatPacific(new Date(i.scheduledFor))}`
                          : `Planned for ${formatDate(i.issueDate)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(operator || user.role === "approver") && (
            <form action={deleteProblem} className="card">
              <input type="hidden" name="id" value={problem.id} />
              <ConfirmButton message={`Delete ${problem.code} “${problem.title}” from the Problem Bank? This can't be undone.`} className="btn-danger w-full">
                Delete problem
              </ConfirmButton>
              <p className="mt-2 text-xs text-slate-500">Drafts already made from it keep their text and the {problem.code} label.</p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ConfirmButton } from "@/app/confirm-button";
import { createDraftFromProblem, deleteProblem, uploadProblemsPdf } from "@/app/problem-actions";
import { ErrorBox, Notice, ProblemStatusBadge, STAGE_THEME } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { problemStatus, topicLabel } from "@/lib/problems";
import { STAGES, type Stage } from "@/lib/types";
import { readDb } from "@/lib/store";

export const metadata = { title: "Subject line and content ideas — CBI Newsletter" };

const TAB_LABEL: Record<Stage, string> = {
  DRAFT: "Drafts being written",
  READY_FOR_REVIEW: "Waiting for review",
  CHANGES_REQUESTED: "Needs changes",
  APPROVED: "Approved",
  SENT: "Sent",
  HELD: "On hold",
};

// Same groups and words as the pipeline on the home page, plus ideas not used yet.
const FILTERS: { value: string; label: string; dot?: string }[] = [
  { value: "new", label: "Not used yet" },
  ...STAGES.map((st) => ({ value: st.toLowerCase(), label: TAB_LABEL[st], dot: STAGE_THEME[st].dot })),
  { value: "", label: "All ideas" },
];

export default async function ProblemBankPage({ searchParams }: PageProps<"/problems">) {
  const [user, db, params] = await Promise.all([currentUser(), readDb(), searchParams]);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filter = typeof params.filter === "string" ? params.filter : "";
  const operator = user.role === "operator";

  const all = [...db.problems]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((p) => ({ p, status: problemStatus(p, db.issues) }));
  const shown = all.filter(({ p, status }) => {
    if (q && !`${topicLabel(p.code)} ${p.title} ${p.overlooked ?? ""} ${p.whyNow ?? ""} ${p.stat ?? ""} ${p.body}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "new") return status.stage === null;
    if (filter) return status.stage?.toLowerCase() === filter;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight">Email and broadcast subject lines and content ideas</h1>
          <p className="mt-1 max-w-3xl text-base text-slate-700">
            Ideas for upcoming emails to the CBI K9 mailing list. Each one is a subject line and a short preview of what the email would say. Click a
            subject line to see the full idea, then choose <span className="font-semibold">Create draft</span> to start writing it.
          </p>
        </div>
        {operator && (
          <Link href="/problems/new" className="btn-primary">
            + Add an idea
          </Link>
        )}
      </div>

      <ErrorBox message={typeof params.error === "string" ? params.error : undefined} />
      {params.added && <Notice>Added {String(params.added)} idea{params.added === "1" ? "" : "s"}.</Notice>}
      {params.deleted && <Notice>Idea deleted. Any drafts made from it keep their text.</Notice>}

      {operator && (
        <form action={uploadProblemsPdf} className="card flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="font-semibold">Upload a PDF of ideas</div>
            <p className="text-sm text-slate-500">
              Each numbered idea becomes its own entry. You’ll check and fix the cards before anything is added. Up to 4 MB.
            </p>
          </div>
          <input
            type="file"
            name="pdf"
            accept="application/pdf,.pdf"
            required
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
          <button className="btn-secondary">Upload and split</button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2" action="/problems">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <input name="q" defaultValue={q} placeholder="Search subject lines and ideas" className="input w-64" />
          <button className="btn-secondary">Search</button>
        </form>
        <nav className="flex flex-wrap gap-1 text-sm">
          {FILTERS.map((f) => {
            const href = `/problems?${new URLSearchParams({ ...(q ? { q } : {}), ...(f.value ? { filter: f.value } : {}) })}`;
            return (
              <Link
                key={f.value}
                href={href}
                className={`rounded-full px-3 py-1 ${filter === f.value ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {f.dot && <span className={`h-2 w-2 rounded-full ${f.dot}`} />}
                  {f.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto text-sm text-slate-500">
          {shown.length} of {all.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="card py-10 text-center text-sm text-slate-500">
          {all.length === 0 ? "No ideas yet. Add one or upload a PDF to start." : "No ideas match."}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {shown.map(({ p, status }) => {
            const preview = p.overlooked || p.body || p.stat || "";
            return (
              <li key={p.id} className={`border-l-4 ${status.stage ? STAGE_THEME[status.stage].border : "border-l-transparent"}`}>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <details className="group min-w-0 flex-1">
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        <ProblemStatusBadge label={status.label} stage={status.stage} />
                        <span className="text-sm text-slate-500">{topicLabel(p.code)}</span>
                      </div>
                      <div className="mt-1.5 flex items-start gap-2">
                        <span aria-hidden className="mt-1 text-slate-400 transition group-open:rotate-90">▶</span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-500">Subject line</div>
                          <div className="text-lg font-bold leading-snug text-slate-900 group-hover:underline">{p.title}</div>
                          {preview && <p className="mt-1 line-clamp-2 text-base text-slate-600 group-open:line-clamp-none">{preview}</p>}
                        </div>
                      </div>
                    </summary>
                    <div className="mt-4 space-y-3 pl-6 text-base">
                      {p.whyNow && (
                        <div>
                          <div className="font-semibold text-slate-800">Why they care right now</div>
                          <p className="text-slate-700">{p.whyNow}</p>
                        </div>
                      )}
                      {p.stat && (
                        <div>
                          <div className="font-semibold text-slate-800">The number</div>
                          <p className="font-medium text-slate-900">{p.stat}</p>
                        </div>
                      )}
                      {p.references.length > 0 && (
                        <div>
                          <div className="font-semibold text-slate-800">Source</div>
                          <ul className="space-y-0.5">
                            {p.references.map((r, k) => (
                              <li key={k}>
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
                        </div>
                      )}
                      {p.notes && (
                        <div>
                          <div className="font-semibold text-slate-800">Notes for whoever writes it</div>
                          <p className="text-slate-600">{p.notes}</p>
                        </div>
                      )}
                      {status.issues.length > 0 && (
                        <p className="text-sm text-slate-500">Used in: {status.issues.map((i) => `email #${i.number}`).join(", ")}</p>
                      )}
                      {(operator || user.role === "approver") && (
                        <form action={deleteProblem}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmButton message={`Delete “${p.title}”? This can't be undone.`} className="btn-danger">
                            Delete this idea
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </details>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    {operator && (
                      <form action={createDraftFromProblem}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-primary w-full">{status.issues.length ? "Create another draft" : "Create draft"}</button>
                      </form>
                    )}
                    <Link href={`/problems/${p.id}`} className="btn-secondary">
                      {operator ? "Open and edit" : "Open"}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

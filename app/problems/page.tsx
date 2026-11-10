import Link from "next/link";
import { ConfirmButton } from "@/app/confirm-button";
import { createDraftFromProblem, deleteProblem, uploadProblemsPdf } from "@/app/problem-actions";
import { ErrorBox, Notice, ProblemStatusBadge } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { problemStatus } from "@/lib/problems";
import { readDb } from "@/lib/store";

const FILTERS = [
  { value: "", label: "All" },
  { value: "new", label: "Not drafted" },
  { value: "active", label: "In progress" },
  { value: "sent", label: "Sent" },
];

export default async function ProblemBankPage({ searchParams }: PageProps<"/problems">) {
  const [user, db, params] = await Promise.all([currentUser(), readDb(), searchParams]);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filter = typeof params.filter === "string" ? params.filter : "";
  const operator = user.role === "operator";

  const all = [...db.problems]
    .sort((a, b) => b.code.localeCompare(a.code))
    .map((p) => ({ p, status: problemStatus(p, db.issues) }));
  const shown = all.filter(({ p, status }) => {
    if (q && !`${p.code} ${p.title} ${p.body}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "new") return status.stage === null;
    if (filter === "sent") return status.stage === "SENT";
    if (filter === "active") return status.stage !== null && status.stage !== "SENT";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Problem Bank</h1>
          <p className="text-sm text-slate-500">
            The starting point for every issue. Each problem has its own ID and shows where its drafts are in the pipeline.
          </p>
        </div>
        {operator && (
          <Link href="/problems/new" className="btn-primary">
            Add problem
          </Link>
        )}
      </div>

      <ErrorBox message={typeof params.error === "string" ? params.error : undefined} />
      {params.added && <Notice>Added {String(params.added)} problem{params.added === "1" ? "" : "s"} to the bank.</Notice>}
      {params.deleted && <Notice>Problem deleted. Any drafts made from it keep their text.</Notice>}

      {operator && (
        <form action={uploadProblemsPdf} className="card flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="font-medium">Upload a PDF of problems</div>
            <p className="text-sm text-slate-500">
              Each numbered problem becomes its own card. You’ll check and fix the cards before anything is added. Up to 4 MB.
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
          <input name="q" defaultValue={q} placeholder="Search problems" className="input w-64" />
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
                {f.label}
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
          {all.length === 0 ? "The bank is empty. Add a problem or upload a PDF to start." : "No problems match."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ p, status }) => (
            <article key={p.id} className="card flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-500">{p.code}</span>
                <ProblemStatusBadge label={status.label} stage={status.stage} />
              </div>
              <Link href={`/problems/${p.id}`} className="font-semibold leading-snug hover:underline">
                {p.title}
              </Link>
              {p.body && <p className="line-clamp-3 text-sm text-slate-600">{p.body}</p>}
              <div className="mt-auto flex flex-wrap gap-x-3 text-xs text-slate-500">
                <span>
                  {p.references.length} reference{p.references.length === 1 ? "" : "s"}
                </span>
                {status.issues.length > 0 && <span>Drafts: {status.issues.map((i) => `#${i.number}`).join(", ")}</span>}
                <span className="truncate">{p.source}</span>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {operator && (
                  <form action={createDraftFromProblem}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-primary">{status.issues.length ? "Create another draft" : "Create draft"}</button>
                  </form>
                )}
                <Link href={`/problems/${p.id}`} className="btn-secondary">
                  Open
                </Link>
                {(operator || user.role === "approver") && (
                  <form action={deleteProblem} className="ml-auto">
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton message={`Delete ${p.code} “${p.title}” from the Problem Bank? This can't be undone.`} className="btn-danger">
                      Delete
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

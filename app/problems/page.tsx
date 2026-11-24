import Link from "next/link";
import { ConfirmButton } from "@/app/confirm-button";
import { createDraftFromProblem, deleteProblem, fillSuggestedPhrases, uploadProblemsPdf } from "@/app/problem-actions";
import { ErrorBox, Notice, ProblemStatusBadge, STAGE_THEME } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { problemStatus, splitPhrases, suggestedPhrasesFor, topicLabel } from "@/lib/problems";
import { rankIdeas } from "@/lib/rank";
import { pacificToday } from "@/lib/schedule";
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
  // Rank every idea (the list keeps its order; the rank shows beside each one).
  const ranks = rankIdeas(all.map(({ p, status }) => ({ p, stage: status.stage })), Number(pacificToday().slice(5, 7)), db.issues);
  const canFill = user.role === "operator" && db.problems.some((p) => !p.searchPhrases?.trim() && suggestedPhrasesFor(p.title));
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
      {params.phrases && <Notice>Filled in search phrases for {String(params.phrases)} idea{params.phrases === "1" ? "" : "s"}.</Notice>}
      {canFill && (
        <form action={fillSuggestedPhrases} className="card flex flex-col gap-3 border-indigo-200 bg-indigo-50 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-lg font-bold text-indigo-950">Search phrases are ready for the starter ideas</div>
            <p className="text-sm text-indigo-900">
              Each idea can have 2–3 things people search for. They help rank ideas by what’s trending. This only fills ideas that don’t have any yet,
              and you can edit them on each idea.
            </p>
          </div>
          <button className="btn-primary">Fill in suggested search phrases</button>
        </form>
      )}

      {operator && (
        <form action={uploadProblemsPdf} className="card flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-lg font-bold">Load a PDF of ideas for possible broadcasts</div>
            <p className="text-sm text-slate-600">
              This is where you load PDFs of ideas for possible emails and broadcasts. Each numbered idea becomes its own entry, and you check them
              before anything is added. Up to 4 MB.
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
            const rank = ranks.get(p.id);
            return (
              <li key={p.id} className={`border-l-4 ${status.stage ? STAGE_THEME[status.stage].border : "border-l-transparent"}`}>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <details className="group min-w-0 flex-1">
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        {rank && (
                          <span
                            title={`Score ${rank.score}/100`}
                            className={`rounded-full px-3 py-1 text-sm font-bold ${rank.rank <= 3 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 ring-1 ring-slate-300"}`}
                          >
                            Rank #{rank.rank}
                          </span>
                        )}
                        <ProblemStatusBadge label={status.label} stage={status.stage} />
                        <span className="text-sm text-slate-500">{topicLabel(p.code)}</span>
                      </div>
                      <div className="mt-3 flex items-start gap-3">
                        <span aria-hidden className="mt-1.5 text-lg text-indigo-500 transition group-open:rotate-90">▶</span>
                        {/* Framed like an email in an inbox. */}
                        <div className="min-w-0 max-w-[62ch] rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                          <div className="text-xl leading-snug">
                            <span className="font-bold text-slate-500">Subject:</span>{" "}
                            <span className="font-bold text-slate-900 group-hover:underline">{p.title}</span>
                          </div>
                          {preview && <p className="mt-1.5 line-clamp-2 text-base leading-relaxed text-slate-600 group-open:hidden">{preview}</p>}
                        </div>
                      </div>
                    </summary>
                    {/* Short lines and short paragraphs, the way sales emails are laid out. */}
                    <div className="mt-5 max-w-[62ch] space-y-6 pl-8 text-lg leading-relaxed">
                      {p.overlooked && <CopyBlock title="What owners miss" text={p.overlooked} />}
                      {p.whyNow && <CopyBlock title="Why they care right now" text={p.whyNow} />}
                      {p.stat && <CopyBlock title="The number" text={p.stat} strong />}
                      {!p.overlooked && !p.whyNow && p.body && <CopyBlock title="The idea" text={p.body} />}
                      {splitPhrases(p.searchPhrases).length > 0 && (
                        <div>
                          <div className="text-sm font-bold uppercase tracking-wide text-slate-500">Search phrases</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {splitPhrases(p.searchPhrases).map((ph) => (
                              <span key={ph} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 ring-1 ring-slate-300">
                                {ph}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {p.references.length > 0 && (
                        <div>
                          <div className="text-sm font-bold uppercase tracking-wide text-slate-500">Source</div>
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
                          <div className="text-sm font-bold uppercase tracking-wide text-slate-500">Notes for whoever writes it</div>
                          <p className="text-slate-600">{p.notes}</p>
                        </div>
                      )}
                      {rank && (
                        <div className="rounded-lg bg-indigo-50 p-4 text-base ring-1 ring-indigo-100">
                          <div className="font-bold text-indigo-900">
                            Why it ranks #{rank.rank} <span className="font-normal text-indigo-700">({rank.score}/100)</span>
                          </div>
                          <ul className="mt-1 list-disc pl-5 text-indigo-900">
                            {rank.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
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

// Breaks text into one- or two-sentence paragraphs with room to breathe.
function CopyBlock({ title, text, strong }: { title: string; text: string; strong?: boolean }) {
  const sentences = text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [text];
  const paras: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) paras.push(sentences.slice(i, i + 2).join("").trim());
  return (
    <div>
      <div className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 space-y-3">
        {paras.map((t, i) => (
          <p key={i} className={strong ? "font-semibold text-slate-900" : "text-slate-800"}>
            {t}
          </p>
        ))}
      </div>
    </div>
  );
}

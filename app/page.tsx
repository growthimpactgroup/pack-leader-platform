import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { formatDate, nextWednesday, timingAlert } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import { STAGES, STAGE_LABEL, type Issue } from "@/lib/types";
import { AlertBox, STAGE_THEME, StageBadge } from "./ui";

// What each role should look at first.
const YOUR_TURN = {
  operator: ["DRAFT", "CHANGES_REQUESTED", "APPROVED"],
  reviewer: ["READY_FOR_REVIEW"],
  approver: ["READY_FOR_REVIEW"],
} as const;

export default async function PipelinePage({ searchParams }: PageProps<"/">) {
  const [user, db, params] = await Promise.all([currentUser(), readDb(), searchParams]);
  const issues = [...db.issues].sort((a, b) => b.number - a.number);
  const active = STAGES.find((s) => s.toLowerCase() === params.stage) ?? null;
  const shown = active ? issues.filter((i) => i.stage === active) : issues;
  const thisWeekDate = nextWednesday();
  const thisWeek = issues.find((i) => i.issueDate === thisWeekDate);
  const yourTurn = issues.filter((i) => (YOUR_TURN[user.role] as readonly string[]).includes(i.stage) && !(user.role === "reviewer" && i.scorecard));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-slate-500">Every issue, by stage. Nothing schedules until Grace approves in writing.</p>
        </div>
        {user.role === "operator" && (
          <Link href="/issues/new" className="btn-primary">
            New issue
          </Link>
        )}
      </div>

      <section className={`card ${thisWeek ? `border-l-4 ${STAGE_THEME[thisWeek.stage].border}` : ""}`}>
        <h2 className="label">This week · {formatDate(thisWeekDate)}</h2>
        {thisWeek ? (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/issues/${thisWeek.id}`} className="text-lg font-medium hover:underline">
                #{thisWeek.number} · {thisWeek.subject || "Untitled"}
              </Link>
              <StageBadge stage={thisWeek.stage} />
            </div>
            {timingAlert(thisWeek) && <AlertBox alert={timingAlert(thisWeek)!} />}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            No issue planned for this Wednesday yet.
            {user.role === "operator" && (
              <>
                {" "}
                <Link href="/issues/new" className="font-medium text-indigo-600 hover:underline">
                  Start it now
                </Link>
                .
              </>
            )}
          </p>
        )}
      </section>

      {yourTurn.length > 0 && (
        <section className="card">
          <h2 className="label">Waiting on you</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {yourTurn.map((i) => (
              <li key={i.id} className={`flex flex-wrap items-center gap-3 border-l-4 py-2 pl-3 text-sm ${STAGE_THEME[i.stage].border}`}>
                <Link href={`/issues/${i.id}`} className="font-medium hover:underline">
                  #{i.number} · {i.subject || "Untitled"}
                </Link>
                <StageBadge stage={i.stage} />
                <span className="text-slate-500">{formatDate(i.issueDate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-0">
        {/* Tabs are links (?stage=…), so a tab can be bookmarked or shared. */}
        <nav aria-label="Issues by stage" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3">
          <Tab href="/" active={!active} label="All" count={issues.length} activeClass="border-indigo-600 bg-indigo-50 text-indigo-800" />
          {STAGES.map((stage) => (
            <Tab
              key={stage}
              href={`/?stage=${stage.toLowerCase()}`}
              active={active === stage}
              label={STAGE_LABEL[stage]}
              count={issues.filter((i) => i.stage === stage).length}
              dot={STAGE_THEME[stage].dot}
              activeClass={STAGE_THEME[stage].tab}
            />
          ))}
        </nav>

        <div className="p-4">
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{active ? `No issues in ${STAGE_LABEL[active]}.` : "No issues yet."}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((i) => (
                <IssueCard key={i.id} issue={i} showStage={!active} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Tab({ href, active, label, count, dot, activeClass }: { href: string; active: boolean; label: string; count: number; dot?: string; activeClass: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
        active ? activeClass : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      {dot && <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />}
      {label}
      <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/80" : "bg-slate-100"}`}>{count}</span>
    </Link>
  );
}

function IssueCard({ issue, showStage }: { issue: Issue; showStage: boolean }) {
  return (
    <Link
      href={`/issues/${issue.id}`}
      className={`block rounded-lg border border-l-4 border-slate-200 bg-white p-3 text-sm shadow-sm hover:shadow-md ${STAGE_THEME[issue.stage].border}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">#{issue.number}</span>
        {showStage && <StageBadge stage={issue.stage} />}
      </div>
      <div className="mt-1 truncate text-slate-700">{issue.subject || "Untitled"}</div>
      <div className="mt-1 text-xs text-slate-500">{formatDate(issue.issueDate)}</div>
    </Link>
  );
}

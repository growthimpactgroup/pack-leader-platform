import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { formatDate, nextWednesday, timingAlert } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import { STAGES, STAGE_LABEL, type Issue } from "@/lib/types";
import { AlertBox, STAGE_THEME, StageBadge, StageLegend } from "./ui";

// What each role should look at first.
const YOUR_TURN = {
  operator: ["DRAFT", "CHANGES_REQUESTED", "APPROVED"],
  reviewer: ["READY_FOR_REVIEW"],
  approver: ["READY_FOR_REVIEW"],
} as const;

export default async function PipelinePage() {
  const [user, db] = await Promise.all([currentUser(), readDb()]);
  const issues = [...db.issues].sort((a, b) => b.number - a.number);
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

      <StageLegend />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage) => {
          const list = issues.filter((i) => i.stage === stage);
          const t = STAGE_THEME[stage];
          return (
            <div key={stage} className={`rounded-xl border p-3 ${t.column}`}>
              <h3 className={`mb-2 flex items-center justify-between text-sm font-semibold ${t.heading}`}>
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />
                  {STAGE_LABEL[stage]}
                </span>
                <span className="rounded-full bg-white/80 px-2 text-xs font-medium">{list.length}</span>
              </h3>
              <div className="space-y-2">
                {list.length === 0 && <p className="px-1 text-xs text-slate-400">None</p>}
                {list.map((i) => (
                  <IssueCard key={i.id} issue={i} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <Link
      href={`/issues/${issue.id}`}
      className={`block rounded-lg border border-l-4 border-slate-200 bg-white p-3 text-sm shadow-sm hover:shadow-md ${STAGE_THEME[issue.stage].border}`}
    >
      <div className="font-medium">#{issue.number}</div>
      <div className="truncate text-slate-700">{issue.subject || "Untitled"}</div>
      <div className="mt-1 text-xs text-slate-500">{formatDate(issue.issueDate)}</div>
    </Link>
  );
}

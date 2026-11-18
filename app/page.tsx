import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { accounts } from "@/lib/accounts";
import { deadlines, formatDate, formatPacific, nextWednesday, pacificToday, timingAlert } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import { STAGES, STAGE_LABEL, type Issue, type Role, type User } from "@/lib/types";
import { AlertBox, STAGE_THEME, StageBadge } from "./ui";

// What's waiting on each person, and what they need to do about it.
function todoFor(role: Role, issues: Issue[], now = Date.now()): { issue: Issue; action: string }[] {
  return issues.flatMap((i) => {
    if (role === "operator") {
      if (i.stage === "DRAFT") return [{ issue: i, action: "Finish writing it and submit it for review." }];
      if (i.stage === "CHANGES_REQUESTED") return [{ issue: i, action: "Make Grace’s changes and resubmit." }];
      if (i.stage === "APPROVED" && !i.scheduledFor) return [{ issue: i, action: "Approved. Schedule the send." }];
      if (i.stage === "APPROVED" && new Date(i.scheduledFor!).getTime() < now) return [{ issue: i, action: "Its send time has passed. Mark it as sent." }];
      return [];
    }
    // The review team: the Review Agent scores it, then Grace approves it.
    if (i.stage !== "READY_FOR_REVIEW") return [];
    return [
      {
        issue: i,
        action: i.scorecard
          ? "Grace: read it, then approve it or ask for changes."
          : "Review Agent: post the scorecard. Grace: read it, then approve it or ask for changes.",
      },
    ];
  });
}

export const metadata = { title: "CBI Newsletter System" };

// Section headings: twice the body text size.
const SECTION = "text-[2rem] leading-tight font-bold tracking-tight";

// Where an email stands, in plain words.
function statusLine(i: Issue): string {
  switch (i.stage) {
    case "DRAFT":
      return "Being written, not sent for approval yet";
    case "READY_FOR_REVIEW":
      return i.scorecard ? "Reviewed, waiting for Grace’s approval" : "Waiting for review and approval";
    case "CHANGES_REQUESTED":
      return "Sent back for changes";
    case "APPROVED":
      return i.scheduledFor ? `Approved, scheduled for ${formatPacific(new Date(i.scheduledFor))}` : "Approved, needs to be scheduled";
    case "SENT":
      return "Sent";
    case "HELD":
      return "On hold, won’t send";
  }
}

export default async function PipelinePage({ searchParams }: PageProps<"/">) {
  const [user, db, params] = await Promise.all([currentUser(), readDb(), searchParams]);
  const issues = [...db.issues].sort((a, b) => b.number - a.number);
  const active = STAGES.find((s) => s.toLowerCase() === params.stage) ?? null;
  const shown = active ? issues.filter((i) => i.stage === active) : issues;
  // The soonest email that hasn't gone out yet.
  const today = pacificToday();
  const upcoming = [...issues]
    .filter((i) => i.issueDate >= today && i.stage !== "SENT" && i.stage !== "HELD")
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate))[0];
  const nextDate = nextWednesday();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">CBI Newsletter System</h1>
          <p className="mt-1 max-w-2xl text-base text-slate-700">
            Where The Pack Leader, CBI K9’s weekly Wednesday email, gets written, reviewed, approved by Grace and scheduled to send.
          </p>
        </div>
        {user.role === "operator" && (
          <Link href="/issues/new" className="btn-primary">
            + Start a new email
          </Link>
        )}
      </div>

      <section className={`card ${upcoming ? `border-l-8 ${STAGE_THEME[upcoming.stage].border}` : ""}`}>
        <h2 className={SECTION}>Upcoming</h2>
        {upcoming ? (
          <div className="mt-3 space-y-3">
            <p className="text-base font-semibold text-slate-700">
              {upcoming.stage === "APPROVED" ? "Next email to go out" : "Next email to be approved"} · goes out {formatDate(upcoming.issueDate)}
            </p>
            <div>
              <div className="text-sm font-semibold text-slate-500">Subject line</div>
              <Link href={`/issues/${upcoming.id}`} className="text-2xl font-bold leading-snug hover:underline">
                {upcoming.subject || "No subject line yet"}
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StageBadge stage={upcoming.stage} />
              <span className="text-base font-semibold text-slate-800">{statusLine(upcoming)}</span>
            </div>
            {timingAlert(upcoming) && <AlertBox alert={timingAlert(upcoming)!} />}
          </div>
        ) : (
          <p className="mt-2 text-base text-slate-600">
            Nothing is planned yet. The next send is Wednesday, {formatDate(nextDate)}.
            {user.role === "operator" && (
              <>
                {" "}
                <Link href="/problems" className="font-semibold text-indigo-600 hover:underline">
                  Pick a topic idea
                </Link>{" "}
                to start it.
              </>
            )}
          </p>
        )}
      </section>

      <TodoLists user={user} issues={issues} tab={typeof params.todo === "string" ? params.todo : undefined} stage={typeof params.stage === "string" ? params.stage : undefined} />

      <section className="card p-0">
        <div className="px-5 pt-5">
          <h2 className={SECTION}>Newsletters and broadcasts in the pipeline</h2>
          <p className="mt-1 text-base text-slate-600">
            Every email from first draft to sent. Pick a status to see only the emails at that step.
          </p>
        </div>
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
            <p className="py-8 text-center text-sm text-slate-500">{active ? `No emails are “${STAGE_LABEL[active].toLowerCase()}” right now.` : "No emails yet."}</p>
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
      className={`block rounded-lg border border-l-4 border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:shadow-md ${STAGE_THEME[issue.stage].border}`}
    >
      {showStage && <StageBadge stage={issue.stage} />}
      <div className="mt-2 text-xs font-semibold text-slate-500">Subject line</div>
      <div className="line-clamp-2 text-base font-bold text-slate-900">{issue.subject || "No subject line yet"}</div>
      <div className="mt-2 text-sm text-slate-600">{statusLine(issue)}</div>
      <div className="mt-1 text-xs text-slate-500">Goes out {formatDate(issue.issueDate)} · email #{issue.number}</div>
    </Link>
  );
}

// Two tabs: the Operator's to-do and Grace's, so each can see what the other is
// waiting on and follow up. Tabs are links (?todo=…) so they work without scripts.
function TodoLists({ user, issues, tab, stage }: { user: User; issues: Issue[]; tab?: string; stage?: string }) {
  const name = (role: Role, fallback: string) => accounts().find((a) => a.role === role)?.name || fallback;
  // Two lists: the Operator's, and the review team's (Review Agent + Grace).
  const people: { role: Role; label: string; tabLabel: string }[] = [
    { role: "operator", label: name("operator", "Frances"), tabLabel: `${name("operator", "Frances")}’s action items` },
    { role: "approver", label: "the review team", tabLabel: `Review team’s action items (${name("approver", "Grace")} and Review Agent)` },
  ];
  const mine = user.role === "operator" ? people[0] : people[1];
  const current = people.find((p) => p.role === tab) ?? mine;
  const items = todoFor(current.role, issues);
  const isMine = current === mine;

  return (
    <section className="card p-0">
      <div className="px-5 pt-4">
        <h2 className={SECTION}>Action items</h2>
        <p className="mt-1 text-base text-slate-600">
          What has to happen next for each email, and who has to do it. Use the review team’s tab to see what you’re waiting on and what to follow up on.
        </p>
      </div>
      <nav aria-label="To-do lists" className="mt-3 flex gap-1 border-b border-slate-200 px-3">
        {people.map((p) => {
          const active = p.role === current.role;
          const count = todoFor(p.role, issues).length;
          const q = new URLSearchParams({ ...(p.role === mine.role ? {} : { todo: p.role }), ...(stage ? { stage } : {}) }).toString();
          const href = q ? `/?${q}` : "/";
          const label = p === mine ? `${p.tabLabel} · you` : p.tabLabel;
          return (
            <Link
              key={p.role}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-semibold ${
                active ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {label}
              <span className={`rounded-full px-2 text-xs ${count ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="py-6 text-center text-base text-slate-500">
            {isMine ? "Nothing waiting on you right now." : `Nothing waiting on ${current.label} right now.`}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map(({ issue: i, action }) => {
              const alert = timingAlert(i);
              const overdue = alert?.tone === "danger";
              const d = deadlines(i.issueDate);
              const due = current.role === "operator" && i.stage !== "APPROVED" ? d.submitBy : current.role !== "operator" ? d.approveBy : null;
              return (
                <li key={i.id} className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 ${STAGE_THEME[i.stage].border}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <StageBadge stage={i.stage} />
                    {overdue && <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">Overdue</span>}
                    <span className="text-sm text-slate-500">Goes out {formatDate(i.issueDate)}</span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-500">Subject line</div>
                  <Link href={`/issues/${i.id}`} className="block text-lg font-bold leading-snug hover:underline">
                    {i.subject || "No subject line yet"}
                  </Link>
                  <p className={`mt-1 text-sm font-semibold ${overdue ? "text-rose-800" : "text-slate-800"}`}>{action}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {i.stage === "READY_FOR_REVIEW" && i.submittedAt ? `Waiting since ${formatPacific(new Date(i.submittedAt))}` : null}
                    {i.stage === "READY_FOR_REVIEW" && i.submittedAt && due ? " · " : null}
                    {due ? `${current.role === "operator" ? "Due" : "Approve by"} ${formatPacific(due)}` : null}
                    {i.stage === "READY_FOR_REVIEW" && i.scorecard ? ` · Reviewer: ${i.scorecard.verdict} (${i.scorecard.valueScore}/10)` : null}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

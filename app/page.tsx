import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { accounts } from "@/lib/accounts";
import { deadlines, formatDate, formatPacific, nextWednesday, timingAlert } from "@/lib/schedule";
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
    if (i.stage !== "READY_FOR_REVIEW") return [];
    if (role === "reviewer") return i.scorecard ? [] : [{ issue: i, action: "Post the review scorecard." }];
    return [{ issue: i, action: "Read it, then approve it or ask for changes." }];
  });
}

export const metadata = { title: "CBI Newsletter" };

export default async function PipelinePage({ searchParams }: PageProps<"/">) {
  const [user, db, params] = await Promise.all([currentUser(), readDb(), searchParams]);
  const issues = [...db.issues].sort((a, b) => b.number - a.number);
  const active = STAGES.find((s) => s.toLowerCase() === params.stage) ?? null;
  const shown = active ? issues.filter((i) => i.stage === active) : issues;
  const thisWeekDate = nextWednesday();
  const thisWeek = issues.find((i) => i.issueDate === thisWeekDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CBI Newsletter</h1>
          <p className="text-sm text-slate-600">
            The Pack Leader, our weekly Wednesday email. Write it, get Grace’s approval, then schedule it.
          </p>
        </div>
        {user.role === "operator" && (
          <Link href="/issues/new" className="btn-primary">
            + Start a new email
          </Link>
        )}
      </div>

      <section className={`card ${thisWeek ? `border-l-4 ${STAGE_THEME[thisWeek.stage].border}` : ""}`}>
        <h2 className="text-lg font-semibold">This Wednesday’s email <span className="font-normal text-slate-500">· {formatDate(thisWeekDate)}</span></h2>
        {thisWeek ? (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/issues/${thisWeek.id}`} className="text-lg font-medium hover:underline">
                #{thisWeek.number} · {thisWeek.subject || "No subject yet"}
              </Link>
              <StageBadge stage={thisWeek.stage} />
            </div>
            {timingAlert(thisWeek) && <AlertBox alert={timingAlert(thisWeek)!} />}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Nothing written for this Wednesday yet.
            {user.role === "operator" && (
              <>
                {" "}
                <Link href="/issues/new" className="font-medium text-indigo-600 hover:underline">
                  Start writing it
                </Link>
                .
              </>
            )}
          </p>
        )}
      </section>

      <TodoLists user={user} issues={issues} tab={typeof params.todo === "string" ? params.todo : undefined} stage={typeof params.stage === "string" ? params.stage : undefined} />

      <section className="card p-0">
        <h2 className="px-5 pt-4 text-lg font-semibold">All emails</h2>
        {/* Tabs are links (?stage=…), so a tab can be bookmarked or shared. */}
        <nav aria-label="Issues by stage" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3">
          <Tab href="/" active={!active} label="Everything" count={issues.length} activeClass="border-indigo-600 bg-indigo-50 text-indigo-800" />
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
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Email #{issue.number}</span>
        {showStage && <StageBadge stage={issue.stage} />}
      </div>
      <div className="mt-1.5 line-clamp-2 text-slate-700">{issue.subject || "No subject yet"}</div>
      <div className="mt-2 text-xs text-slate-500">Goes out {formatDate(issue.issueDate)}</div>
    </Link>
  );
}

// Two tabs: the Operator's to-do and Grace's, so each can see what the other is
// waiting on and follow up. Tabs are links (?todo=…) so they work without scripts.
function TodoLists({ user, issues, tab, stage }: { user: User; issues: Issue[]; tab?: string; stage?: string }) {
  const name = (role: Role, fallback: string) => accounts().find((a) => a.role === role)?.name || fallback;
  const people: { role: Role; label: string }[] = [
    { role: "operator", label: name("operator", "Frances") },
    { role: "approver", label: name("approver", "Grace") },
  ];
  if (user.role === "reviewer") people.push({ role: "reviewer", label: "Reviewer" });
  const mine = people.find((p) => p.role === user.role)!;
  const current = people.find((p) => p.role === tab) ?? mine;
  const items = todoFor(current.role, issues);
  const isMine = current.role === user.role;

  return (
    <section className="card p-0">
      <div className="px-5 pt-4">
        <h2 className="text-lg font-bold">To-do lists</h2>
        <p className="text-sm text-slate-600">What each person needs to do next. Check the other tab to see what to follow up on.</p>
      </div>
      <nav aria-label="To-do lists" className="mt-3 flex gap-1 border-b border-slate-200 px-3">
        {people.map((p) => {
          const active = p.role === current.role;
          const count = todoFor(p.role, issues).length;
          const q = new URLSearchParams({ ...(p.role === mine.role ? {} : { todo: p.role }), ...(stage ? { stage } : {}) }).toString();
          const href = q ? `/?${q}` : "/";
          return (
            <Link
              key={p.role}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-semibold ${
                active ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {p.role === user.role ? `My to-do (${p.label})` : `${p.label}’s to-do`}
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
                    <span className="text-sm text-slate-500">Email #{i.number} · goes out {formatDate(i.issueDate)}</span>
                  </div>
                  <Link href={`/issues/${i.id}`} className="mt-1.5 block text-base font-bold hover:underline">
                    {i.subject || "No subject yet"}
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

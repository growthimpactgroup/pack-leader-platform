import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { addDays, deadlines, formatDate, formatPacific, pacificToday, timingAlert, upcomingWednesdays, type Alert } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import type { Issue, Problem } from "@/lib/types";
import { STAGE_THEME, StageBadge } from "../ui";

export const metadata = { title: "Send schedule — CBI Newsletter" };

// Short day + time, e.g. "Tue 3:00 pm".
function dayTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" }).format(date).replace(" AM", " am").replace(" PM", " pm");
}

function timeOnly(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date).replace(" AM", " am").replace(" PM", " pm");
}

// One or two sentences that say what the email is about: the topic's framing if
// it came from Topic ideas, otherwise the start of the email text.
function describe(issue: Issue, problems: Problem[]): string {
  const topic = issue.problemId ? problems.find((p) => p.id === issue.problemId) : undefined;
  const source =
    topic?.overlooked ||
    issue.body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("[") && !/^(the number|this is one of the problems|- the cbi|p\.s\.)/i.test(l) && l !== topic?.title && !issue.subject.endsWith(l))
      .join(" ");
  if (!source) return "";
  const sentences = source.match(/[^.!?]+[.!?]+/g) ?? [source];
  let out = "";
  for (const s of sentences.slice(0, 2)) {
    if ((out + s).length > 240 && out) break;
    out += s;
  }
  return out.trim().length > 260 ? `${out.trim().slice(0, 257)}…` : out.trim();
}

function whenLabel(i: number) {
  if (i === 0) return "Next up";
  if (i === 1) return "The week after";
  return `In ${i} weeks`;
}

const URGENCY: Record<Alert["tone"], { label: string; className: string } | null> = {
  danger: { label: "Urgent", className: "bg-rose-600 text-white" },
  warn: { label: "Needs action", className: "bg-amber-500 text-white" },
  info: null,
  ok: { label: "On track", className: "bg-emerald-600 text-white" },
};

const ALERT_TEXT: Record<Alert["tone"], string> = {
  danger: "text-rose-800",
  warn: "text-amber-900",
  info: "text-slate-700",
  ok: "text-emerald-800",
};

export default async function SchedulePage() {
  const [user, db] = await Promise.all([currentUser(), readDb()]);
  const weeks = upcomingWednesdays(8);
  const lastWeekStart = addDays(pacificToday(), -28);
  const recent = db.issues
    .filter((i) => i.issueDate < weeks[0] && i.issueDate >= lastWeekStart)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const example = deadlines(weeks[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send schedule</h1>
        <p className="mt-1 max-w-3xl text-base text-slate-700">
          The Pack Leader goes out automatically every Wednesday. Each week below shows the email planned for that day, what it’s about, and what
          still has to happen before it can send. The week coming up is highlighted in its status color.
        </p>
      </div>

      {/* How every week runs, with Frances's Philippine time alongside Pacific. */}
      <section className="card">
        <h2 className="text-lg font-bold">How every week runs</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { step: "1", title: "Draft is due", at: example.submitBy, who: "Frances submits the finished email for review." },
            { step: "2", title: "Grace approves", at: example.approveBy, who: "Grace reads it and approves in writing, or asks for changes." },
            { step: "3", title: "It sends automatically", at: example.sendAt, who: "The approved email goes out to the list on its own." },
          ].map((s) => (
            <li key={s.step} className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{s.step}</span>
                <span className="font-bold">{s.title}</span>
              </div>
              <div className="mt-2 text-base font-semibold">{dayTime(s.at, "America/Los_Angeles")} Pacific</div>
              <div className="text-sm text-slate-500">{dayTime(s.at, "Asia/Manila")} Philippines</div>
              <p className="mt-1 text-sm text-slate-600">{s.who}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-600">
          Not approved by Wednesday 9:00 am? It moves to Thursday 10:00 am. Not approved by Thursday noon? That week is skipped.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Coming up</h2>
        {weeks.map((date, idx) => {
          const issue = db.issues.find((i) => i.issueDate === date);
          const d = deadlines(date);
          const alert = issue ? timingAlert(issue) : null;
          const theme = issue ? STAGE_THEME[issue.stage] : null;
          const current = idx === 0;
          const urgency = alert ? URGENCY[alert.tone] : null;
          const about = issue ? describe(issue, db.problems) : "";
          const sendAt = issue?.scheduledFor ? new Date(issue.scheduledFor) : d.sendAt;

          const box = !issue
            ? `border-2 border-dashed border-slate-300 bg-white ${current ? "ring-2 ring-rose-300" : ""}`
            : current
              ? `border-2 ${theme!.column} shadow-md`
              : `border border-l-8 border-slate-200 bg-white ${theme!.border}`;

          return (
            <article key={date} className={`rounded-xl p-5 ${box}`}>
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* Date block */}
                <div className="shrink-0 sm:w-52">
                  <div className={`text-sm font-bold uppercase tracking-wide ${current ? (theme?.heading ?? "text-rose-700") : "text-slate-500"}`}>{whenLabel(idx)}</div>
                  <div className="text-xl font-bold leading-tight">{formatDate(date).replace(/, \d{4}$/, "")}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">{issue?.stage === "SENT" ? "Sent" : "Sends"} {timeOnly(issue?.sentAt ? new Date(issue.sentAt) : sendAt, "America/Los_Angeles")} Pacific</div>
                  <div className="text-sm text-slate-500">{dayTime(issue?.sentAt ? new Date(issue.sentAt) : sendAt, "Asia/Manila")} Philippines</div>
                </div>

                {/* What's going out */}
                <div className="min-w-0 flex-1 space-y-2">
                  {issue ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <StageBadge stage={issue.stage} />
                        {urgency && <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${urgency.className}`}>{urgency.label}</span>}
                        <span className="text-sm text-slate-500">Email #{issue.number}</span>
                      </div>
                      <Link href={`/issues/${issue.id}`} className="block text-lg font-bold leading-snug text-slate-900 hover:underline">
                        {issue.subject || "No subject line yet"}
                      </Link>
                      <p className="text-base text-slate-700">{about || "No description yet. Open the email to write it."}</p>
                      {alert && (
                        <p className={`text-sm font-semibold ${ALERT_TEXT[alert.tone]}`}>
                          <span className="font-bold">Next step:</span> {alert.text}
                        </p>
                      )}
                      {issue.stage === "HELD" && issue.holdReason && (
                        <p className="text-sm font-semibold text-rose-800">On hold: {issue.holdReason}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-300">Nothing planned</span>
                        {current && <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">Urgent</span>}
                      </div>
                      <p className="text-lg font-bold text-slate-500">No email planned for this Wednesday</p>
                      <p className="text-base text-slate-600">
                        The draft would be due {formatPacific(d.submitBy).replace(" PT", "")} Pacific.{" "}
                        {user.role === "operator" && (
                          <>
                            <Link href="/problems" className="font-semibold text-indigo-600 hover:underline">
                              Pick a topic idea
                            </Link>{" "}
                            or{" "}
                            <Link href="/issues/new" className="font-semibold text-indigo-600 hover:underline">
                              start one from scratch
                            </Link>
                            .
                          </>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-bold">The last four weeks</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {recent.map((i) => (
              <li key={i.id} className={`flex flex-wrap items-center gap-3 border-l-4 py-3 pl-3 ${STAGE_THEME[i.stage].border}`}>
                <span className="w-36 font-semibold text-slate-600">{formatDate(i.issueDate).replace(/, \d{4}$/, "")}</span>
                <Link href={`/issues/${i.id}`} className="font-semibold hover:underline">
                  {i.subject || "No subject line"}
                </Link>
                <StageBadge stage={i.stage} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

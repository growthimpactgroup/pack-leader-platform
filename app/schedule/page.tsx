import { cookies } from "next/headers";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { describeIssue } from "@/lib/describe";
import { bodyHtml, marginPx } from "@/lib/richtext";
import { TZ_COOKIE, dayTime, viewerTz } from "@/lib/timezone";
import { TimezonePicker } from "../timezone-picker";
import { addDays, deadlines, formatDate, formatPacific, pacificToday, timingAlert, upcomingWednesdays, type Alert } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import { STAGE_THEME, StageBadge } from "../ui";

export const metadata = { title: "Broadcast and email send schedule — CBI Newsletter" };


function timeOnly(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date).replace(" AM", " am").replace(" PM", " pm");
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
  const [user, db, jar] = await Promise.all([currentUser(), readDb(), cookies()]);
  const tz = viewerTz(jar.get(TZ_COOKIE)?.value, user.role);
  const pacificOnly = tz.id === "America/Los_Angeles";
  const weeks = upcomingWednesdays(8);
  const lastWeekStart = addDays(pacificToday(), -28);
  const recent = db.issues
    .filter((i) => i.issueDate < weeks[0] && i.issueDate >= lastWeekStart)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const example = deadlines(weeks[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight">Broadcast and email send schedule</h1>
        <p className="mt-1 max-w-3xl text-base text-slate-700">
          When each email and broadcast to the CBI K9 mailing list goes out. The Pack Leader sends automatically every Wednesday once Grace approves
          it. Each week shows the subject line, what the email is about, and what still has to happen before it can send.
        </p>
        <div className="mt-3">
          <TimezonePicker tz={tz} back="/schedule" />
        </div>
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
              {!pacificOnly && <div className="text-sm text-slate-500">{dayTime(s.at, tz.id)} {tz.label}</div>}
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
          const about = issue ? describeIssue(issue, db.problems) : "";
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
                  {!pacificOnly && <div className="text-sm text-slate-500">{dayTime(issue?.sentAt ? new Date(issue.sentAt) : sendAt, tz.id)} {tz.label}</div>}
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
                      <div>
                        <div className="text-xs font-semibold text-slate-500">Subject line</div>
                        <Link href={`/issues/${issue.id}`} className="block text-lg font-bold leading-snug text-slate-900 hover:underline">
                          {issue.subject || "No subject line yet"}
                        </Link>
                      </div>
                      <p className="text-base text-slate-700">{about || "No description yet. Open the email to write it."}</p>
                      {issue.body.trim() && (
                        <details className="group rounded-lg bg-white/70 ring-1 ring-slate-200">
                          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-indigo-700 [&::-webkit-details-marker]:hidden">
                            <span className="inline-block transition group-open:rotate-90">▶</span> Read the whole email
                          </summary>
                          <div className="border-t border-slate-200 py-4" style={{ paddingLeft: marginPx(issue.bodyMargin), paddingRight: marginPx(issue.bodyMargin) }}>
                            {/* Sanitized on save (lib/sanitize.ts); older plain-text bodies are escaped. */}
                            <div className="email-content" dangerouslySetInnerHTML={{ __html: bodyHtml(issue) }} />
                          </div>
                        </details>
                      )}
                      {alert && (
                        <div className={`border-b-2 pb-2 text-base font-bold ${ALERT_TEXT[alert.tone]} ${alert.tone === "danger" ? "border-rose-300" : alert.tone === "warn" ? "border-amber-300" : alert.tone === "ok" ? "border-emerald-300" : "border-slate-300"}`}>
                          Next step: <span className="font-semibold">{alert.text}</span>
                        </div>
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
                              Pick a subject line idea
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

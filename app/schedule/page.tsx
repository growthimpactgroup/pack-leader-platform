import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { addDays, deadlines, formatDate, formatPacific, pacificToday, timingAlert, upcomingWednesdays } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import { AlertBox, STAGE_THEME, StageBadge, StageLegend } from "../ui";

export default async function SchedulePage() {
  const [user, db] = await Promise.all([currentUser(), readDb()]);
  const weeks = upcomingWednesdays(8);
  const lastWeekStart = addDays(pacificToday(), -28);
  const recent = db.issues
    .filter((i) => i.issueDate < weeks[0] && i.issueDate >= lastWeekStart)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-slate-500">
          One issue every Wednesday at 10:00 am. Packet due Tuesday 3:00 pm, approval by Wednesday 9:00 am (all Pacific).
        </p>
        <div className="mt-3">
          <StageLegend />
        </div>
      </div>

      <section className="space-y-3">
        {weeks.map((date) => {
          const issue = db.issues.find((i) => i.issueDate === date);
          const d = deadlines(date);
          const alert = issue ? timingAlert(issue) : null;
          return (
            <div
              key={date}
              className={`card flex flex-col gap-3 border-l-4 sm:flex-row sm:items-center ${issue ? STAGE_THEME[issue.stage].border : "border-l-slate-200 border-dashed"}`}
            >
              <div className="w-44 shrink-0">
                <div className="font-medium">{formatDate(date)}</div>
                <div className="text-xs text-slate-500">Packet due {formatPacific(d.submitBy)}</div>
              </div>
              <div className="flex-1 space-y-2">
                {issue ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/issues/${issue.id}`} className="font-medium hover:underline">
                        #{issue.number} · {issue.subject || "Untitled"}
                      </Link>
                      <StageBadge stage={issue.stage} />
                    </div>
                    {alert && <AlertBox alert={alert} />}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Open slot.{" "}
                    {user.role === "operator" && (
                      <Link href="/issues/new" className="font-medium text-indigo-600 hover:underline">
                        Plan an issue
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section className="card">
          <h2 className="label">Last four weeks</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {recent.map((i) => (
              <li key={i.id} className={`flex flex-wrap items-center gap-3 border-l-4 py-2 pl-3 ${STAGE_THEME[i.stage].border}`}>
                <span className="w-32 text-slate-500">{formatDate(i.issueDate)}</span>
                <Link href={`/issues/${i.id}`} className="font-medium hover:underline">
                  #{i.number} · {i.subject || "Untitled"}
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

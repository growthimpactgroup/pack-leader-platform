import Link from "next/link";
import { addRunLog } from "@/app/actions";
import { formatDate, formatPacific } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import { STAGES, type Stage } from "@/lib/types";
import { StageBadge } from "../ui";

// The three logs from Appendix A6, built from the issues' own history.
export default async function LogsPage() {
  const db = await readDb();
  const issues = [...db.issues].sort((a, b) => b.number - a.number);
  const sent = issues.filter((i) => i.stage === "SENT");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-slate-500">Approval Log and Send Log fill in automatically. Add a Run Log line at the end of each working session.</p>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Approval Log</h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Issue</th>
              <th className="py-2 pr-3">Submitted</th>
              <th className="py-2 pr-3">Review verdict</th>
              <th className="py-2 pr-3">Current stage</th>
              <th className="py-2 pr-3">Decided on</th>
              <th className="py-2">Changes requested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {issues.filter((i) => i.submittedAt).map((i) => (
              <tr key={i.id}>
                <td className="py-2 pr-3"><Link href={`/issues/${i.id}`} className="font-medium hover:underline">#{i.number}</Link></td>
                <td className="py-2 pr-3">{formatPacific(new Date(i.submittedAt!))}</td>
                <td className="py-2 pr-3">{i.scorecard ? `${i.scorecard.verdict} (${i.scorecard.valueScore}/10)` : "—"}</td>
                <td className="py-2 pr-3">
                  <StageBadge stage={i.stage} />
                </td>
                <td className="py-2 pr-3">{i.decision ? formatPacific(new Date(i.decision.at)) : "—"}</td>
                <td className="py-2">{i.history.filter((e) => e.to === "CHANGES_REQUESTED").length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!issues.some((i) => i.submittedAt) && <p className="text-sm text-slate-500">No packets submitted yet.</p>}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Send Log</h2>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Issue</th>
              <th className="py-2 pr-3">Send date</th>
              <th className="py-2 pr-3">Subject line</th>
              <th className="py-2 pr-3">Problem of the week</th>
              <th className="py-2 pr-3">Open rate</th>
              <th className="py-2 pr-3">Replies</th>
              <th className="py-2 pr-3">Calls booked</th>
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sent.map((i) => (
              <tr key={i.id}>
                <td className="py-2 pr-3"><Link href={`/issues/${i.id}`} className="font-medium hover:underline">#{i.number}</Link></td>
                <td className="py-2 pr-3">{formatDate(i.issueDate)}</td>
                <td className="py-2 pr-3">{i.subject}</td>
                <td className="py-2 pr-3">{i.problemOfWeek || "—"}</td>
                <td className="py-2 pr-3">{i.results.openRate || "—"}</td>
                <td className="py-2 pr-3">{i.results.replies || "—"}</td>
                <td className="py-2 pr-3">{i.results.callsBooked || "—"}</td>
                <td className="py-2">{i.results.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sent.length === 0 && <p className="text-sm text-slate-500">Nothing sent yet.</p>}
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Run Log</h2>
        <form action={addRunLog} className="grid gap-2 sm:grid-cols-[110px_1fr_1fr_auto]">
          <select name="issueNumber" className="input" defaultValue="">
            <option value="">No issue</option>
            {issues.map((i) => (
              <option key={i.id} value={i.number}>#{i.number}</option>
            ))}
          </select>
          <input name="done" className="input" placeholder="What's done" required />
          <input name="next" className="input" placeholder="What's next" required />
          <button className="btn-primary">Add</button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Issue</th>
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Done</th>
              <th className="py-2 pr-3">Next</th>
              <th className="py-2">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {db.runLog.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3 whitespace-nowrap">{formatPacific(new Date(r.date))}</td>
                <td className="py-2 pr-3">{r.issueNumber ? `#${r.issueNumber}` : "—"}</td>
                <td className="py-2 pr-3">{(STAGES as readonly string[]).includes(r.stage) ? <StageBadge stage={r.stage as Stage} /> : "—"}</td>
                <td className="py-2 pr-3">{r.done}</td>
                <td className="py-2 pr-3">{r.next}</td>
                <td className="py-2">{r.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {db.runLog.length === 0 && <p className="text-sm text-slate-500">No entries yet.</p>}
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  decide,
  holdIssue,
  markSent,
  postScorecard,
  reopenAsDraft,
  saveResults,
  savePacket,
  scheduleSend,
  sendTestEmail,
  submitForReview,
} from "@/app/actions";
import { EmailPreviewButton } from "@/app/email-preview";
import { RichEditor } from "@/app/rich-editor";
import { AlertBox, ErrorBox, STAGE_THEME, StageBadge } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { demoMode } from "@/lib/demo";
import { autoChecks } from "@/lib/packet";
import { deadlines, formatDate, formatPacific, suggestedSendTime, timingAlert, toPacificInput, upcomingWednesdays } from "@/lib/schedule";
import { readDb } from "@/lib/store";
import { bodyHtml, marginPx } from "@/lib/richtext";
import { EDITABLE_STAGES, ROLE_LABEL, STAGE_LABEL, type Issue, type User } from "@/lib/types";

const RULES: { key: keyof Issue["ruleCheck"]; label: string }[] = [
  { key: "noDashboardPlays", label: "No dashboard-feature plays" },
  { key: "noSetupPromises", label: "No client-setup promises" },
  { key: "noUnsourcedNumbers", label: "No unsourced numbers" },
  { key: "fixedLinesExact", label: "Fixed lines word for word; booking link works" },
];

export default async function IssuePage({ params, searchParams }: PageProps<"/issues/[id]">) {
  const [{ id }, query, user, db] = await Promise.all([params, searchParams, currentUser(), readDb()]);
  const issue = db.issues.find((i) => i.id === id);
  if (!issue) notFound();

  const editable = user.role === "operator" && EDITABLE_STAGES.includes(issue.stage);
  const alert = timingAlert(issue);
  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
          ← Pipeline
        </Link>
        <div className={`mt-2 flex flex-wrap items-center gap-3 border-l-4 pl-3 ${STAGE_THEME[issue.stage].border}`}>
          <h1 className="text-2xl font-semibold tracking-tight">Pack Leader #{issue.number}</h1>
          <StageBadge stage={issue.stage} />
          <span className="text-sm text-slate-500">Planned send {formatDate(issue.issueDate)}, 10:00 am</span>
        </div>
      </div>

      <ErrorBox message={error} />
      {alert && <AlertBox alert={alert} />}
      {issue.decision?.kind === "CHANGES" && issue.stage === "CHANGES_REQUESTED" && (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          <span className="font-semibold">Changes requested by {issue.decision.by}:</span> {issue.decision.notes}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {editable ? <PacketForm issue={issue} /> : <PacketView issue={issue} />}
          <History issue={issue} />
        </div>
        <aside className="space-y-5">
          <Deadlines issue={issue} />
          <ActionPanel issue={issue} user={user} />
          {issue.scorecard && <ScorecardView issue={issue} />}
          {issue.decision && <DecisionView issue={issue} />}
        </aside>
      </div>
    </div>
  );
}

// ---------- Packet ----------

function PacketForm({ issue }: { issue: Issue }) {
  const rows = [...issue.checklist, ...Array.from({ length: 3 }, () => ({ id: "", claim: "", source: "", verified: false }))];
  const dates = Array.from(new Set([issue.issueDate, ...upcomingWednesdays(8)])).sort();
  return (
    <form id="packet" action={savePacket} className="card space-y-5">
      <input type="hidden" name="id" value={issue.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Approval packet</h2>
        <EmailPreviewButton subjectFieldId="subject" htmlFieldId="bodyHtml" marginFieldId="bodyMargin" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="subject">1. Subject line (chosen)</label>
          <input id="subject" name="subject" className="input" defaultValue={issue.subject} placeholder="Pack Leader: ..." />
        </div>
        <div>
          <label className="label" htmlFor="altSubjects">Alternatives</label>
          <input id="altSubjects" name="altSubjects" className="input" defaultValue={issue.altSubjects} />
        </div>
        <div>
          <label className="label" htmlFor="issueDate">Send date</label>
          <select id="issueDate" name="issueDate" className="input" defaultValue={issue.issueDate}>
            {dates.map((d) => (
              <option key={d} value={d}>{formatDate(d)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="label">2. Full issue text (exactly as it will send)</div>
        <RichEditor initialHtml={bodyHtml(issue)} initialMargin={issue.bodyMargin} />
        <p className="mt-1 text-xs text-slate-500">
          Enter starts a new paragraph, Shift+Enter a new line. Tab and Shift+Tab indent. Use Heading 3 for section titles like THE NUMBER.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="problemOfWeek">Problem of the week (from the Problem Bank)</label>
        <input id="problemOfWeek" name="problemOfWeek" className="input" defaultValue={issue.problemOfWeek} placeholder="e.g. #5 No-shows" />
      </div>

      <fieldset>
        <legend className="label">3. Verification checklist</legend>
        <div className="space-y-2">
          {rows.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input name="claim" className="input" defaultValue={c.claim} placeholder="Claim or number" />
              <input name="source" className="input" defaultValue={c.source} placeholder="Source link" />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="verified" value={String(i)} defaultChecked={c.verified} /> Opened and read
              </label>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Save to get three more blank rows.</p>
      </fieldset>

      <fieldset>
        <legend className="label">4. Rule check (Operator)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RULES.map((r) => (
            <label key={r.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={r.key} defaultChecked={issue.ruleCheck[r.key]} /> {r.label}
            </label>
          ))}
        </div>
        <AutoChecks issue={issue} />
      </fieldset>

      <div>
        <label className="label" htmlFor="flags">5. Flags for Grace</label>
        <textarea id="flags" name="flags" rows={2} className="input" defaultValue={issue.flags} placeholder="Anything uncertain, or NONE" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="testEmailSent" defaultChecked={!!issue.testEmailSentAt} />
        6. Test email sent to Grace
        {issue.testEmailSentAt && <span className="text-slate-500">({formatPacific(new Date(issue.testEmailSentAt))})</span>}
      </label>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button className="btn-secondary">{issue.stage === "READY_FOR_REVIEW" ? "Save changes" : "Save packet"}</button>
        {(issue.stage === "DRAFT" || issue.stage === "CHANGES_REQUESTED") && (
          <button formAction={submitForReview} className="btn-primary">Submit for review</button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {issue.stage === "READY_FOR_REVIEW"
          ? "This packet is with the reviewer and Grace. Saving a text change clears the Review Agent scorecard so it gets checked again."
          : issue.stage === "HELD"
            ? "Held issues don't send. You can refresh the text here and reopen it as a draft when it's ready."
            : "Submitting checks the saved packet, so save your latest changes first."}
      </p>
    </form>
  );
}

function AutoChecks({ issue }: { issue: Issue }) {
  return (
    <ul className="mt-3 grid gap-1 rounded-md bg-slate-50 p-3 text-xs sm:grid-cols-2">
      {autoChecks(issue.subject, issue.body).map((c) => (
        <li key={c.label} className={c.ok ? "text-emerald-700" : "text-slate-500"}>
          {c.ok ? "✓" : "○"} {c.label}
        </li>
      ))}
    </ul>
  );
}

function PacketView({ issue }: { issue: Issue }) {
  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Approval packet</h2>
        <EmailPreviewButton subject={issue.subject} html={bodyHtml(issue)} margin={issue.bodyMargin} />
      </div>
      <Field label="1. Subject line">
        <p className="font-medium">{issue.subject || "—"}</p>
        {issue.altSubjects && <p className="text-sm text-slate-500">Alternatives: {issue.altSubjects}</p>}
      </Field>
      <Field label="2. Full issue text">
        {issue.body.trim() ? (
          <div className="rounded-md bg-slate-50 py-4" style={{ paddingLeft: marginPx(issue.bodyMargin), paddingRight: marginPx(issue.bodyMargin) }}>
            {/* Sanitized on save (lib/sanitize.ts); older plain-text bodies are escaped. */}
            <div className="email-content" dangerouslySetInnerHTML={{ __html: bodyHtml(issue) }} />
          </div>
        ) : (
          "—"
        )}
      </Field>
      {issue.problemOfWeek && <Field label="Problem of the week">{issue.problemOfWeek}</Field>}
      <Field label="3. Verification checklist">
        {issue.checklist.length === 0 ? (
          <p className="text-sm text-slate-500">No claims listed.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {issue.checklist.map((c) => (
              <li key={c.id}>
                {c.verified ? "☑" : "☐"} {c.claim} —{" "}
                {/^https?:\/\//.test(c.source) ? (
                  <a href={c.source} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{c.source}</a>
                ) : (
                  c.source
                )}
              </li>
            ))}
          </ul>
        )}
      </Field>
      <Field label="4. Rule check (Operator)">
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {RULES.map((r) => (
            <li key={r.key}>{issue.ruleCheck[r.key] ? "☑" : "☐"} {r.label}</li>
          ))}
        </ul>
        <AutoChecks issue={issue} />
      </Field>
      <Field label="5. Flags for Grace">{issue.flags || "NONE"}</Field>
      <Field label="6. Test email sent to Grace">
        {issue.testEmailSentAt ? `Yes · ${formatPacific(new Date(issue.testEmailSentAt))}` : "No"}
      </Field>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ---------- Side panel ----------

function Deadlines({ issue }: { issue: Issue }) {
  const d = deadlines(issue.issueDate);
  const rows = [
    ["Packet due", d.submitBy],
    ["Approval target", d.approveBy],
    ["Send", d.sendAt],
    ["Fallback send", d.fallbackSendAt],
    ["Held if not approved", d.holdAt],
  ] as const;
  return (
    <section className="card">
      <h2 className="label">Timeline (Pacific)</h2>
      <dl className="mt-2 space-y-1 text-sm">
        {rows.map(([label, date]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right">{formatPacific(date)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ActionPanel({ issue, user }: { issue: Issue; user: User }) {
  const s = issue.stage;
  const demo = demoMode();
  const blocks: React.ReactNode[] = [];

  if (user.role === "operator" && s !== "SENT") {
    blocks.push(
      <form key="test" action={sendTestEmail} className="space-y-1">
        <input type="hidden" name="id" value={issue.id} />
        <button className="btn-secondary w-full" disabled={!issue.body.trim()}>
          Send test email
        </button>
        <p className="text-xs text-slate-500">
          Sends the saved version{demo.on ? ` to ${demo.recipient || "the demo address"} (demo mode)` : " to Grace"}. Save your changes first.
        </p>
      </form>,
    );
  }

  if (user.role === "operator") {
    if (s === "READY_FOR_REVIEW") {
      blocks.push(
        <form key="withdraw" action={reopenAsDraft}>
          <input type="hidden" name="id" value={issue.id} />
          <p className="mb-2 text-sm text-slate-600">Waiting on the Review Agent and Grace. Withdraw only if you need to fix something.</p>
          <button className="btn-secondary">Withdraw to draft</button>
        </form>,
      );
    }
    if (s === "APPROVED") {
      const suggested = suggestedSendTime(issue, new Date(issue.decision!.at));
      const value = issue.scheduledFor ? toPacificInput(new Date(issue.scheduledFor)) : suggested ? toPacificInput(suggested) : "";
      blocks.push(
        <form key="schedule" action={scheduleSend} className="space-y-2">
          <input type="hidden" name="id" value={issue.id} />
          <label className="label" htmlFor="scheduledFor">Scheduled send (Pacific)</label>
          <input id="scheduledFor" type="datetime-local" name="scheduledFor" className="input" defaultValue={value} />
          {!suggested && <p className="text-xs text-amber-700">Approval landed after Thursday 10:00 am. The manual is silent here, so confirm the send time with Grace.</p>}
          <p className="text-xs text-slate-500">
            {demo.on
              ? `Demo mode: the platform emails the issue to ${demo.recipient || "the demo address"} at this time. GoHighLevel and the list aren't touched.`
              : "Schedule it in GoHighLevel first, then record the time here."}
          </p>
          <button className="btn-primary w-full">
            {issue.scheduledFor ? "Update scheduled time" : demo.on ? "Schedule demo send" : "Record scheduled send"}
          </button>
        </form>,
      );
      if (issue.scheduledFor) {
        blocks.push(
          <form key="sent" action={markSent}>
            <input type="hidden" name="id" value={issue.id} />
            <button className="btn-success w-full">Mark sent and archive</button>
          </form>,
        );
      }
      blocks.push(
        <form key="reopen" action={reopenAsDraft} className="space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="id" value={issue.id} />
          <input name="note" className="input" placeholder="What needs to change?" />
          <button className="btn-secondary w-full">Edit after approval</button>
          <p className="text-xs text-slate-500">Any change after approval, even one word, needs approval again.</p>
        </form>,
      );
    }
    if (s === "SENT") {
      blocks.push(
        <form key="results" action={saveResults} className="space-y-2">
          <input type="hidden" name="id" value={issue.id} />
          <div className="label">Send log results</div>
          <input name="openRate" className="input" placeholder="Open rate (e.g. 42%)" defaultValue={issue.results.openRate} />
          <input name="replies" className="input" placeholder="Replies" defaultValue={issue.results.replies} />
          <input name="callsBooked" className="input" placeholder="Calls booked" defaultValue={issue.results.callsBooked} />
          <textarea name="notes" rows={2} className="input" placeholder="Notes" defaultValue={issue.results.notes} />
          <button className="btn-secondary w-full">Save results</button>
        </form>,
      );
    }
    if (s === "HELD") {
      blocks.push(
        <form key="unhold" action={reopenAsDraft}>
          <input type="hidden" name="id" value={issue.id} />
          <p className="mb-2 text-sm text-slate-600">Held: {issue.holdReason}</p>
          <button className="btn-secondary w-full">Reopen as draft</button>
        </form>,
      );
    }
  }

  if ((user.role === "reviewer" || user.role === "approver") && s === "READY_FOR_REVIEW") {
    blocks.push(
      <form key="scorecard" action={postScorecard} className="space-y-2">
        <input type="hidden" name="id" value={issue.id} />
        <div className="label">Review Agent scorecard</div>
        <div className="flex gap-3 text-sm">
          {(["PASS", "FIX", "BLOCK"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" name="verdict" value={v} defaultChecked={issue.scorecard?.verdict === v} /> {v}
            </label>
          ))}
        </div>
        <input name="valueScore" type="number" min={0} max={10} className="input" placeholder="Value score /10" defaultValue={issue.scorecard?.valueScore} />
        <textarea name="requiredFixes" rows={3} className="input" placeholder="Required fixes, with exact wording (or NONE)" defaultValue={issue.scorecard?.requiredFixes} />
        <textarea name="noteForApprover" rows={2} className="input" placeholder="Note for Grace" defaultValue={issue.scorecard?.noteForApprover} />
        <button className="btn-secondary w-full">{issue.scorecard ? "Update scorecard" : "Post scorecard"}</button>
        <p className="text-xs text-slate-500">Advice only. Paste the verdict from the Pack Leader Review project.</p>
      </form>,
    );
  }

  if (user.role === "approver" && s === "READY_FOR_REVIEW") {
    blocks.push(
      <form key="decide" action={decide} className="space-y-2 border-t border-slate-100 pt-3">
        <input type="hidden" name="id" value={issue.id} />
        <div className="label">Your decision</div>
        <textarea name="notes" rows={3} className="input" placeholder="Notes (required when requesting changes)" />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" value="yes" className="mt-1" /> I have read the full issue and the test email.
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button name="kind" value="APPROVED" className="btn-success">Approve</button>
          <button name="kind" value="CHANGES" className="btn-secondary">Request changes</button>
        </div>
        <p className="text-xs text-slate-500">
          Approving records: “APPROVED — Pack Leader #{issue.number} — today’s date — {user.name}”.
        </p>
      </form>,
    );
  }

  if ((user.role === "approver" || user.role === "operator") && s !== "SENT" && s !== "HELD") {
    blocks.push(
      <details key="hold" className="border-t border-slate-100 pt-3 text-sm">
        <summary className="cursor-pointer text-slate-600">Hold this issue</summary>
        <form action={holdIssue} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={issue.id} />
          <input name="reason" className="input" placeholder="Reason" />
          <button className="btn-danger w-full">Hold — does not send</button>
        </form>
      </details>,
    );
  }

  return (
    <section className="card space-y-3">
      <h2 className="label">Next step · {ROLE_LABEL[user.role]}</h2>
      {blocks.length ? blocks : <p className="text-sm text-slate-500">Nothing for you to do at the {STAGE_LABEL[s].toLowerCase()} stage.</p>}
    </section>
  );
}

function ScorecardView({ issue }: { issue: Issue }) {
  const sc = issue.scorecard!;
  const tone = sc.verdict === "PASS" ? "text-emerald-700" : sc.verdict === "FIX" ? "text-amber-700" : "text-rose-700";
  return (
    <section className="card space-y-2 text-sm">
      <h2 className="label">Review Agent scorecard</h2>
      <p>
        <span className={`font-semibold ${tone}`}>{sc.verdict}</span> · Value {sc.valueScore}/10
      </p>
      {sc.requiredFixes && <p className="whitespace-pre-wrap"><span className="font-medium">Fixes:</span> {sc.requiredFixes}</p>}
      {sc.noteForApprover && <p className="whitespace-pre-wrap"><span className="font-medium">Note for Grace:</span> {sc.noteForApprover}</p>}
      <p className="text-xs text-slate-500">{sc.postedBy} · {formatPacific(new Date(sc.postedAt))}</p>
    </section>
  );
}

function DecisionView({ issue }: { issue: Issue }) {
  const d = issue.decision!;
  return (
    <section className={`card space-y-1 text-sm ${d.kind === "APPROVED" ? "border-emerald-300" : "border-orange-300"}`}>
      <h2 className="label">Grace’s decision</h2>
      <p className="font-mono text-[13px]">{d.text}</p>
      {d.kind === "APPROVED" && d.notes && <p className="text-slate-600">{d.notes}</p>}
      <p className="text-xs text-slate-500">{formatPacific(new Date(d.at))}</p>
    </section>
  );
}

function History({ issue }: { issue: Issue }) {
  return (
    <section className="card">
      <h2 className="label">History</h2>
      <ol className="mt-2 space-y-2 text-sm">
        {[...issue.history].reverse().map((e, i) => (
          <li key={i} className="flex flex-wrap gap-x-2">
            <span className="text-slate-500">{formatPacific(new Date(e.at))}</span>
            <span className="font-medium">{e.by}</span>
            <span>{e.action}</span>
            {e.to && e.from && (
              <span className="text-slate-500">({STAGE_LABEL[e.from]} → {STAGE_LABEL[e.to]})</span>
            )}
            {e.note && <span className="w-full pl-1 text-slate-600">“{e.note}”</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

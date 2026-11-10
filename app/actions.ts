"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { fromPacificInput, isWednesday, nextWednesday, pacificToday } from "@/lib/schedule";
import { htmlToText } from "@/lib/richtext";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import { updateDb } from "@/lib/store";
import { EDITABLE_STAGES, type ChecklistItem, type Db, type Issue, type Role, type Stage, type User, type Verdict } from "@/lib/types";

const now = () => new Date().toISOString();
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function findIssue(db: Db, id: string): Issue {
  const issue = db.issues.find((i) => i.id === id);
  if (!issue) throw new Error("Issue not found.");
  return issue;
}

function log(issue: Issue, user: User, action: string, to?: Stage, note?: string) {
  issue.history.push({
    at: now(),
    by: user.name,
    role: user.role as Role,
    action,
    from: to ? issue.stage : undefined,
    to,
    note: note || undefined,
  });
  if (to) issue.stage = to;
  issue.updatedAt = now();
}

function back(id: string, error?: string): never {
  revalidatePath("/", "layout");
  redirect(`/issues/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

// ---------- Operator ----------

export async function createIssue(formData: FormData) {
  const user = await requireRole("operator");
  const issueDate = str(formData, "issueDate") || nextWednesday();
  if (!isWednesday(issueDate)) redirect(`/issues/new?error=${encodeURIComponent("The send date must be a Wednesday.")}`);

  const id = await updateDb((db) => {
    const number = db.issues.reduce((max, i) => Math.max(max, i.number), 0) + 1;
    const issue: Issue = {
      id: crypto.randomUUID(),
      number,
      issueDate,
      stage: "DRAFT",
      subject: "Pack Leader: ",
      altSubjects: "",
      body: "",
      problemOfWeek: "",
      checklist: [],
      ruleCheck: { noDashboardPlays: false, noSetupPromises: false, noUnsourcedNumbers: false, fixedLinesExact: false },
      flags: "",
      testEmailSentAt: null,
      submittedAt: null,
      scorecard: null,
      decision: null,
      scheduledFor: null,
      sentAt: null,
      holdReason: null,
      results: { openRate: "", replies: "", callsBooked: "", notes: "" },
      history: [],
      createdAt: now(),
      updatedAt: now(),
    };
    log(issue, user, `Created Pack Leader #${number}`);
    db.issues.push(issue);
    return issue.id;
  });
  revalidatePath("/", "layout");
  redirect(`/issues/${id}`);
}

export async function savePacket(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "id");
  const error = await updateDb((db) => {
    const issue = findIssue(db, id);
    if (!EDITABLE_STAGES.includes(issue.stage)) {
      return issue.stage === "APPROVED"
        ? "Approved issues are locked. Use “Edit after approval” to reopen it; it will need approval again."
        : "Sent issues are locked so the archive matches what went out.";
    }
    const html = sanitizeEmailHtml(String(formData.get("bodyHtml") ?? ""));
    const margin = str(formData, "bodyMargin");
    const subject = str(formData, "subject");
    const contentChanged = html !== (issue.bodyHtml ?? "") || subject !== issue.subject;
    const claims = formData.getAll("claim").map(String);
    const sources = formData.getAll("source").map(String);
    const verified = new Set(formData.getAll("verified").map(String));
    const checklist: ChecklistItem[] = claims
      .map((claim, i) => ({ id: String(i), claim: claim.trim(), source: (sources[i] ?? "").trim(), verified: verified.has(String(i)) }))
      .filter((c) => c.claim || c.source);

    const date = str(formData, "issueDate");
    if (date && !isWednesday(date)) return "The send date must be a Wednesday.";

    Object.assign(issue, {
      issueDate: date || issue.issueDate,
      subject,
      altSubjects: str(formData, "altSubjects"),
      bodyHtml: html,
      body: htmlToText(html),
      bodyMargin: margin === "narrow" || margin === "wide" ? margin : "normal",
      problemOfWeek: str(formData, "problemOfWeek"),
      flags: str(formData, "flags"),
      checklist,
      ruleCheck: {
        noDashboardPlays: formData.has("noDashboardPlays"),
        noSetupPromises: formData.has("noSetupPromises"),
        noUnsourcedNumbers: formData.has("noUnsourcedNumbers"),
        fixedLinesExact: formData.has("fixedLinesExact"),
      },
      testEmailSentAt: formData.has("testEmailSent") ? issue.testEmailSentAt ?? now() : null,
    });
    if (issue.stage === "READY_FOR_REVIEW" && contentChanged && issue.scorecard) {
      // The scorecard was for the earlier text, so it no longer counts.
      issue.scorecard = null;
      log(issue, user, "Edited during review — scorecard cleared, needs reviewing again");
    } else {
      log(issue, user, issue.stage === "READY_FOR_REVIEW" ? "Edited during review" : "Saved packet");
    }
    return null;
  });
  back(id, error ?? undefined);
}

export async function submitForReview(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "id");
  const error = await updateDb((db) => {
    const issue = findIssue(db, id);
    if (issue.stage !== "DRAFT" && issue.stage !== "CHANGES_REQUESTED") return "Only a draft can be submitted.";
    const missing: string[] = [];
    if (!/^Pack Leader: .+/.test(issue.subject)) missing.push('a subject line starting "Pack Leader:"');
    if (issue.subject.replace(/^Pack Leader:\s*/, "").split(/\s+/).filter(Boolean).length > 8) missing.push("a subject under 8 words");
    if (!issue.body.trim()) missing.push("the full issue text");
    if (issue.checklist.length === 0) missing.push("at least one verified claim");
    if (issue.checklist.some((c) => !c.verified || !c.source)) missing.push("a source opened and read for every claim");
    if (!Object.values(issue.ruleCheck).every(Boolean)) missing.push("all four rule checks");
    if (!issue.testEmailSentAt) missing.push("a test email sent to the approver");
    if (missing.length) return `Can't submit yet. Still needed: ${missing.join("; ")}.`;
    issue.submittedAt = now();
    issue.scorecard = null;
    log(issue, user, "Submitted for review", "READY_FOR_REVIEW");
    return null;
  });
  back(id, error ?? undefined);
}

export async function reopenAsDraft(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "id");
  await updateDb((db) => {
    const issue = findIssue(db, id);
    const wasApproved = issue.stage === "APPROVED";
    if (!["READY_FOR_REVIEW", "APPROVED", "HELD"].includes(issue.stage)) return;
    issue.decision = wasApproved ? null : issue.decision;
    issue.scheduledFor = null;
    issue.holdReason = null;
    log(issue, user, wasApproved ? "Reopened after approval (needs approval again)" : "Reopened as draft", "DRAFT", str(formData, "note"));
  });
  back(id);
}

export async function scheduleSend(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "id");
  const error = await updateDb((db) => {
    const issue = findIssue(db, id);
    if (issue.stage !== "APPROVED" || issue.decision?.kind !== "APPROVED") return "Never schedule before approval.";
    const when = str(formData, "scheduledFor");
    if (!when) return "Pick a send time.";
    issue.scheduledFor = fromPacificInput(when).toISOString();
    log(issue, user, "Recorded scheduled send", undefined, `Scheduled in GoHighLevel for ${when} PT`);
    return null;
  });
  back(id, error ?? undefined);
}

export async function markSent(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "id");
  const error = await updateDb((db) => {
    const issue = findIssue(db, id);
    if (issue.stage !== "APPROVED" || !issue.scheduledFor) return "Schedule the approved issue before marking it sent.";
    issue.sentAt = now();
    log(issue, user, "Marked sent and archived", "SENT");
    return null;
  });
  back(id, error ?? undefined);
}

export async function saveResults(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "id");
  await updateDb((db) => {
    const issue = findIssue(db, id);
    if (issue.stage !== "SENT") return;
    issue.results = {
      openRate: str(formData, "openRate"),
      replies: str(formData, "replies"),
      callsBooked: str(formData, "callsBooked"),
      notes: str(formData, "notes"),
    };
    log(issue, user, "Logged results");
  });
  back(id);
}

// ---------- Review Agent ----------

export async function postScorecard(formData: FormData) {
  const user = await requireRole("reviewer", "approver");
  const id = str(formData, "id");
  const error = await updateDb((db) => {
    const issue = findIssue(db, id);
    if (issue.stage !== "READY_FOR_REVIEW") return "Scorecards can only be posted on a packet that is ready for review.";
    const verdict = str(formData, "verdict") as Verdict;
    if (!["PASS", "FIX", "BLOCK"].includes(verdict)) return "Pick a verdict.";
    const valueScore = Number(str(formData, "valueScore"));
    if (!(valueScore >= 0 && valueScore <= 10)) return "Value score must be 0 to 10.";
    issue.scorecard = {
      verdict,
      valueScore,
      requiredFixes: str(formData, "requiredFixes"),
      noteForApprover: str(formData, "noteForApprover"),
      postedBy: user.name,
      postedAt: now(),
    };
    log(issue, user, `Posted scorecard: ${verdict} (${valueScore}/10)`);
    return null;
  });
  back(id, error ?? undefined);
}

// ---------- Final Approver ----------

export async function decide(formData: FormData) {
  const user = await requireRole("approver");
  const id = str(formData, "id");
  const kind = str(formData, "kind");
  const notes = str(formData, "notes");
  const error = await updateDb((db) => {
    const issue = findIssue(db, id);
    if (issue.stage !== "READY_FOR_REVIEW") return "Only a packet that is ready for review can be decided.";
    const today = pacificToday();
    if (kind === "APPROVED") {
      if (str(formData, "confirm") !== "yes") return "Tick the box to confirm you have read the full issue.";
      const text = `APPROVED — Pack Leader #${issue.number} — ${today} — ${user.name}`;
      issue.decision = { kind: "APPROVED", text, notes, by: user.name, at: now() };
      log(issue, user, text, "APPROVED", notes);
    } else if (kind === "CHANGES") {
      if (!notes) return "Write the changes you want.";
      issue.decision = { kind: "CHANGES", text: `CHANGES — ${notes}`, notes, by: user.name, at: now() };
      log(issue, user, "Requested changes", "CHANGES_REQUESTED", notes);
    } else {
      return "Unknown decision.";
    }
    return null;
  });
  back(id, error ?? undefined);
}

export async function holdIssue(formData: FormData) {
  const user = await requireRole("approver", "operator");
  const id = str(formData, "id");
  const reason = str(formData, "reason");
  const error = await updateDb((db) => {
    const issue = findIssue(db, id);
    if (issue.stage === "SENT" || issue.stage === "HELD") return "This issue can't be held.";
    if (!reason) return "Give a reason for holding the issue.";
    issue.holdReason = reason;
    issue.scheduledFor = null;
    log(issue, user, "Held — does not send", "HELD", reason);
    return null;
  });
  back(id, error ?? undefined);
}

// ---------- Run Log ----------

export async function addRunLog(formData: FormData) {
  const user = await requireRole("operator", "approver", "reviewer");
  const issueNumber = Number(str(formData, "issueNumber")) || null;
  await updateDb((db) => {
    db.runLog.unshift({
      id: crypto.randomUUID(),
      date: now(),
      issueNumber,
      stage: issueNumber ? db.issues.find((i) => i.number === issueNumber)?.stage ?? "" : "",
      done: str(formData, "done"),
      next: str(formData, "next"),
      by: user.name,
    });
  });
  revalidatePath("/logs");
  redirect("/logs");
}

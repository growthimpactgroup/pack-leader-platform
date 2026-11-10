// Shapes for the Pack Leader approval workflow. Stage names and packet
// sections follow the Operating Manual v2.0 (section 7 and Appendix A5).

export const STAGES = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SENT",
  "HELD",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  DRAFT: "Draft",
  READY_FOR_REVIEW: "Ready for review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  SENT: "Sent",
  HELD: "Held",
};

// Stages where the Operator can still edit the packet. Approved is locked
// (reopening it needs approval again) and Sent is locked so the archive
// matches what went out.
export const EDITABLE_STAGES: readonly Stage[] = ["DRAFT", "READY_FOR_REVIEW", "CHANGES_REQUESTED", "HELD"];

export type Role = "operator" | "reviewer" | "approver";

export const ROLE_LABEL: Record<Role, string> = {
  operator: "Pack Leader Operator",
  reviewer: "Review Agent",
  approver: "Final Approver",
};

export type User = { role: Role; name: string };

export type ChecklistItem = {
  id: string;
  claim: string;
  source: string;
  verified: boolean; // Operator opened and read the source
};

export type RuleCheck = {
  noDashboardPlays: boolean;
  noSetupPromises: boolean;
  noUnsourcedNumbers: boolean;
  fixedLinesExact: boolean;
};

export type Verdict = "PASS" | "FIX" | "BLOCK";

export type Scorecard = {
  verdict: Verdict;
  valueScore: number; // out of 10
  requiredFixes: string;
  noteForApprover: string;
  postedBy: string;
  postedAt: string;
};

export type Decision = {
  kind: "APPROVED" | "CHANGES";
  text: string; // the written record, e.g. "APPROVED — Pack Leader #3 — 2026-11-18 — Grace"
  notes: string;
  by: string;
  at: string;
};

export type SendResults = {
  openRate: string;
  replies: string;
  callsBooked: string;
  notes: string;
};

export type HistoryEvent = {
  at: string;
  by: string;
  role: Role;
  action: string;
  from?: Stage;
  to?: Stage;
  note?: string;
};

export type Issue = {
  id: string;
  number: number;
  issueDate: string; // planned Wednesday, YYYY-MM-DD
  stage: Stage;
  subject: string;
  altSubjects: string;
  body: string; // plain-text copy, used by the checks
  bodyHtml?: string; // formatted body from the editor (absent on older issues)
  bodyMargin?: "narrow" | "normal" | "wide";
  problemOfWeek: string;
  checklist: ChecklistItem[];
  ruleCheck: RuleCheck;
  flags: string;
  testEmailSentAt: string | null;
  submittedAt: string | null;
  scorecard: Scorecard | null;
  decision: Decision | null;
  scheduledFor: string | null; // ISO instant
  scheduledEmailId?: string | null; // demo mode: the Resend email scheduled for that time
  sentAt: string | null;
  holdReason: string | null;
  results: SendResults;
  history: HistoryEvent[];
  createdAt: string;
  updatedAt: string;
};

export type RunLogEntry = {
  id: string;
  date: string;
  issueNumber: number | null;
  stage: string;
  done: string;
  next: string;
  by: string;
};

export type Db = {
  issues: Issue[];
  runLog: RunLogEntry[];
};

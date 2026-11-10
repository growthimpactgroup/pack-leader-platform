import type { Issue, Problem, Reference, Stage } from "./types";

// Where a problem stands, based on the issues drafted from it (newest first).
export type ProblemStatus = { label: string; stage: Stage | null; issues: Issue[] };

const STATUS_LABEL: Record<Stage, string> = {
  DRAFT: "Drafted",
  READY_FOR_REVIEW: "In review",
  CHANGES_REQUESTED: "Being revised",
  APPROVED: "Approved",
  SENT: "Sent",
  HELD: "Held",
};

export function problemStatus(problem: Problem, issues: Issue[]): ProblemStatus {
  const linked = issues.filter((i) => i.problemId === problem.id).sort((a, b) => b.number - a.number);
  const latest = linked[0];
  if (!latest) return { label: "Not drafted", stage: null, issues: [] };
  const label = latest.stage === "APPROVED" && latest.scheduledFor ? "Scheduled" : STATUS_LABEL[latest.stage];
  return { label, stage: latest.stage, issues: linked };
}

export const formatCode = (n: number) => `PB-${String(n).padStart(3, "0")}`;

// "Label - https://…", "Label: https://…" or a bare URL, one per line.
export function parseReferences(text: string): Reference[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const url = line.match(/https?:\/\/\S+/)?.[0]?.replace(/[.,;)\]]+$/, "") ?? "";
      const label = (url ? line.replace(url, "") : line).replace(/[\s\-–—:|]+$/, "").replace(/^[\s\-–—:|•]+/, "").trim();
      return { label: label || hostname(url) || line, url };
    });
}

export function referencesToText(refs: Reference[]): string {
  return refs.map((r) => (r.url ? (r.label && r.label !== hostname(r.url) ? `${r.label} - ${r.url}` : r.url) : r.label)).join("\n");
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

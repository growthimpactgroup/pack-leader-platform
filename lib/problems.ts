import { STAGE_LABEL, type Issue, type Problem, type Reference, type Stage } from "./types";

// Where a problem stands, based on the issues drafted from it (newest first).
export type ProblemStatus = { label: string; stage: Stage | null; issues: Issue[] };


export function problemStatus(problem: Problem, issues: Issue[]): ProblemStatus {
  const linked = issues.filter((i) => i.problemId === problem.id).sort((a, b) => b.number - a.number);
  const latest = linked[0];
  if (!latest) return { label: "Not used yet", stage: null, issues: [] };
  const label = latest.stage === "APPROVED" && latest.scheduledFor ? "Approved and scheduled" : STAGE_LABEL[latest.stage];
  return { label, stage: latest.stage, issues: linked };
}

export const formatCode = (n: number) => `PB-${String(n).padStart(3, "0")}`;

// What people see instead of the stored code: "PB-007" → "Idea 7".
export const topicLabel = (code: string) => {
  const n = Number(code.replace(/\D/g, ""));
  return n ? `Idea ${n}` : code;
};

// Labels for the context fields, used on forms, cards and in PDFs.
export const CONTEXT_FIELDS = [
  { key: "overlooked", label: "What owners aren’t paying attention to", short: "What they miss" },
  { key: "whyNow", label: "Why they care right now", short: "Why now" },
  { key: "stat", label: "The number that backs it up", short: "The number" },
  { key: "searchPhrases", label: "Search phrases (2–3 things people search for)", short: "Search phrases" },
] as const;

export function splitPhrases(text: string | undefined): string[] {
  return (text ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Suggested search phrases for the 17 starter ideas (v3), matched by subject
// line. "Fill in suggested search phrases" only fills ideas that have none.
export const SUGGESTED_PHRASES: Record<string, string> = {
  "the calls you never hear about": "missed calls, call answering service, vet not answering phone",
  "one missed call, one lost client": "missed calls, virtual receptionist, answering service",
  "your clients book when you're closed": "online booking, book vet online, dog boarding booking",
  "the first five minutes decide the client": "lead response time, speed to lead, missed leads",
  "the messages nobody answered": "unanswered messages, lead follow up, social media inbox",
  "booking with you might be harder than you think": "online booking, vet appointment, grooming appointment",
  "the empty slot that cost you twice": "appointment no shows, no show fee, cancellation policy",
  "they didn't forget. nobody reminded them.": "appointment reminders, vaccine reminders, text reminders",
  "the no-shows a reminder would have saved": "appointment reminder text, appointment no shows, reminder app",
  "holiday spots are already filling up": "dog boarding christmas, pet sitter holidays, dog boarding near me",
  "pet parents are staying home because they don't trust anyone": "pet sitter near me, trusted pet sitter, pet sitter reviews",
  "clients leave quietly": "customer retention, switching vets, lost customers",
  "your cheapest new client is an old one": "customer retention, win back customers, repeat customers",
  "they read your reviews before they call": "google reviews, vet reviews, dog groomer reviews",
  "happy clients who never leave a review": "how to get google reviews, review request, ask for reviews",
  "where did your week go?": "small business admin, time management, business automation",
  "running the business off the bank balance": "cash flow, small business bookkeeping, profit and loss",
};

export const suggestedPhrasesFor = (title: string) => SUGGESTED_PHRASES[title.trim().toLowerCase().replace(/[’‘]/g, "'")];

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

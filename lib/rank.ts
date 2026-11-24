import { splitPhrases } from "./problems";
import type { Issue, Problem, Stage } from "./types";

// Ranks content ideas so the strongest candidate for the next email stands out.
// It's a points system built from what the idea itself says, not live trend
// data (nothing external is connected yet). Out of 100:
//   Timely right now (season)        20
//   Fresh source (year of the data)  15
//   About pet-care businesses        20
//   Subject line pull (curiosity)    20
//   Not used yet                     10
//   How our past emails did          15  (from open rates logged after each send)

export type Rank = { rank: number; score: number; reasons: string[] };

const SEASONS: { months: number[]; label: string; words: RegExp }[] = [
  { months: [10, 11, 12], label: "Timely for the holiday rush", words: /holiday|christmas|december|travel|peak season|filling up|fully booked|year-end|end of the year|next year/i },
  { months: [1, 2], label: "Timely for new-year planning", words: /new year|january|next year|plans?|prices|budget|bank balance|numbers/i },
  { months: [3, 4, 5], label: "Timely for spring bookings", words: /spring|easter|book|reminder|vaccin/i },
  { months: [6, 7, 8, 9], label: "Timely for summer travel", words: /summer|vacation|travel|holiday|trust|sitter/i },
];

const PULL = /\b(you|your|never|nobody|quietly|hidden|cost|lost|losing|why|where|before|already|mistake|empty|twice|stop)\b/i;

export function scoreIdea(p: Problem, stage: Stage | null, month: number): { score: number; reasons: string[] } {
  const text = [p.title, p.overlooked, p.whyNow, p.stat, p.body, p.notes, ...p.references.map((r) => r.label)].filter(Boolean).join(" ");
  const reasons: string[] = [];
  let score = 0;

  const season = SEASONS.find((s) => s.months.includes(month));
  if (season && season.words.test(text)) {
    score += 20;
    reasons.push(season.label);
  }

  const years = (text.match(/\b20\d\d\b/g) ?? []).map(Number);
  const newest = years.length ? Math.max(...years) : 0;
  const thisYear = new Date().getFullYear();
  if (newest >= thisYear - 1) {
    score += 15;
    reasons.push(`Recent source (${newest})`);
  } else if (newest >= thisYear - 2) {
    score += 9;
    reasons.push(`Fairly recent source (${newest})`);
  } else if (newest) {
    score += 3;
    reasons.push(`Older source (${newest})`);
  }

  if (/pet-specific|\bpet\b|\bpets\b|\bvet|\bdog|groom|boarding|daycare|sitter/i.test(text) && !/not pet-specific/i.test(text)) {
    score += 20;
    reasons.push("About pet-care businesses");
  } else {
    reasons.push("General small-business number");
  }

  const t = p.title;
  let pull = 0;
  if (/\byou(r)?\b/i.test(t)) pull += 8;
  if (PULL.test(t.replace(/\byou(r)?\b/gi, ""))) pull += 8;
  if (/\?$/.test(t.trim())) pull += 5;
  if (t.length >= 20 && t.length <= 55) pull += 4;
  pull = Math.round((Math.min(25, pull) * 20) / 25);
  score += pull;
  reasons.push(pull >= 14 ? "Strong subject line" : pull >= 8 ? "Decent subject line" : "Subject line could be punchier");

  if (stage === null) {
    score += 10;
    reasons.push("Not used yet");
  } else if (stage === "SENT") {
    reasons.push("Already sent");
  } else {
    score += 3;
    reasons.push("Already being drafted");
  }

  return { score, reasons };
}

// ---------- How our past emails did ----------

// Open rate as a number ("42%", "42", "0.42" all read as 42).
export function openRate(issue: Issue): number | null {
  const n = parseFloat(issue.results?.openRate ?? "");
  if (Number.isNaN(n)) return null;
  return n > 0 && n <= 1 ? n * 100 : n;
}

export const RESULTS_NEEDED = 3; // sends with a logged open rate before this counts

export type Performance = { logged: number; average: number | null; byIdea: Map<string, number>; strongPhrases: Set<string> };

export function performance(issues: Issue[]): Performance {
  const sent = issues.filter((i) => i.stage === "SENT" && openRate(i) !== null);
  const average = sent.length ? sent.reduce((t, i) => t + openRate(i)!, 0) / sent.length : null;
  const byIdea = new Map<string, number>();
  for (const i of sent) if (i.problemId) byIdea.set(i.problemId, Math.max(byIdea.get(i.problemId) ?? 0, openRate(i)!));
  return { logged: sent.length, average, byIdea, strongPhrases: new Set() };
}

function performancePoints(p: Problem, perf: Performance): { points: number; reason: string } {
  if (perf.logged < RESULTS_NEEDED || perf.average === null) {
    return { points: 0, reason: `Past results: not enough yet (${perf.logged} of ${RESULTS_NEEDED} sends logged)` };
  }
  const own = perf.byIdea.get(p.id);
  if (own !== undefined) {
    const pct = Math.round(own);
    if (own >= perf.average * 1.15) return { points: 15, reason: `Its email opened well (${pct}%, above our ${Math.round(perf.average)}% average)` };
    if (own >= perf.average * 0.9) return { points: 9, reason: `Its email opened about average (${pct}%)` };
    return { points: 2, reason: `Its email opened below average (${pct}%)` };
  }
  const shared = splitPhrases(p.searchPhrases).find((ph) => perf.strongPhrases.has(ph.toLowerCase()));
  if (shared) return { points: 10, reason: `Like an email that opened well (shares “${shared}”)` };
  return { points: 5, reason: "Past results: no similar email sent yet" };
}

export function rankIdeas(items: { p: Problem; stage: Stage | null }[], month: number, issues: Issue[] = []): Map<string, Rank> {
  const perf = performance(issues);
  // Search phrases of ideas whose email beat the average count as "strong".
  if (perf.average !== null) {
    for (const { p } of items) {
      const own = perf.byIdea.get(p.id);
      if (own !== undefined && own >= perf.average * 1.15) splitPhrases(p.searchPhrases).forEach((ph) => perf.strongPhrases.add(ph.toLowerCase()));
    }
  }
  const scored = items.map(({ p, stage }) => {
    const base = scoreIdea(p, stage, month);
    const pf = performancePoints(p, perf);
    return { id: p.id, score: base.score + pf.points, reasons: [...base.reasons, pf.reason] };
  });
  const order = [...scored].sort((a, b) => b.score - a.score);
  return new Map(order.map((s, i) => [s.id, { rank: i + 1, score: s.score, reasons: s.reasons }]));
}

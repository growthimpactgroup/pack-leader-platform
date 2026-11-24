import type { Problem, Stage } from "./types";

// Ranks content ideas so the strongest candidate for the next email stands out.
// It's a points system built from what the idea itself says, not live trend
// data (nothing external is connected yet). Out of 100:
//   Timely right now (season)        25
//   Fresh source (year of the data)  20
//   About pet-care businesses        20
//   Subject line pull (curiosity)    25
//   Not used yet                     10

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
    score += 25;
    reasons.push(season.label);
  }

  const years = (text.match(/\b20\d\d\b/g) ?? []).map(Number);
  const newest = years.length ? Math.max(...years) : 0;
  const thisYear = new Date().getFullYear();
  if (newest >= thisYear - 1) {
    score += 20;
    reasons.push(`Recent source (${newest})`);
  } else if (newest >= thisYear - 2) {
    score += 12;
    reasons.push(`Fairly recent source (${newest})`);
  } else if (newest) {
    score += 4;
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
  pull = Math.min(25, pull);
  score += pull;
  reasons.push(pull >= 18 ? "Strong subject line" : pull >= 10 ? "Decent subject line" : "Subject line could be punchier");

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

export function rankIdeas(items: { p: Problem; stage: Stage | null }[], month: number): Map<string, Rank> {
  const scored = items.map(({ p, stage }) => ({ id: p.id, ...scoreIdea(p, stage, month) }));
  const order = [...scored].sort((a, b) => b.score - a.score);
  return new Map(order.map((s, i) => [s.id, { rank: i + 1, score: s.score, reasons: s.reasons }]));
}

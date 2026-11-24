import "server-only";
import { splitPhrases } from "./problems";
import type { Problem, TrendCheck } from "./types";

// Live Google search interest through DataForSEO's Google Trends "explore/live"
// endpoint (https://docs.dataforseo.com/v3/keywords_data/google_trends/explore/live/).
// Needs DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD (from app.dataforseo.com/api-access).
// One request per idea (up to 3 phrases, US, past 90 days), about $0.01 each.

const URL = "https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live";

export const trendsConfigured = () => !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);

type Point = { values?: (number | null)[]; missing_data?: boolean };

// Keywords can't contain these characters (DataForSEO rule).
const clean = (k: string) => k.replace(/[<>|"\-+=~!:*()[\]{},]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);

export async function checkTrend(p: Problem): Promise<TrendCheck> {
  const phrases = splitPhrases(p.searchPhrases).map(clean).filter((k) => k.length > 1).slice(0, 3);
  const checkedAt = new Date().toISOString();
  if (phrases.length === 0) return { checkedAt, direction: "no-data", change: null, phrases: [] };

  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      { keywords: phrases, location_name: "United States", time_range: "past_90_days", type: "web", item_types: ["google_trends_graph"] },
    ]),
  });
  const json = (await res.json().catch(() => null)) as {
    status_code?: number;
    status_message?: string;
    tasks?: { status_code?: number; status_message?: string; result?: { items?: { type?: string; data?: Point[] }[] }[] | null }[];
  } | null;
  const task = json?.tasks?.[0];
  if (!res.ok || !json || json.status_code !== 20000 || !task || task.status_code !== 20000) {
    throw new Error(task?.status_message || json?.status_message || `DataForSEO error ${res.status}`);
  }
  const graph = task.result?.[0]?.items?.find((i) => i.type === "google_trends_graph");
  const points = (graph?.data ?? []).filter((d) => !d.missing_data);

  // Weekly points: compare the last 4 weeks with the 8 before them.
  const perPhrase = phrases.map((phrase, k) => {
    const series = points.map((d) => d.values?.[k]).filter((v): v is number => typeof v === "number");
    if (series.length < 8) return { phrase, change: null };
    const recent = series.slice(-4);
    const before = series.slice(-12, -4);
    const avg = (a: number[]) => a.reduce((t, v) => t + v, 0) / a.length;
    const b = avg(before);
    if (b <= 0) return { phrase, change: null };
    return { phrase, change: Math.round(((avg(recent) - b) / b) * 100) };
  });
  const known = perPhrase.map((x) => x.change).filter((c): c is number => c !== null);
  const change = known.length ? Math.round(known.reduce((t, c) => t + c, 0) / known.length) : null;
  const direction = change === null ? "no-data" : change >= 15 ? "rising" : change <= -15 ? "falling" : "steady";
  return { checkedAt, direction, change, phrases: perPhrase };
}

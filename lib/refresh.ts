import "server-only";
import { rateSubject, ratingConfigured } from "./ai-rating";
import { splitPhrases } from "./problems";
import { readDb, updateDb } from "./store";
import { checkTrend, trendsConfigured } from "./trends";

// Shared by the "Refresh" buttons and the weekly scheduled job.

export type RefreshResult = { done: number; failed: number; skipped: string | null; error?: string };

export async function refreshTrends(): Promise<RefreshResult> {
  if (!trendsConfigured()) return { done: 0, failed: 0, skipped: "Live trends aren’t connected yet (SERPAPI_API_KEY missing)." };
  const db = await readDb();
  let done = 0;
  let failed = 0;
  let error: string | undefined;
  for (const p of db.problems.filter((x) => splitPhrases(x.searchPhrases).length > 0)) {
    try {
      const trend = await checkTrend(p);
      await updateDb((d) => {
        const target = d.problems.find((x) => x.id === p.id);
        if (target) target.trend = trend;
      });
      done++;
    } catch (e) {
      failed++;
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return { done, failed, skipped: null, error };
}

// Rates ideas with no rating, or whose subject line changed since.
export async function rateSubjectLines(force = false): Promise<RefreshResult> {
  if (!ratingConfigured()) return { done: 0, failed: 0, skipped: "Claude isn’t connected yet (ANTHROPIC_API_KEY missing)." };
  const db = await readDb();
  let done = 0;
  let failed = 0;
  let error: string | undefined;
  for (const p of db.problems.filter((x) => force || x.aiRating?.forTitle !== x.title)) {
    try {
      const rating = await rateSubject(p);
      await updateDb((d) => {
        const target = d.problems.find((x) => x.id === p.id);
        if (target) target.aiRating = rating;
      });
      done++;
    } catch (e) {
      failed++;
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return { done, failed, skipped: null, error };
}

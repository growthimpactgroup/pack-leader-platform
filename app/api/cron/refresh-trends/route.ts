import type { NextRequest } from "next/server";
import { rateSubjectLines, refreshTrends } from "@/lib/refresh";

// Weekly (Mondays 13:00 UTC, see vercel.json): re-checks search trends for every
// idea and rates any subject line that is new or changed. Same CRON_SECRET check
// as the daily schedule email.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET is not set.", { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const [trends, ratings] = [await refreshTrends(), await rateSubjectLines()];
  return Response.json({ trends, ratings });
}

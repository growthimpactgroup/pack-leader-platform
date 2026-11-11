import type { NextRequest } from "next/server";
import { sendDailySchedule } from "@/lib/email";
import { pacificToday } from "@/lib/schedule";
import { readDb } from "@/lib/store";

// Runs every day at 8:00 pm Philippine time (12:00 UTC, see vercel.json) and
// emails the Operator what is going out in the next 24 hours.
// Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; anything else is refused.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET is not set.", { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  const until = now.getTime() + 24 * 60 * 60 * 1000;
  const db = await readDb();
  const scheduled = db.issues
    .filter((i) => i.stage === "APPROVED" && i.scheduledFor && new Date(i.scheduledFor).getTime() > now.getTime())
    .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
  const upcoming = scheduled.filter((i) => new Date(i.scheduledFor!).getTime() <= until);
  const next = scheduled.find((i) => new Date(i.scheduledFor!).getTime() > until) ?? null;
  const today = pacificToday(now);
  const unscheduled = db.issues.filter((i) => i.issueDate === today && !i.scheduledFor && !["SENT", "HELD"].includes(i.stage));

  const result = await sendDailySchedule({ upcoming, unscheduled, next }, now);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}

import type { Issue } from "./types";

// Timing rules from the Operating Manual v2.0, section 7. All times Pacific.
export const TZ = "America/Los_Angeles";

// Converts a wall-clock time in Pacific to a UTC instant, handling DST.
export function pacific(date: string, hour: number, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asIfUtc - guess));
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Today's date in Pacific, YYYY-MM-DD.
export function pacificToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

export function nextWednesday(from = pacificToday()): string {
  const [y, m, d] = from.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(from, (3 - dow + 7) % 7);
}

export function upcomingWednesdays(count: number, from = pacificToday()): string[] {
  const first = nextWednesday(from);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
}

export function isWednesday(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 3;
}

export type Deadlines = {
  submitBy: Date; // Tuesday 3:00 pm
  approveBy: Date; // Wednesday 9:00 am
  sendAt: Date; // Wednesday 10:00 am
  fallbackSendAt: Date; // Thursday 10:00 am
  holdAt: Date; // Thursday 12:00 pm
};

export function deadlines(issueDate: string): Deadlines {
  return {
    submitBy: pacific(addDays(issueDate, -1), 15),
    approveBy: pacific(issueDate, 9),
    sendAt: pacific(issueDate, 10),
    fallbackSendAt: pacific(addDays(issueDate, 1), 10),
    holdAt: pacific(addDays(issueDate, 1), 12),
  };
}

export type Alert = { tone: "ok" | "warn" | "danger" | "info"; text: string };

// What the timing rules say about this issue right now.
export function timingAlert(issue: Issue, now = new Date()): Alert | null {
  const d = deadlines(issue.issueDate);
  const s = issue.stage;
  if (s === "SENT" || s === "HELD") return null;

  if (s === "APPROVED") {
    if (!issue.scheduledFor) return { tone: "warn", text: "Approved. Schedule the send in GoHighLevel and record it here." };
    return { tone: "ok", text: `Scheduled for ${formatPacific(new Date(issue.scheduledFor))}.` };
  }

  if (now >= d.holdAt) {
    return { tone: "danger", text: "No approval by Thursday 12:00 pm. Per the manual this issue is held and the week is skipped." };
  }
  if (now >= d.approveBy) {
    return { tone: "danger", text: "Missed Wednesday 9:00 am approval. Send moves to Thursday 10:00 am; send Grace one reminder." };
  }
  if (s === "DRAFT" || s === "CHANGES_REQUESTED") {
    if (now >= d.submitBy) return { tone: "danger", text: `Packet was due ${formatPacific(d.submitBy)}. Submit as soon as possible.` };
    return { tone: "info", text: `Submit for review by ${formatPacific(d.submitBy)}.` };
  }
  return { tone: "info", text: `Waiting on approval. Target: ${formatPacific(d.approveBy)}.` };
}

// The earliest send slot the rules allow if approval lands at `approvedAt`.
export function suggestedSendTime(issue: Issue, approvedAt = new Date()): Date | null {
  const d = deadlines(issue.issueDate);
  if (approvedAt < d.approveBy) return d.sendAt;
  if (approvedAt < d.fallbackSendAt) return d.fallbackSendAt;
  return null; // Between Thu 10:00 and 12:00 the manual is silent: Grace decides.
}

export function formatPacific(date: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date) + " PT"
  );
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// Value for a <input type="datetime-local"> showing a Pacific wall time.
export function toPacificInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function fromPacificInput(value: string): Date {
  const [date, time] = value.split("T");
  const [h, m] = time.split(":").map(Number);
  return pacific(date, h, m);
}

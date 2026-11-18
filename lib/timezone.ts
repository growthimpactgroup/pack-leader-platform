import type { Role } from "./types";

// Each person can pick the time zone the dashboard shows times in, next to
// Pacific (the manual's official clock). Stored in a cookie per browser.
export const TZ_COOKIE = "pl_tz";

export const TIMEZONES = [
  { id: "America/Los_Angeles", label: "Pacific" },
  { id: "America/Denver", label: "Mountain" },
  { id: "America/Chicago", label: "Central" },
  { id: "America/New_York", label: "Eastern" },
  { id: "Asia/Manila", label: "Philippines" },
  { id: "Europe/London", label: "UK" },
] as const;

export type ViewerTz = { id: string; label: string };

export function viewerTz(cookieValue: string | undefined, role: Role): ViewerTz {
  const picked = TIMEZONES.find((t) => t.id === cookieValue);
  if (picked) return picked;
  // Until someone picks: Frances works from the Philippines, everyone else Pacific.
  return role === "operator" ? TIMEZONES[4] : TIMEZONES[0];
}

export function dayTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" })
    .format(date)
    .replace(" AM", " am")
    .replace(" PM", " pm");
}

export function dateTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(date)
    .replace(" AM", " am")
    .replace(" PM", " pm");
}

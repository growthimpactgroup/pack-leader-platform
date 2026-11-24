"use client";

import { useEffect, useState } from "react";

// Live "2 days, 14 hours, 5 minutes until it sends", ticking every 30 seconds.
// The target is an exact moment (the Wednesday 10:00 am Pacific send time), so
// it reads the same in any time zone.
function parts(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const p = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return d > 0 ? `${p(d, "day")}, ${p(h, "hour")}, ${p(m, "minute")}` : h > 0 ? `${p(h, "hour")}, ${p(m, "minute")}` : p(m, "minute");
}

export function Countdown({ target, label = "until it sends" }: { target: string; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(target).getTime() - now;
  const text = ms > 0 ? `${parts(ms)} ${label}` : "Send time has passed";
  const tone = ms <= 0 || ms < 86_400_000 ? "bg-rose-600 text-white" : ms < 3 * 86_400_000 ? "bg-amber-500 text-white" : "bg-slate-900 text-white";
  return (
    <span suppressHydrationWarning className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-base font-bold tabular-nums ${tone}`}>
      <span aria-hidden>⏱</span>
      <span suppressHydrationWarning>{text}</span>
    </span>
  );
}

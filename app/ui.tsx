import type { Alert } from "@/lib/schedule";
import { STAGE_LABEL, type Stage } from "@/lib/types";

// One color per stage, used everywhere a stage appears so it reads at a glance:
// gray = being written, amber = waiting on review, orange = back with the
// Operator, green = approved, blue = sent, red = held.
export const STAGE_THEME: Record<Stage, { badge: string; dot: string; border: string; column: string; heading: string; tab: string }> = {
  DRAFT: {
    badge: "bg-slate-100 text-slate-700 ring-slate-300",
    dot: "bg-slate-400",
    border: "border-l-slate-400",
    column: "bg-slate-100/70 border-slate-200",
    heading: "text-slate-700",
    tab: "border-slate-500 bg-slate-100 text-slate-800",
  },
  READY_FOR_REVIEW: {
    badge: "bg-amber-100 text-amber-800 ring-amber-300",
    dot: "bg-amber-500",
    border: "border-l-amber-500",
    column: "bg-amber-50 border-amber-200",
    heading: "text-amber-800",
    tab: "border-amber-500 bg-amber-50 text-amber-800",
  },
  CHANGES_REQUESTED: {
    badge: "bg-orange-100 text-orange-800 ring-orange-300",
    dot: "bg-orange-500",
    border: "border-l-orange-500",
    column: "bg-orange-50 border-orange-200",
    heading: "text-orange-800",
    tab: "border-orange-500 bg-orange-50 text-orange-800",
  },
  APPROVED: {
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-300",
    dot: "bg-emerald-500",
    border: "border-l-emerald-500",
    column: "bg-emerald-50 border-emerald-200",
    heading: "text-emerald-800",
    tab: "border-emerald-500 bg-emerald-50 text-emerald-800",
  },
  SENT: {
    badge: "bg-sky-100 text-sky-800 ring-sky-300",
    dot: "bg-sky-500",
    border: "border-l-sky-500",
    column: "bg-sky-50 border-sky-200",
    heading: "text-sky-800",
    tab: "border-sky-500 bg-sky-50 text-sky-800",
  },
  HELD: {
    badge: "bg-rose-100 text-rose-800 ring-rose-300",
    dot: "bg-rose-500",
    border: "border-l-rose-500",
    column: "bg-rose-50 border-rose-200",
    heading: "text-rose-800",
    tab: "border-rose-500 bg-rose-50 text-rose-800",
  },
};

export function StageBadge({ stage }: { stage: Stage }) {
  const t = STAGE_THEME[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${t.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function StageLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {(Object.keys(STAGE_THEME) as Stage[]).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${STAGE_THEME[s].dot}`} />
          {STAGE_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

const ALERT_STYLE: Record<Alert["tone"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
};

export function AlertBox({ alert }: { alert: Alert }) {
  return <div className={`rounded-md border px-3 py-2 text-sm ${ALERT_STYLE[alert.tone]}`}>{alert.text}</div>;
}

export function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</div>;
}

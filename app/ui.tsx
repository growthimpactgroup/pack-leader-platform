import type { Alert } from "@/lib/schedule";
import { STAGE_LABEL, type Stage } from "@/lib/types";

const STAGE_STYLE: Record<Stage, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  READY_FOR_REVIEW: "bg-amber-100 text-amber-800",
  CHANGES_REQUESTED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  SENT: "bg-indigo-100 text-indigo-800",
  HELD: "bg-rose-100 text-rose-800",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_STYLE[stage]}`}>
      {STAGE_LABEL[stage]}
    </span>
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

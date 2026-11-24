"use client";

import { useFormStatus } from "react-dom";

// A submit button that says what's happening while a slow action runs.
export function PendingButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="space-y-2">
      <button disabled={pending} className={className}>
        {pending ? "Working…" : children}
      </button>
      {pending && <p className="text-base font-semibold text-indigo-800">{pendingText}</p>}
    </div>
  );
}

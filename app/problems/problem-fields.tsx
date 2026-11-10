import { referencesToText } from "@/lib/problems";
import type { Problem } from "@/lib/types";

// The editable fields of a problem, shared by the add and edit forms.
export function ProblemFields({ problem }: { problem?: Problem }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" className="input" required defaultValue={problem?.title} placeholder="e.g. Missed and after-hours calls" />
      </div>
      <div>
        <label className="label" htmlFor="body">Body</label>
        <textarea
          id="body"
          name="body"
          rows={8}
          className="input"
          defaultValue={problem?.body}
          placeholder="The problem in detail: the number, what it costs an owner, why it matters."
        />
      </div>
      <div>
        <label className="label" htmlFor="references">References and links</label>
        <textarea
          id="references"
          name="references"
          rows={4}
          className="input font-mono text-[13px]"
          defaultValue={problem ? referencesToText(problem.references) : ""}
          placeholder={"One per line, e.g.\nBrightLocal 2025 survey - https://www.brightlocal.com/research/local-consumer-review-survey-2025/"}
        />
        <p className="mt-1 text-xs text-slate-500">These become the verification checklist when you create a draft.</p>
      </div>
      <div>
        <label className="label" htmlFor="notes">Context and notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="input"
          defaultValue={problem?.notes}
          placeholder="Anything useful for whoever drafts it: angle, who it's for, what Grace said."
        />
      </div>
    </>
  );
}

import { referencesToText } from "@/lib/problems";
import type { Problem } from "@/lib/types";

// The editable fields of a topic, shared by the add and edit forms.
export function ProblemFields({ problem }: { problem?: Problem }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="title">Subject line idea</label>
        <input id="title" name="title" className="input" required defaultValue={problem?.title} placeholder="e.g. The calls you never hear about" />
        <p className="mt-1 text-xs text-slate-500">Write it the way a pet-care owner would want to read it in their inbox.</p>
      </div>
      <div>
        <label className="label" htmlFor="overlooked">What owners aren’t paying attention to</label>
        <textarea
          id="overlooked"
          name="overlooked"
          rows={3}
          className="input"
          defaultValue={problem?.overlooked}
          placeholder="The problem they don't see from the inside, e.g. nobody counts the callers who hung up on hold."
        />
      </div>
      <div>
        <label className="label" htmlFor="whyNow">Why they care right now</label>
        <textarea
          id="whyNow"
          name="whyNow"
          rows={3}
          className="input"
          defaultValue={problem?.whyNow}
          placeholder="What's at stake for them this season: bookings, clients, time, money."
        />
      </div>
      <div>
        <label className="label" htmlFor="stat">The number that backs it up</label>
        <textarea
          id="stat"
          name="stat"
          rows={2}
          className="input"
          defaultValue={problem?.stat}
          placeholder="One sentence with one sourced number. No estimates."
        />
      </div>
      <div>
        <label className="label" htmlFor="searchPhrases">Search phrases</label>
        <input
          id="searchPhrases"
          name="searchPhrases"
          className="input"
          defaultValue={problem?.searchPhrases}
          placeholder="e.g. missed calls, dog boarding near me, pet sitter holidays"
        />
        <p className="mt-1 text-xs text-slate-500">2–3 things people type into Google about this, separated by commas. Used to rank ideas by what’s trending.</p>
      </div>
      <div>
        <label className="label" htmlFor="references">Source links</label>
        <textarea
          id="references"
          name="references"
          rows={3}
          className="input font-mono text-[13px]"
          defaultValue={problem ? referencesToText(problem.references) : ""}
          placeholder={"One per line, e.g.\nBrightLocal 2025 survey - https://www.brightlocal.com/research/local-consumer-review-survey-2025/"}
        />
        <p className="mt-1 text-xs text-slate-500">These become the verification checklist when you create a draft.</p>
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes for whoever writes it</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="input"
          defaultValue={problem?.notes}
          placeholder="Who the number is about (vet clinics, pet sitters, all small businesses), caveats, what Grace said."
        />
      </div>
      <div>
        <label className="label" htmlFor="body">Extra detail (optional)</label>
        <textarea id="body" name="body" rows={3} className="input" defaultValue={problem?.body} placeholder="Anything else worth keeping." />
      </div>
    </>
  );
}

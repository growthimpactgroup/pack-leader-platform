import { setTimezone } from "./tz-actions";
import { TIMEZONES, type ViewerTz } from "@/lib/timezone";

// "Show times in: [Philippines ▾] [Change]" — works without scripts.
export function TimezonePicker({ tz, back }: { tz: ViewerTz; back: string }) {
  return (
    <form action={setTimezone} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="back" value={back} />
      <label htmlFor="tz" className="font-semibold text-slate-700">
        Show times in
      </label>
      <select id="tz" name="tz" defaultValue={tz.id} className="input w-auto py-1.5">
        {TIMEZONES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <button className="btn-secondary py-1.5">Change</button>
      <span className="text-slate-500">Pacific is always shown too.</span>
    </form>
  );
}

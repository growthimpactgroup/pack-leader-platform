import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PendingButton } from "@/app/pending-button";
import { generateDraftFromProblem } from "@/app/problem-actions";
import { ErrorBox } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { TONES, TRUSTED_DOMAINS, generatorConfigured, suggestTones } from "@/lib/generate-draft";
import { hostname, splitPhrases } from "@/lib/problems";
import { readDb } from "@/lib/store";

export const metadata = { title: "Generate draft — CBI Newsletter" };
// Research and writing take a minute or two.
export const maxDuration = 300;

export default async function GeneratePage({ params, searchParams }: PageProps<"/problems/[id]/generate">) {
  const [{ id }, query, user, db] = await Promise.all([params, searchParams, currentUser(), readDb()]);
  if (user.role !== "operator") redirect(`/problems/${id}`);
  const p = db.problems.find((x) => x.id === id);
  if (!p) notFound();
  const suggestions = suggestTones(p);
  const best = suggestions[0]?.id ?? "friendly";
  // Suggested tones first, in order of fit, then the rest.
  const rankOf = (tid: string) => {
    const i = suggestions.findIndex((x) => x.id === tid);
    return i === -1 ? 99 : i;
  };
  const ideaSites = Array.from(new Set(p.references.map((r) => hostname(r.url)).filter(Boolean)));
  const on = generatorConfigured();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/problems" className="text-sm text-slate-500 hover:text-slate-800">
        ← Subject line and content ideas
      </Link>
      <div>
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight">Generate a draft</h1>
        <p className="mt-2 text-xl">
          <span className="font-bold text-slate-500">Subject line:</span> <span className="font-bold">{p.title}</span>
        </p>
        <p className="mt-2 text-base text-slate-700">
          Claude researches this idea on trusted primary sources only, writes the email body, and lists every source it used so you can check
          them. You’ll land on the new draft to edit before it goes for review.
        </p>
      </div>

      <ErrorBox message={typeof query.error === "string" ? query.error : undefined} />
      {!on && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
          <p className="font-bold">Claude isn’t connected yet.</p>
          <p className="mt-1">Add GIG’s Anthropic API key in Vercel as ANTHROPIC_API_KEY, redeploy, and this button will work.</p>
        </div>
      )}

      <form action={generateDraftFromProblem} className="card space-y-6">
        <input type="hidden" name="id" value={p.id} />

        <fieldset className="space-y-3">
          <legend className="text-lg font-bold">What tone should it have?</legend>
          {[...TONES].sort((a, b) => rankOf(a.id) - rankOf(b.id)).map((t) => {
            const s = suggestions.find((x) => x.id === t.id);
            return (
              <label key={t.id} className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ${s ? "bg-indigo-50 ring-indigo-200" : "ring-slate-200"}`}>
                <input type="radio" name="tone" value={`${t.label}: ${t.hint}`} defaultChecked={t.id === best} className="mt-1.5 h-4 w-4" />
                <span>
                  <span className="font-bold">{t.label}</span>
                  {t.id === best && <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">Suggested</span>}
                  {s && t.id !== best && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">Also fits</span>}
                  <span className="block text-base text-slate-600">{t.hint}</span>
                  {s && <span className="block text-sm text-indigo-800">Why: {s.reason}</span>}
                </span>
              </label>
            );
          })}
          <div>
            <label className="label" htmlFor="customTone">Or describe your own tone (optional)</label>
            <input id="customTone" name="customTone" className="input" placeholder="e.g. Friendly but firm, like a trusted advisor" />
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="notes">Anything else Claude should know? (optional)</label>
          <textarea id="notes" name="notes" rows={3} className="input" placeholder="e.g. Mention that December is the busiest month for boarding." />
        </div>

        <details className="rounded-lg bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
          <summary className="cursor-pointer font-bold text-slate-800">What Claude follows when it writes</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            <li>
              Researches only on trusted primary sources: this idea’s own sources ({ideaSites.join(", ") || "none yet"}) plus {TRUSTED_DOMAINS.length}{" "}
              approved sites (government, veterinary and pet-industry associations, peer-reviewed journals, and Google, Yahoo and Microsoft’s own
              sender guidance).
            </li>
            <li>Every number must come from a source it opened; links it didn’t actually read are removed. All sources go into the verification checklist for you to open.</li>
            <li>The manual’s rules: one headline number, no dashboard how-tos, no setup promises, and the fixed closing lines exactly as written.</li>
            <li>Inbox rules (Gmail, Yahoo and CAN-SPAM): honest subject under 60 characters, no spam-trigger words or ALL CAPS, preview text, mostly text, two links at most, no fake urgency.</li>
            <li>SEO for the web version: main search phrase ({splitPhrases(p.searchPhrases)[0] ?? "add search phrases to the idea"}) early and in a heading, plus a meta description.</li>
          </ul>
        </details>

        <PendingButton className="btn-primary px-6 py-3 text-base" pendingText="Researching trusted sources and writing your draft. This usually takes 1–2 minutes; keep this page open.">
          Generate draft
        </PendingButton>
        <p className="text-sm text-slate-500">Each draft costs roughly a few cents to a quarter in Claude usage and web searches, billed to GIG’s Anthropic account.</p>
      </form>
    </div>
  );
}

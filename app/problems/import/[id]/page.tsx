import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { confirmImport, discardImport } from "@/app/problem-actions";
import { currentUser } from "@/lib/auth";
import { CONTEXT_FIELDS, referencesToText } from "@/lib/problems";
import { readDb } from "@/lib/store";

// Review screen for a PDF: every topic the PDF was split into, editable, with a
// tick box to choose which ones get added.
export default async function ImportReviewPage({ params }: PageProps<"/problems/import/[id]">) {
  const [{ id }, user, db] = await Promise.all([params, currentUser(), readDb()]);
  if (user.role !== "operator") redirect("/problems");
  const imp = db.imports.find((i) => i.id === id);
  if (!imp) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/problems" className="text-sm text-slate-500 hover:text-slate-800">
          ← Email Topic Ideas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Check the topics from {imp.fileName}</h1>
        <p className="text-sm text-slate-500">
          Found {imp.items.length} topic{imp.items.length === 1 ? "" : "s"}. Fix anything that was split wrongly, untick what you don’t want, then add them.
        </p>
      </div>

      <form action={confirmImport} className="space-y-4">
        <input type="hidden" name="importId" value={imp.id} />
        {imp.items.map((item, i) => (
          <fieldset key={i} className="card grid gap-3 lg:grid-cols-[auto_1fr]">
            <label className="flex items-start gap-2 pt-1 text-sm font-medium text-slate-600">
              <input type="checkbox" name="include" value={String(i)} defaultChecked className="mt-0.5" />
              Topic {i + 1}
            </label>
            <div className="space-y-3">
              <div>
                <span className="label">Subject line idea</span>
                <input name="title" defaultValue={item.title} className="input font-medium" aria-label={`Topic ${i + 1} subject line idea`} />
              </div>
              {CONTEXT_FIELDS.map((f) => (
                <div key={f.key}>
                  <span className="label">{f.label}</span>
                  <textarea name={f.key} defaultValue={item[f.key] ?? ""} rows={3} className="input" aria-label={`Topic ${i + 1}: ${f.label}`} />
                </div>
              ))}
              <div>
                <span className="label">Source links</span>
                <textarea
                  name="references"
                  defaultValue={referencesToText(item.references)}
                  rows={Math.max(2, item.references.length)}
                  className="input font-mono text-[13px]"
                  placeholder="One per line"
                  aria-label={`Topic ${i + 1} source links`}
                />
              </div>
              <div>
                <span className="label">Notes for whoever writes it</span>
                <textarea name="notes" defaultValue={item.notes ?? ""} rows={2} className="input" aria-label={`Topic ${i + 1} notes`} />
              </div>
              <div>
                <span className="label">Extra detail (optional)</span>
                <textarea
                  name="body"
                  defaultValue={item.body}
                  rows={Math.min(8, Math.max(2, Math.ceil(item.body.length / 110)))}
                  className="input"
                  aria-label={`Topic ${i + 1} extra detail`}
                />
              </div>
            </div>
          </fieldset>
        ))}

        {imp.otherLinks && imp.otherLinks.length > 0 && (
          <section className="card text-sm">
            <h2 className="label">Other links in the PDF</h2>
            <p className="mb-2 text-slate-500">These links weren’t next to a topic’s text. Paste any you need into a topic’s source links.</p>
            <ul className="space-y-1 font-mono text-[13px]">
              {imp.otherLinks.map((l) => (
                <li key={l} className="break-all">
                  {l}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary">Add ticked topics</button>
          <button formAction={discardImport} className="btn-secondary">
            Discard this upload
          </button>
        </div>
      </form>
    </div>
  );
}

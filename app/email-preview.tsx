"use client";

import { useRef, useState, type ReactNode } from "react";

// Shows the issue the way a reader would see it in their inbox, in a pop-up.
// In a draft it reads the subject and body straight from the form, so unsaved
// edits show up too. Elsewhere it uses the saved text passed in as props.

const SENDER = "The Pack Leader by CBI K9";
const SECTION_HEADINGS = ["THE BIG ONE", "THE NUMBER", "THE PLAY", "PROBLEM OF THE WEEK"];
const LABELS = ["What to do about it:", "Why it matters:", "P.S."];

type Props = {
  subject?: string;
  body?: string;
  // When set, read live values from these form fields instead of the props.
  subjectFieldId?: string;
  bodyFieldId?: string;
  label?: string;
};

export function EmailPreviewButton({ subject = "", body = "", subjectFieldId, bodyFieldId, label = "Preview email" }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState({ subject, body });
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");

  function open() {
    const field = (id?: string) => (id ? (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value : undefined);
    setContent({ subject: field(subjectFieldId) ?? subject, body: field(bodyFieldId) ?? body });
    dialog.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={open} className="btn-secondary">
        {label}
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[92vh] w-[min(760px,94vw)] overflow-hidden rounded-xl bg-slate-100 p-0 shadow-2xl backdrop:bg-slate-900/60"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="font-semibold">Email preview</h2>
          <div className="ml-2 flex rounded-md border border-slate-300 p-0.5 text-xs">
            {(["desktop", "mobile"] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWidth(w)}
                className={`rounded px-2 py-1 capitalize ${width === w ? "bg-slate-900 text-white" : "text-slate-600"}`}
              >
                {w}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close preview"
            className="ml-auto rounded-md p-1.5 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(92vh-56px)] overflow-y-auto p-4 sm:p-6">
          <div className={`mx-auto transition-all ${width === "mobile" ? "max-w-[375px]" : "max-w-[600px]"}`}>
            <InboxHeader subject={content.subject} body={content.body} />
            <article className="rounded-b-lg border border-t-0 border-slate-200 bg-white px-6 py-6 text-[15px] leading-relaxed text-slate-800">
              {content.body.trim() ? <EmailBody text={content.body} /> : <p className="text-slate-400">No issue text yet.</p>}
              <EmailFooter />
            </article>
          </div>
          <p className="mx-auto mt-3 max-w-[600px] text-center text-xs text-slate-500">
            Approximate preview. Always check the GoHighLevel test email on a phone before submitting.
          </p>
        </div>
      </dialog>
    </>
  );
}

function InboxHeader({ subject, body }: { subject: string; body: string }) {
  const preheader = body.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return (
    <div className="rounded-t-lg border border-slate-200 bg-white px-6 py-4">
      <div className="text-lg font-semibold text-slate-900">{subject.trim() || <span className="text-slate-400">No subject line</span>}</div>
      <div className="mt-2 flex items-center gap-3 text-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white">PL</div>
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{SENDER}</div>
          <div className="truncate text-slate-500">to me · {preheader}</div>
        </div>
      </div>
    </div>
  );
}

function EmailBody({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        const first = lines[0].trim();
        if (SECTION_HEADINGS.includes(first.toUpperCase())) {
          return (
            <section key={i} className="space-y-2">
              <h3 className="border-b-2 border-indigo-600 pb-1 text-xs font-bold tracking-[0.12em] text-indigo-700">{first.toUpperCase()}</h3>
              {lines.slice(1).map((l, j) => (
                <Line key={j} text={l} />
              ))}
            </section>
          );
        }
        return (
          <div key={i} className="space-y-1">
            {lines.map((l, j) => (
              <Line key={j} text={l} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Line({ text }: { text: string }) {
  const label = LABELS.find((l) => text.trim().startsWith(l));
  if (label) {
    const rest = text.trim().slice(label.length);
    return (
      <p>
        <strong className="text-slate-900">{label}</strong>
        {inline(rest)}
      </p>
    );
  }
  if (/^- The CBI K9 team$/i.test(text.trim())) return <p className="pt-2 text-slate-600">{text.trim()}</p>;
  return <p>{inline(text)}</p>;
}

// Turns links into anchors and highlights unfilled [PLACEHOLDERS].
function inline(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+|\[[A-Z][A-Z0-9 _-]*\])/g).map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-indigo-600 underline">
          {part}
        </a>
      );
    }
    if (/^\[[A-Z][A-Z0-9 _-]*\]$/.test(part)) {
      return (
        <mark key={i} title="Placeholder still to fill in" className="rounded bg-amber-200 px-1 text-amber-900">
          {part}
        </mark>
      );
    }
    return part;
  });
}

function EmailFooter() {
  return (
    <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs leading-relaxed text-slate-500">
      <p>You’re receiving The Pack Leader because you’ve worked with or spoken to CBI K9.</p>
      <p className="mt-1">
        Growth Impact Group, LLC · {inline("[GIG MAILING ADDRESS]")} · <span className="underline">Unsubscribe</span>
      </p>
    </footer>
  );
}

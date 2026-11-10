"use client";

import { useEffect, useRef, useState } from "react";
import { htmlToText, marginPx } from "@/lib/richtext";

// Shows the issue the way a reader would see it in their inbox, in a pop-up.
// In a draft it reads the subject, formatted body and margins straight from the
// form, so unsaved edits show up too. Elsewhere it uses the saved values.

const SENDER = "The Pack Leader by CBI K9";
const SECTION_HEADINGS = ["THE BIG ONE", "THE NUMBER", "THE PLAY", "PROBLEM OF THE WEEK"];
const PLACEHOLDER = /\[[A-Z][A-Z0-9 _-]*\]/g;

type Props = {
  subject?: string;
  html?: string;
  margin?: string;
  // When set, read live values from these form fields instead of the props.
  subjectFieldId?: string;
  htmlFieldId?: string;
  marginFieldId?: string;
  label?: string;
};

export function EmailPreviewButton({ subject = "", html = "", margin = "normal", subjectFieldId, htmlFieldId, marginFieldId, label = "Preview email" }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState({ subject, html, margin });
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");

  function open() {
    const field = (id?: string) => (id ? (document.getElementById(id) as HTMLInputElement | null)?.value : undefined);
    setContent({
      subject: field(subjectFieldId) ?? subject,
      html: field(htmlFieldId) ?? html,
      margin: field(marginFieldId) ?? margin,
    });
    dialog.current?.showModal();
  }

  const text = htmlToText(content.html);
  const pad = marginPx(content.margin);

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
            <InboxHeader subject={content.subject} preheader={text.split("\n").find((l) => l.trim()) ?? ""} />
            <article
              className="rounded-b-lg border border-t-0 border-slate-200 bg-white py-6"
              style={{ paddingLeft: width === "mobile" ? Math.min(pad, 20) : pad, paddingRight: width === "mobile" ? Math.min(pad, 20) : pad }}
            >
              {text ? <EmailBody html={content.html} /> : <p className="text-slate-400">No issue text yet.</p>}
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

function InboxHeader({ subject, preheader }: { subject: string; preheader: string }) {
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

// Renders the formatted body, then styles plain section titles (a paragraph that
// just says "THE NUMBER") and highlights unfilled [PLACEHOLDERS].
function EmailBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("p").forEach((p) => {
      if (SECTION_HEADINGS.includes((p.textContent ?? "").trim().toUpperCase())) p.classList.add("section-heading");
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const value = node.nodeValue ?? "";
      if (!PLACEHOLDER.test(value)) continue;
      PLACEHOLDER.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of value.matchAll(PLACEHOLDER)) {
        frag.append(value.slice(last, m.index));
        const mark = document.createElement("span");
        mark.className = "placeholder";
        mark.title = "Placeholder still to fill in";
        mark.textContent = m[0];
        frag.append(mark);
        last = (m.index ?? 0) + m[0].length;
      }
      frag.append(value.slice(last));
      node.replaceWith(frag);
    }
  }, [html]);

  return <div ref={ref} className="email-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

function EmailFooter() {
  return (
    <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs leading-relaxed text-slate-500">
      <p>You’re receiving The Pack Leader because you’ve worked with or spoken to CBI K9.</p>
      <p className="mt-1">
        Growth Impact Group, LLC · <span className="rounded bg-amber-200 px-1 text-amber-900">[GIG MAILING ADDRESS]</span> ·{" "}
        <span className="underline">Unsubscribe</span>
      </p>
    </footer>
  );
}

import "server-only";
import { extractLinks, extractText, getDocumentProxy } from "unpdf";
import { hostname } from "./problems";
import type { Reference } from "./types";

// Splits a PDF of problems into separate cards. PDFs vary a lot, so this is a
// best guess: the Operator reviews (and can fix) every card before it is saved.
//
// It looks for numbered entries — "1. Missed calls", "2) …", "#3 …",
// "Problem 4: …" — and treats each as one problem: the first line is the title,
// the lines after it are the body, and any links become references. Without
// numbering it falls back to blocks separated by blank lines.

export type ParsedProblem = { title: string; body: string; references: Reference[] };

const START = /^(?:(?:problem|issue|topic)\s*#?\s*(\d{1,3})\b[\s:.)\-–—]*|#\s*(\d{1,3})\b[\s:.)\-–—]*|(\d{1,3})[.)]\s+)(.*)$/i;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

export async function parseProblemsPdf(data: Uint8Array): Promise<{ items: ParsedProblem[]; otherLinks: string[] }> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  let links: string[] = [];
  try {
    links = (await extractLinks(pdf)).links.flat();
  } catch {
    // Some PDFs have no readable link annotations; text links still work.
  }
  const items = splitProblems(text);
  const inText = new Set(items.flatMap((i) => i.references.map((r) => r.url)));
  // Clickable links aren't part of the text, so there is no reliable way to tell
  // which card they belong to (guessing by order attached wrong sources in
  // testing). They're listed on the review screen for the Operator to place.
  const otherLinks = Array.from(new Set(links.filter((l) => /^https?:\/\//.test(l) && !inText.has(l))));
  return { items, otherLinks };
}

export function splitProblems(text: string): ParsedProblem[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    const prev = lines[lines.length - 1];
    // A long link wrapped onto the next line ("…/more-than-eve" + "r"): glue it back.
    if (prev && line && !line.includes(" ") && /https?:\/\/\S+$/.test(prev) && !START.test(line)) {
      lines[lines.length - 1] = prev + line;
    } else {
      lines.push(line);
    }
  }

  // A problem starts at a numbered line, and the numbers must run 1, 2, 3… so
  // stray numbers in the text ("5. Remind them…") don't split a problem in two.
  // Table rows exported to PDF often drop the dot ("1 Slow response"), so a bare
  // number followed by a word also counts when it is the next number in the run.
  const starts: number[] = [];
  let expected = 1;
  lines.forEach((line, i) => {
    const n = numberOf(line);
    if (n === expected) {
      starts.push(i);
      expected++;
    }
  });

  const blocks: string[][] =
    starts.length >= 2
      ? starts.map((s, k) => lines.slice(s, starts[k + 1] ?? lines.length))
      : lines
          .join("\n")
          .split(/\n\s*\n/)
          .map((b) => b.split("\n").filter(Boolean))
          .filter((b) => b.length > 0);

  return blocks.map((block) => toProblem(block, starts.length >= 2)).filter((p) => p.title || p.body);
}

const BARE = /^(\d{1,3})\s+([A-Za-z].*)$/;

function numberOf(line: string): number | null {
  const m = START.exec(line);
  if (m) return Number(m[1] ?? m[2] ?? m[3]);
  const b = BARE.exec(line);
  return b ? Number(b[1]) : null;
}

function toProblem(block: string[], numbered: boolean): ParsedProblem {
  let [first, ...rest] = block;
  if (numbered) {
    const m = START.exec(first);
    first = (m ? m[4] : (BARE.exec(first)?.[2] ?? first)).trim();
    if (!first && rest.length) [first, ...rest] = rest;
  }
  // Titles in table cells wrap ("Slow" / "response to" / "new inquiries"); a short
  // line that starts in lowercase continues the title.
  while (first.length < 60 && rest[0] && rest[0].length < 50 && /^[a-z(]/.test(rest[0]) && !/[.!?:]$/.test(first)) {
    first = `${first} ${rest.shift()}`;
  }
  let title = first;
  // A long first line is probably a paragraph: use its first sentence as the title.
  if (title.length > 140) {
    const sentence = title.match(/^(.{20,140}?[.!?])\s/)?.[1];
    rest = [title.slice((sentence ?? title.slice(0, 120)).length).trim(), ...rest];
    title = sentence ?? `${title.slice(0, 117)}…`;
  }

  const body = joinParagraphs(rest);
  const refs: Reference[] = [];
  for (const raw of (title + "\n" + body).match(URL_RE) ?? []) {
    const url = raw.replace(/[.,;:]+$/, "");
    if (!refs.some((r) => r.url === url)) refs.push({ label: hostname(url) || url, url });
  }
  return { title: title.trim(), body, references: refs };
}

// PDF text breaks lines mid-sentence; rejoin them into paragraphs.
function joinParagraphs(lines: string[]): string {
  const paras: string[] = [];
  let current = "";
  for (const line of lines) {
    if (!line) {
      if (current) paras.push(current);
      current = "";
      continue;
    }
    const startsNewItem = /^([•\-–*]|\d+[.)]|[A-Z][\w ]{0,30}:)\s/.test(line);
    if (current && (startsNewItem || /[.!?:]$/.test(current))) {
      paras.push(current);
      current = line;
    } else {
      current = current ? `${current} ${line}` : line;
    }
  }
  if (current) paras.push(current);
  return paras.join("\n\n").trim();
}

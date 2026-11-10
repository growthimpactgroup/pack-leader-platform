// Helpers for the formatted issue body. The editor stores HTML; the checks
// (word count, fixed lines) run on a plain-text copy derived from it.

export type Margin = "narrow" | "normal" | "wide";

export const MARGINS: { value: Margin; label: string; px: number }[] = [
  { value: "narrow", label: "Narrow", px: 16 },
  { value: "normal", label: "Normal", px: 32 },
  { value: "wide", label: "Wide", px: 56 },
];

export const marginPx = (m?: string) => MARGINS.find((x) => x.value === m)?.px ?? 32;

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Turns an older plain-text body into simple paragraphs.
export function textToHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).filter((b) => b.trim());
  return blocks.map((b) => `<p>${b.split("\n").map(escape).join("<br>")}</p>`).join("");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|h[1-6]|li|blockquote|ul|ol)>/gi, "\n\n")
    .replace(/<hr[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The body as HTML, whether it was written in the editor or is an older plain-text body.
export function bodyHtml(issue: { body: string; bodyHtml?: string }): string {
  return issue.bodyHtml ?? textToHtml(issue.body);
}

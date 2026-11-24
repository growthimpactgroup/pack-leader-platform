import { htmlToText } from "./richtext";

// Checks a draft against common inbox and spam-filter guidance (Google and
// Yahoo sender guidelines, the FTC's CAN-SPAM rules, and widely used
// deliverability practice) plus basic SEO for the web version. These run on
// every generated draft and can be re-read on the email page. They are
// warnings for the writer, not a guarantee of inbox placement.

export type Check = { ok: boolean; label: string; detail: string };

const SPAMMY = [
  "free!", "act now", "limited time", "100% free", "guaranteed", "risk-free", "no obligation", "click here", "buy now",
  "winner", "congratulations", "urgent", "cash", "$$$", "double your", "earn money", "cheap", "lowest price", "order now",
  "special promotion", "this isn't spam", "dear friend", "once in a lifetime", "miracle",
];

export function emailChecks(input: { subject: string; preheader?: string; html: string; keywords?: string[]; metaDescription?: string }): Check[] {
  const subject = input.subject.replace(/^pack leader:\s*/i, "").trim();
  const text = htmlToText(input.html);
  const lower = `${input.subject} ${input.preheader ?? ""} ${text}`.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  const links = (input.html.match(/<a\s/gi) ?? []).length;
  const capsWords = (input.subject.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => !["CBI"].includes(w));
  const spam = SPAMMY.filter((w) => lower.includes(w));
  const checks: Check[] = [
    {
      ok: input.subject.length > 0 && input.subject.length <= 60,
      label: "Subject line length",
      detail: `${input.subject.length} characters. Under about 60 keeps it from being cut off on phones.`,
    },
    {
      ok: capsWords.length === 0 && !/[!?]{2,}/.test(input.subject) && (input.subject.match(/!/g) ?? []).length <= 1,
      label: "No shouting in the subject",
      detail: capsWords.length ? `All-caps words: ${capsWords.join(", ")}.` : "No all-caps words or repeated !!! or ???.",
    },
    {
      ok: spam.length === 0,
      label: "No spam-trigger phrases",
      detail: spam.length ? `Found: ${spam.join(", ")}. Reword these; filters and readers distrust them.` : "None of the common trigger phrases found.",
    },
    {
      ok: !!input.preheader && input.preheader.length >= 35 && input.preheader.length <= 110,
      label: "Preview text (preheader)",
      detail: input.preheader ? `${input.preheader.length} characters. 35–110 shows well next to the subject in most inboxes.` : "Missing. The inbox will show the first line of the email instead.",
    },
    {
      ok: words >= 150 && words <= 650,
      label: "Length",
      detail: `${words} words. 150–650 reads in a couple of minutes and gives filters real text to judge (not just images or links).`,
    },
    {
      ok: links <= 3,
      label: "Few links",
      detail: `${links} link${links === 1 ? "" : "s"}. Three or fewer keeps one clear next step and looks less like spam.`,
    },
    {
      ok: !/bit\.ly|tinyurl|goo\.gl|t\.co\//i.test(input.html),
      label: "No link shorteners",
      detail: "Shortened links are a common spam signal; use full links to trusted sites.",
    },
    {
      ok: true,
      label: "Unsubscribe and mailing address",
      detail: "Added automatically by the email footer (required by CAN-SPAM and by Gmail/Yahoo for bulk senders). Make sure the real GIG address replaces the placeholder before going live.",
    },
  ];
  if (input.keywords?.length) {
    const first100 = text.split(/\s+/).slice(0, 100).join(" ").toLowerCase();
    const main = input.keywords[0].toLowerCase();
    checks.push({
      ok: first100.includes(main) || subject.toLowerCase().includes(main),
      label: "SEO: main search phrase used early",
      detail: `“${input.keywords[0]}” ${first100.includes(main) ? "appears in the first 100 words" : "isn’t in the first 100 words or the subject"}. Helps the web version rank for it.`,
    });
  }
  if (input.metaDescription !== undefined) {
    checks.push({
      ok: input.metaDescription.length >= 70 && input.metaDescription.length <= 160,
      label: "SEO: meta description",
      detail: `${input.metaDescription.length} characters. 70–160 shows fully in Google results when the email is posted on the website.`,
    });
  }
  return checks;
}

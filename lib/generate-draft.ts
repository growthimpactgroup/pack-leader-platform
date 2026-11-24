import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { hostname, splitPhrases } from "./problems";
import type { Problem, Reference } from "./types";

// Writes a first draft of the email body from a content idea with Claude,
// researching only on trusted, primary sources (web search limited to the
// domains below plus the idea's own source sites). Needs ANTHROPIC_API_KEY.
// Every source it used comes back as a link, and links it didn't actually
// open in search are dropped, so nothing is cited that wasn't checked.

export const generatorConfigured = () => !!process.env.ANTHROPIC_API_KEY;

// Plain-language version of the API errors people are most likely to hit.
export function friendlyClaudeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError)
    return "Anthropic didn’t accept the API key. In Vercel, replace ANTHROPIC_API_KEY with the full secret key that starts with sk-ant-api (shown once when the key is created), then redeploy.";
  if (e instanceof Anthropic.PermissionDeniedError) return "This API key isn’t allowed to use Claude. Check the key’s workspace in the Anthropic console.";
  if (e instanceof Anthropic.RateLimitError) return "Anthropic is rate-limiting this account right now. Wait a minute and try again.";
  if (e instanceof Anthropic.BadRequestError && /credit|billing|balance/i.test(e.message))
    return "The Anthropic account has no credit. Add credit under Billing in the Anthropic console, then try again.";
  if (e instanceof Anthropic.APIError) return `Anthropic error ${e.status}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

// Primary and official sources: government, standards bodies, professional
// associations, peer-reviewed journals, and the email providers' own rules.
export const TRUSTED_DOMAINS = [
  // US government
  "census.gov", "bls.gov", "sba.gov", "ftc.gov", "fcc.gov", "cdc.gov", "usda.gov", "nih.gov", "data.gov",
  // Veterinary and pet-industry associations and journals
  "avma.org", "aaha.org", "petsit.com", "americanpetproducts.org", "napps.org", "iaabc.org", "ccpdt.org",
  "ibpsa.com", "groomers.org", "wsava.org", "aspca.org", "humanesociety.org",
  // Research and established publishers
  "pewresearch.org", "hbr.org", "nature.com", "sciencedirect.com", "frontiersin.org", "mdpi.com",
  // Email providers' and standards bodies' own sender guidance
  "support.google.com", "blog.google", "workspace.google.com", "senders.yahooinc.com", "help.yahoo.com",
  "learn.microsoft.com", "m3aawg.org", "dmarc.org",
];

export const TONES = [
  { id: "friendly", label: "Friendly and practical", hint: "Like a peer who also runs a pet business: plain words, helpful, no hype." },
  { id: "expert", label: "Straight-talking expert", hint: "Confident and data-first. Short sentences, no fluff." },
  { id: "warm", label: "Warm and encouraging", hint: "Empathetic, owner to owner. Acknowledges how busy they are." },
  { id: "timely", label: "Timely, calm urgency", hint: "For seasonal pressure. Clear about timing without hype or fake deadlines." },
  { id: "story", label: "Story-led", hint: "Opens with a short, clearly illustrative scenario (never a made-up testimonial)." },
] as const;

// Suggests tones for an idea, best fit first, with a reason.
export function suggestTones(p: Problem): { id: string; reason: string }[] {
  const text = `${p.title} ${p.whyNow ?? ""} ${p.overlooked ?? ""}`.toLowerCase();
  const out: { id: string; reason: string }[] = [];
  if (/holiday|season|december|filling up|before|this week|now\b/.test(text) || p.trend?.direction === "rising")
    out.push({ id: "timely", reason: "The idea is tied to timing (season or a rising search trend)." });
  if (p.stat && /\d/.test(p.stat)) out.push({ id: "expert", reason: "It has a strong sourced number to lead with." });
  if (/trust|quietly|leave|week go|nobody/.test(text)) out.push({ id: "warm", reason: "It touches something personal for owners." });
  out.push({ id: "friendly", reason: "Works for any topic; the safest default." });
  return out.filter((t, i) => out.findIndex((x) => x.id === t.id) === i);
}

export type GeneratedDraft = {
  subject: string;
  altSubjects: string[];
  preheader: string;
  bodyHtml: string; // main body only; the fixed opening and closing lines are added by the caller
  sources: Reference[];
  metaDescription: string;
  keywords: string[];
  writerNotes: string;
  droppedSources: number;
};

const SUBMIT = {
  name: "submit_draft",
  description: "Submit the finished newsletter draft. Call this exactly once, at the end, after researching.",
  strict: true,
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["subject", "alt_subjects", "preheader", "body_html", "sources", "meta_description", "keywords", "writer_notes"],
    properties: {
      subject: { type: "string", description: "Starts with 'Pack Leader: '. Under 60 characters in total." },
      alt_subjects: { type: "array", items: { type: "string" }, description: "Three alternative subject lines, same rules." },
      preheader: { type: "string", description: "Inbox preview text, 40–100 characters, adds to the subject rather than repeating it." },
      body_html: {
        type: "string",
        description:
          "The email body as simple HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a href>. Start with an <h2> headline. Include an <h3>The number</h3> section. Do NOT include an opening greeting line, a sign-off, a P.S., or the line about the CBI dashboard; those are added automatically.",
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "url", "used_for"],
          properties: {
            label: { type: "string", description: "Publisher and title, e.g. 'AVMA, 2025 Pet Ownership Report'." },
            url: { type: "string", description: "The exact URL you read in search results." },
            used_for: { type: "string", description: "Which claim or number in the email this supports." },
          },
        },
      },
      meta_description: { type: "string", description: "For the web version: 120–155 characters, includes the main search phrase." },
      keywords: { type: "array", items: { type: "string" }, description: "Main search phrase first, then 2–4 related ones." },
      writer_notes: { type: "string", description: "One or two sentences for Frances: what to double-check before submitting." },
    },
  },
};

function systemPrompt(): string {
  return `You write The Pack Leader, a weekly email from CBI K9 (a Growth Impact Group brand) to owners of pet-care businesses: boarding, daycare, grooming, training, pet sitting and vet clinics. Each issue covers one costly problem those owners overlook.

Research rules:
- Use the web_search tool to find and confirm facts. It only reaches trusted primary sources (government, professional associations, peer-reviewed research, and the original publishers already cited for this idea).
- Every number in the email must come from a source you actually read in search results, and must be listed in sources with the exact URL. If you can't confirm a number, leave it out. Never estimate or invent numbers, quotes, studies or testimonials.
- Say who a number is about ("US vet clinics", "small businesses in general"); never stretch it to all pet businesses.
- Use exactly one headline number in the "The number" section; supporting facts are fine if sourced.

Newsletter rules (from the Pack Leader Operating Manual):
- Focus on the problem and what it costs the owner. Do not explain how the CBI dashboard fixes it, and do not give step-by-step fixes that are the dashboard's job ("dashboard plays"). No promises about setup, results or timelines.
- Plain, human language for busy owners. Short paragraphs (one to three sentences). 300–500 words in body_html.

Email marketing and deliverability (follow Google and Yahoo sender guidelines and the FTC's CAN-SPAM rules):
- Subject line honest about the content, under 60 characters, no ALL CAPS words, at most one "!", no "free", "act now", "guaranteed", "limited time", "click here", "$$$" or similar spam triggers.
- Preheader adds new information to the subject.
- Mostly text, at most two links in the body, full links to the cited source sites only (no shorteners), one clear idea per email.
- No misleading urgency or fake deadlines.

SEO for the web version of the email:
- Use the main search phrase naturally in the headline or first 100 words, and once in an <h3>. Descriptive link text, never "click here".

When done, call submit_draft once with the finished draft.`;
}

export async function generateDraft(p: Problem, tone: string, notes: string): Promise<GeneratedDraft> {
  const ideaDomains = p.references.map((r) => hostname(r.url)).filter(Boolean);
  const allowed = Array.from(new Set([...ideaDomains, ...TRUSTED_DOMAINS])).slice(0, 64);
  const phrases = splitPhrases(p.searchPhrases);

  const brief = [
    `Subject line idea: ${p.title}`,
    p.overlooked && `What owners aren't paying attention to: ${p.overlooked}`,
    p.whyNow && `Why they care right now: ${p.whyNow}`,
    p.stat && `The headline number (already sourced): ${p.stat}`,
    p.references.length && `Sources already found for this idea:\n${p.references.map((r) => `- ${r.label}: ${r.url}`).join("\n")}`,
    p.notes && `Notes: ${p.notes}`,
    phrases.length && `Search phrases (main one first): ${phrases.join(", ")}`,
    `Tone: ${tone}`,
    notes && `Extra instructions from Frances: ${notes}`,
    `Open the existing sources to confirm the headline number before using it. Search for one or two supporting facts only from the allowed sites.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Trim stray spaces or line breaks a pasted key can pick up.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: brief }];
  const seenUrls = new Set(p.references.map((r) => r.url));

  for (let turn = 0; turn < 4; turn++) {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: systemPrompt(),
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6, allowed_domains: allowed }, SUBMIT],
      messages,
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined to write this draft. Try different instructions.");

    for (const block of response.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === "web_search_result") seenUrls.add(r.url);
      }
    }
    const submit = response.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "submit_draft");
    if (submit) {
      const d = submit.input as {
        subject: string; alt_subjects: string[]; preheader: string; body_html: string;
        sources: { label: string; url: string; used_for: string }[]; meta_description: string; keywords: string[]; writer_notes: string;
      };
      const okHost = (u: string) => allowed.some((dom) => hostname(u) === dom || hostname(u).endsWith(`.${dom}`));
      const kept = d.sources.filter((s) => seenUrls.has(s.url) && okHost(s.url));
      return {
        subject: d.subject.startsWith("Pack Leader:") ? d.subject : `Pack Leader: ${d.subject}`,
        altSubjects: d.alt_subjects.slice(0, 3),
        preheader: d.preheader,
        bodyHtml: d.body_html,
        sources: kept.map((s) => ({ label: `${s.label} (supports: ${s.used_for})`, url: s.url })),
        metaDescription: d.meta_description,
        keywords: d.keywords,
        writerNotes: d.writer_notes,
        droppedSources: d.sources.length - kept.length,
      };
    }
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    // Finished without submitting: ask once more for the draft.
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: "Please call submit_draft now with the finished draft." });
  }
  throw new Error("Claude didn’t finish the draft. Try again.");
}

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Problem, SubjectRating } from "./types";

// Claude rates each subject line for a pet-care business owner's inbox.
// Needs ANTHROPIC_API_KEY (a GIG key). Runs only when an idea is added or its
// subject line changes, so the cost is a fraction of a cent per idea.

export const ratingConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const Rating = z.object({
  score: z.number().int().min(1).max(10),
  reason: z.string(),
});

const SYSTEM = `You judge email subject lines for The Pack Leader, a weekly email from CBI K9 to owners of pet-care businesses (boarding, daycare, grooming, training, pet sitting, vet clinics).

Rate how likely a busy owner is to open the email from the subject line alone, from 1 (would skip) to 10 (would open right away). Reward curiosity, a problem the owner recognises, plain words and specificity. Penalise vagueness, jargon, hype, clickbait that the email can't back up, and anything over about 60 characters.

Give the reason in one short plain sentence (under 25 words) that Frances, the writer, can act on.`;

export async function rateSubject(p: Problem): Promise<SubjectRating> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    // Server-side fallback if the model declines; routes automatically.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Rating) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Subject line: ${p.title}\n\nWhat the email is about: ${p.overlooked || p.body || p.stat || "(no summary yet)"}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to rate this subject line.");
  const out = response.parsed_output;
  if (!out) throw new Error("Claude's rating couldn't be read.");
  return { score: out.score, reason: out.reason, forTitle: p.title, ratedAt: new Date().toISOString() };
}

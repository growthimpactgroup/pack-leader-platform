"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { rateSubject, ratingConfigured } from "@/lib/ai-rating";
import { rateSubjectLines, refreshTrends } from "@/lib/refresh";
import { friendlyClaudeError, generateDraft, generatorConfigured } from "@/lib/generate-draft";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import { parseProblemsPdf } from "@/lib/pdf-problems";
import { formatCode, parseReferences, suggestedPhrasesFor, topicLabel } from "@/lib/problems";
import { htmlToText, textToHtml } from "@/lib/richtext";
import { upcomingWednesdays } from "@/lib/schedule";
import { updateDb } from "@/lib/store";
import type { Db, Issue, Problem, Reference, TopicContext, User } from "@/lib/types";

const now = () => new Date().toISOString();
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (path: string, error?: string): never => {
  revalidatePath("/", "layout");
  redirect(error ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path);
};

const context = (f: FormData): TopicContext => ({
  overlooked: str(f, "overlooked"),
  whyNow: str(f, "whyNow"),
  stat: str(f, "stat"),
  searchPhrases: str(f, "searchPhrases"),
});

function addProblem(db: Db, user: User, p: TopicContext & { title: string; body: string; references: Reference[]; notes: string; source: string }): Problem {
  db.problemSeq = Math.max(db.problemSeq, ...db.problems.map((x) => Number(x.code.slice(3)) || 0)) + 1;
  const problem: Problem = {
    id: crypto.randomUUID(),
    code: formatCode(db.problemSeq),
    ...p,
    createdAt: now(),
    createdBy: user.name,
    updatedAt: now(),
  };
  db.problems.push(problem);
  return problem;
}

// ---------- Add / edit / delete ----------

export async function createProblem(formData: FormData) {
  const user = await requireRole("operator");
  const title = str(formData, "title");
  if (!title) done("/problems/new", "Write a subject line idea.");
  const problem = await updateDb((db) =>
    addProblem(db, user, {
      title,
      ...context(formData),
      body: str(formData, "body"),
      references: parseReferences(str(formData, "references")),
      notes: str(formData, "notes"),
      source: "Added by hand",
    }),
  );
  await rateOne(problem.id);
  done(`/problems/${problem.id}`);
}

export async function updateProblem(formData: FormData) {
  await requireRole("operator");
  const id = str(formData, "id");
  const title = str(formData, "title");
  if (!title) done(`/problems/${id}`, "Write a subject line idea.");
  await updateDb((db) => {
    const p = db.problems.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, {
      title,
      ...context(formData),
      body: str(formData, "body"),
      references: parseReferences(str(formData, "references")),
      notes: str(formData, "notes"),
      updatedAt: now(),
    });
  });
  await rateOne(id);
  done(`/problems/${id}?saved=1`);
}

export async function deleteProblem(formData: FormData) {
  await requireRole("operator", "approver");
  const id = str(formData, "id");
  await updateDb((db) => {
    db.problems = db.problems.filter((p) => p.id !== id);
    // Drafts made from it keep their own copy of the text and the topic number.
  });
  done("/problems?deleted=1");
}

// ---------- Create a draft ----------

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function createDraftFromProblem(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "id");
  const result = await updateDb((db) => {
    const p = db.problems.find((x) => x.id === id);
    if (!p) return { error: "That topic no longer exists." };
    const taken = new Set(db.issues.map((i) => i.issueDate));
    const issueDate = upcomingWednesdays(26).find((d) => !taken.has(d));
    if (!issueDate) return { error: "Every Wednesday in the next six months already has an issue." };
    const number = db.issues.reduce((max, i) => Math.max(max, i.number), 0) + 1;

    // Starting text: the topic's framing plus the manual's fixed lines, ready to edit.
    const bodyHtml =
      `<p>[OPENING LINE: human writes]</p>` +
      `<h2>${escape(p.title)}</h2>` +
      [p.overlooked, p.whyNow].filter(Boolean).map((t) => textToHtml(t!)).join("") +
      (p.stat ? `<h3>The number</h3>${textToHtml(p.stat)}` : "") +
      (p.body ? textToHtml(p.body) : "") +
      `<p>This is one of the problems the CBI dashboard was built to solve.</p>` +
      `<p>- The CBI K9 team</p>` +
      `<p>P.S. Not a CBI client yet? Book a 15-minute call: [BOOKING LINK]</p>`;

    const issue: Issue = {
      id: crypto.randomUUID(),
      number,
      issueDate,
      stage: "DRAFT",
      subject: `Pack Leader: ${p.title}`,
      altSubjects: "",
      body: "",
      bodyHtml,
      bodyMargin: "normal",
      problemOfWeek: `${topicLabel(p.code)} · ${p.title}`,
      problemId: p.id,
      problemCode: p.code,
      problemTitle: p.title,
      // Each reference becomes a claim to verify; the Operator still opens and reads each one.
      checklist: p.references.map((r, i) => ({ id: String(i), claim: r.label, source: r.url, verified: false })),
      ruleCheck: { noDashboardPlays: false, noSetupPromises: false, noUnsourcedNumbers: false, fixedLinesExact: false },
      flags: "",
      testEmailSentAt: null,
      submittedAt: null,
      scorecard: null,
      decision: null,
      scheduledFor: null,
      sentAt: null,
      holdReason: null,
      results: { openRate: "", replies: "", callsBooked: "", notes: "" },
      history: [{ at: now(), by: user.name, role: user.role, action: `Created Pack Leader #${number} from ${topicLabel(p.code)} (Subject line and content ideas)` }],
      createdAt: now(),
      updatedAt: now(),
    };
    issue.body = htmlToText(bodyHtml);
    db.issues.push(issue);
    return { issueId: issue.id };
  });
  if ("error" in result) done(`/problems/${id}`, result.error);
  done(`/issues/${result.issueId}`);
}

// ---------- PDF import ----------

const MAX_BYTES = 4 * 1024 * 1024;

export async function uploadProblemsPdf(formData: FormData) {
  const user = await requireRole("operator");
  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) done("/problems", "Choose a PDF to upload.");
  const pdf = file as File;
  if (pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) done("/problems", "That file isn't a PDF.");
  if (pdf.size > MAX_BYTES) done("/problems", "That PDF is over 4 MB. Split it into smaller files.");

  let parsed: Awaited<ReturnType<typeof parseProblemsPdf>>;
  try {
    parsed = await parseProblemsPdf(new Uint8Array(await pdf.arrayBuffer()));
  } catch {
    return done("/problems", "Couldn't read that PDF. If it's a scanned image, it has no text to read.");
  }
  if (parsed.items.length === 0) done("/problems", "No text found in that PDF. Scanned PDFs need to be converted to text first.");

  const importId = await updateDb((db) => {
    const id = crypto.randomUUID();
    db.imports = [
      ...db.imports.filter((i) => Date.now() - new Date(i.createdAt).getTime() < 7 * 864e5), // drop week-old reviews
      {
        id,
        fileName: pdf.name,
        createdAt: now(),
        createdBy: user.name,
        items: parsed.items,
        ...(parsed.otherLinks.length ? { otherLinks: parsed.otherLinks } : {}),
      },
    ];
    return id;
  });
  done(`/problems/import/${importId}`);
}

export async function confirmImport(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "importId");
  const include = new Set(formData.getAll("include").map(String));
  const titles = formData.getAll("title").map(String);
  const bodies = formData.getAll("body").map(String);
  const refs = formData.getAll("references").map(String);
  const all = (k: string) => formData.getAll(k).map((v) => String(v).trim());
  const [overlooked, whyNow, stat, notes, searchPhrases] = [all("overlooked"), all("whyNow"), all("stat"), all("notes"), all("searchPhrases")];
  const added = await updateDb((db) => {
    const imp = db.imports.find((i) => i.id === id);
    if (!imp) return 0;
    let count = 0;
    titles.forEach((title, i) => {
      if (!include.has(String(i)) || !title.trim()) return;
      addProblem(db, user, {
        title: title.trim(),
        overlooked: overlooked[i] ?? "",
        searchPhrases: searchPhrases[i] || suggestedPhrasesFor(title) || "",
        whyNow: whyNow[i] ?? "",
        stat: stat[i] ?? "",
        body: (bodies[i] ?? "").trim(),
        references: parseReferences(refs[i] ?? ""),
        notes: notes[i] ?? "",
        source: `Uploaded: ${imp.fileName}`,
      });
      count++;
    });
    db.imports = db.imports.filter((i) => i.id !== id);
    return count;
  });
  done(`/problems?added=${added}`);
}

export async function discardImport(formData: FormData) {
  await requireRole("operator");
  const id = str(formData, "importId");
  await updateDb((db) => {
    db.imports = db.imports.filter((i) => i.id !== id);
  });
  done("/problems");
}

// Fills the drafted search phrases into ideas that don't have any yet.
export async function fillSuggestedPhrases() {
  await requireRole("operator");
  const filled = await updateDb((db) => {
    let n = 0;
    for (const p of db.problems) {
      const phrases = suggestedPhrasesFor(p.title);
      if (phrases && !p.searchPhrases?.trim()) {
        p.searchPhrases = phrases;
        p.updatedAt = now();
        n++;
      }
    }
    return n;
  });
  done(`/problems?phrases=${filled}`);
}

// Claude rates the subject line when it is new or has changed. A failure here
// never blocks saving; the rating is just left for the next run.
async function rateOne(id: string) {
  if (!ratingConfigured()) return;
  const p = (await updateDb((db) => structuredClone(db.problems.find((x) => x.id === id)))) as Problem | undefined;
  if (!p || p.aiRating?.forTitle === p.title) return;
  try {
    const rating = await rateSubject(p);
    await updateDb((db) => {
      const target = db.problems.find((x) => x.id === id);
      if (target) target.aiRating = rating;
    });
  } catch {
    // Left unrated; "Rate subject lines" or the weekly job will retry.
  }
}

const summary = (what: string, r: { done: number; failed: number; skipped: string | null; error?: string }) =>
  r.skipped ?? `${what}: ${r.done} done${r.failed ? `, ${r.failed} failed (${r.error})` : ""}.`;

export async function refreshTrendsNow() {
  await requireRole("operator");
  done(`/problems?refreshed=${encodeURIComponent(summary("Trends checked", await refreshTrends()))}`);
}

export async function rateSubjectLinesNow() {
  await requireRole("operator");
  done(`/problems?refreshed=${encodeURIComponent(summary("Subject lines rated", await rateSubjectLines()))}`);
}

// ---------- Generate a draft with Claude ----------

export async function generateDraftFromProblem(formData: FormData) {
  const user = await requireRole("operator");
  const id = str(formData, "id");
  const back = `/problems/${id}/generate`;
  if (!generatorConfigured()) done(back, "Claude isn’t connected yet (ANTHROPIC_API_KEY missing in Vercel).");
  const tone = str(formData, "customTone") || str(formData, "tone") || "Friendly and practical";
  const notes = str(formData, "notes");

  const problem = (await updateDb((db) => structuredClone(db.problems.find((x) => x.id === id)))) as Problem | undefined;
  if (!problem) done("/problems", "That idea no longer exists.");

  let draft: Awaited<ReturnType<typeof generateDraft>>;
  try {
    draft = await generateDraft(problem!, tone, notes);
  } catch (e) {
    return done(back, `Couldn’t generate the draft. ${friendlyClaudeError(e)}`);
  }

  const result = await updateDb((db) => {
    const p = db.problems.find((x) => x.id === id);
    if (!p) return { error: "That idea no longer exists." };
    const taken = new Set(db.issues.map((i) => i.issueDate));
    const issueDate = upcomingWednesdays(26).find((d) => !taken.has(d));
    if (!issueDate) return { error: "Every Wednesday in the next six months already has an issue." };
    const number = db.issues.reduce((max, i) => Math.max(max, i.number), 0) + 1;

    // The manual's fixed lines wrap the generated body exactly as written.
    const bodyHtml = sanitizeEmailHtml(
      `<p>[OPENING LINE: human writes]</p>` +
        draft.bodyHtml +
        `<p>This is one of the problems the CBI dashboard was built to solve.</p>` +
        `<p>- The CBI K9 team</p>` +
        `<p>P.S. Not a CBI client yet? Book a 15-minute call: [BOOKING LINK]</p>`,
    );

    // New sources also go onto the idea, so they're kept for next time.
    for (const s of draft.sources) if (!p.references.some((r) => r.url === s.url)) p.references.push(s);

    const issue: Issue = {
      id: crypto.randomUUID(),
      number,
      issueDate,
      stage: "DRAFT",
      subject: draft.subject,
      altSubjects: draft.altSubjects.join("\n"),
      preheader: draft.preheader,
      body: "",
      bodyHtml,
      bodyMargin: "normal",
      problemOfWeek: `${topicLabel(p.code)} · ${p.title}`,
      problemId: p.id,
      problemCode: p.code,
      problemTitle: p.title,
      // Every source becomes a claim to verify; Frances still opens and reads each one.
      checklist: draft.sources.map((r, i) => ({ id: String(i), claim: r.label, source: r.url, verified: false })),
      ruleCheck: { noDashboardPlays: false, noSetupPromises: false, noUnsourcedNumbers: false, fixedLinesExact: false },
      flags: draft.writerNotes,
      testEmailSentAt: null,
      submittedAt: null,
      scorecard: null,
      decision: null,
      scheduledFor: null,
      sentAt: null,
      holdReason: null,
      results: { openRate: "", replies: "", callsBooked: "", notes: "" },
      generated: {
        tone,
        at: now(),
        metaDescription: draft.metaDescription,
        keywords: draft.keywords,
        writerNotes: draft.writerNotes,
        sourceCount: draft.sources.length,
        droppedSources: draft.droppedSources,
      },
      history: [{ at: now(), by: user.name, role: user.role, action: `Generated Pack Leader #${number} from ${topicLabel(p.code)} with Claude (tone: ${tone})` }],
      createdAt: now(),
      updatedAt: now(),
    };
    issue.body = htmlToText(bodyHtml);
    db.issues.push(issue);
    return { issueId: issue.id };
  });
  if ("error" in result) done(back, result.error);
  done(`/issues/${result.issueId}?generated=1`);
}

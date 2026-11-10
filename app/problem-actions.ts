"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { parseProblemsPdf } from "@/lib/pdf-problems";
import { formatCode, parseReferences } from "@/lib/problems";
import { htmlToText, textToHtml } from "@/lib/richtext";
import { upcomingWednesdays } from "@/lib/schedule";
import { updateDb } from "@/lib/store";
import type { Db, Issue, Problem, Reference, User } from "@/lib/types";

const now = () => new Date().toISOString();
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (path: string, error?: string): never => {
  revalidatePath("/", "layout");
  redirect(error ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path);
};

function addProblem(db: Db, user: User, p: { title: string; body: string; references: Reference[]; notes: string; source: string }): Problem {
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
  if (!title) done("/problems/new", "Give the problem a title.");
  const problem = await updateDb((db) =>
    addProblem(db, user, {
      title,
      body: str(formData, "body"),
      references: parseReferences(str(formData, "references")),
      notes: str(formData, "notes"),
      source: "Added by hand",
    }),
  );
  done(`/problems/${problem.id}`);
}

export async function updateProblem(formData: FormData) {
  await requireRole("operator");
  const id = str(formData, "id");
  const title = str(formData, "title");
  if (!title) done(`/problems/${id}`, "Give the problem a title.");
  await updateDb((db) => {
    const p = db.problems.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, {
      title,
      body: str(formData, "body"),
      references: parseReferences(str(formData, "references")),
      notes: str(formData, "notes"),
      updatedAt: now(),
    });
  });
  done(`/problems/${id}?saved=1`);
}

export async function deleteProblem(formData: FormData) {
  await requireRole("operator", "approver");
  const id = str(formData, "id");
  await updateDb((db) => {
    db.problems = db.problems.filter((p) => p.id !== id);
    // Drafts made from it keep their own copy of the text and the PB code.
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
    if (!p) return { error: "That problem no longer exists." };
    const taken = new Set(db.issues.map((i) => i.issueDate));
    const issueDate = upcomingWednesdays(26).find((d) => !taken.has(d));
    if (!issueDate) return { error: "Every Wednesday in the next six months already has an issue." };
    const number = db.issues.reduce((max, i) => Math.max(max, i.number), 0) + 1;

    // Starting text: the problem itself plus the manual's fixed lines, ready to edit.
    const bodyHtml =
      `<p>[OPENING LINE: human writes]</p>` +
      `<h2>${escape(p.title)}</h2>` +
      textToHtml(p.body) +
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
      problemOfWeek: `${p.code} · ${p.title}`,
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
      history: [{ at: now(), by: user.name, role: user.role, action: `Created Pack Leader #${number} from ${p.code} (Problem Bank)` }],
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
  const added = await updateDb((db) => {
    const imp = db.imports.find((i) => i.id === id);
    if (!imp) return 0;
    let count = 0;
    titles.forEach((title, i) => {
      if (!include.has(String(i)) || !title.trim()) return;
      addProblem(db, user, {
        title: title.trim(),
        body: (bodies[i] ?? "").trim(),
        references: parseReferences(refs[i] ?? ""),
        notes: "",
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

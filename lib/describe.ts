import type { Issue, Problem } from "./types";

// One or two sentences that say what the email is about: the topic's framing if
// it came from Topic ideas, otherwise the start of the email text.
export function describeIssue(issue: Issue, problems: Problem[]): string {
  const topic = issue.problemId ? problems.find((p) => p.id === issue.problemId) : undefined;
  const source =
    topic?.overlooked ||
    issue.body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("[") && !/^(the number|this is one of the problems|- the cbi|p\.s\.)/i.test(l) && l !== topic?.title && !issue.subject.endsWith(l))
      .join(" ");
  if (!source) return "";
  const sentences = source.match(/[^.!?]+[.!?]+/g) ?? [source];
  let out = "";
  for (const s of sentences.slice(0, 2)) {
    if ((out + s).length > 240 && out) break;
    out += s;
  }
  return out.trim().length > 260 ? `${out.trim().slice(0, 257)}…` : out.trim();
}


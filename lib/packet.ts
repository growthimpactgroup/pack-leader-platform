// Automatic checks shown beside the Operator's own rule check.
export const FIXED_LINES = [
  { label: "Problem-of-the-week line", text: "This is one of the problems the CBI dashboard was built to solve." },
  { label: "P.S. line", text: "Not a CBI client yet? Book a 15-minute call" },
];

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function autoChecks(subject: string, body: string) {
  const words = wordCount(body);
  const subjectWords = wordCount(subject.replace(/^Pack Leader:\s*/, ""));
  return [
    { label: 'Subject starts "Pack Leader:"', ok: /^Pack Leader: \S/.test(subject) },
    { label: `Subject under 8 words (${subjectWords})`, ok: subjectWords > 0 && subjectWords <= 8 },
    { label: `Two-minute read: 350–450 words (${words})`, ok: words >= 350 && words <= 450 },
    ...FIXED_LINES.map((l) => ({ label: `${l.label} word for word`, ok: body.includes(l.text) })),
  ];
}

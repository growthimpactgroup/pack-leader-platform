import "server-only";
import { demoMode } from "./demo";
import { bodyHtml, htmlToText, marginPx } from "./richtext";
import { formatBoth, formatDate } from "./schedule";
import type { Issue, Role } from "./types";

// Email sending through Resend (https://resend.com), configured by:
//   RESEND_API_KEY   — required to send anything
//   EMAIL_FROM       — sender, e.g. "The Pack Leader <pack-leader@your-domain>"
//   APP_URL          — link back to the platform in notifications
//   OPERATOR_EMAIL / APPROVER_EMAIL / REVIEWER_EMAIL — real recipients once demo mode is off
//   DEMO_MODE / DEMO_RECIPIENT — see lib/demo.ts
//
// In demo mode every email goes to DEMO_RECIPIENT, tagged with who it was meant for.

const API = "https://api.resend.com/emails";
const appUrl = () => (process.env.APP_URL || "https://pack-leader-platform.vercel.app").replace(/\/$/, "");
const from = () => process.env.EMAIL_FROM || "The Pack Leader <onboarding@resend.dev>";

const ROLE_NAME: Record<Role, string> = { operator: "the Operator", approver: "Grace (Final Approver)", reviewer: "the Review Agent" };
const roleEmail = (role: Role) =>
  ({ operator: process.env.OPERATOR_EMAIL, approver: process.env.APPROVER_EMAIL, reviewer: process.env.REVIEWER_EMAIL })[role] ?? "";

export type SendResult = { ok: true; id: string; to: string } | { ok: false; error: string };

type Outgoing = { to: string; intendedFor: string; subject: string; html: string; scheduledAt?: string };

// Decides the real recipient. In demo mode that is always the demo address.
function route(intendedEmail: string, intendedFor: string): { to: string; tag: string } | { error: string } {
  const demo = demoMode();
  if (demo.on) {
    if (!demo.recipient) return { error: "Demo mode is on but DEMO_RECIPIENT is not set." };
    return { to: demo.recipient, tag: `[DEMO · for ${intendedFor}] ` };
  }
  if (!intendedEmail) return { error: `No email address is set for ${intendedFor}.` };
  return { to: intendedEmail, tag: "" };
}

async function send({ to, intendedFor, subject, html, scheduledAt }: Outgoing): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email isn't set up yet (RESEND_API_KEY missing)." };
  const target = route(to, intendedFor);
  if ("error" in target) return { ok: false, error: target.error };
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from(),
        to: [target.to],
        subject: target.tag + subject,
        html,
        ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !data.id) return { ok: false, error: data.message || `Resend error ${res.status}` };
    return { ok: true, id: data.id, to: target.to };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function cancelScheduled(id: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch(`${API}/${id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${key}` } }).catch(() => null);
  return !!res?.ok;
}

// ---------- The newsletter ----------

// The newsletter goes to the list in real life; in demo mode it comes to the demo address.
export function sendNewsletter(issue: Issue, opts: { test?: boolean; scheduledAt?: string } = {}) {
  const intendedFor = opts.test ? ROLE_NAME.approver : "the pack-leader list";
  const subject = (opts.test ? "[TEST] " : "") + (issue.subject || `Pack Leader #${issue.number}`);
  return send({
    to: opts.test ? roleEmail("approver") : "",
    intendedFor,
    subject,
    html: newsletterHtml(issue),
    scheduledAt: opts.scheduledAt,
  });
}

const BLOCK_STYLES: Record<string, string> = {
  h1: "font-size:26px;line-height:1.25;font-weight:700;color:#0f172a;margin:0 0 12px",
  h2: "font-size:21px;line-height:1.3;font-weight:700;color:#0f172a;margin:0 0 12px",
  h3: "font-size:12px;line-height:1.4;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4338ca;border-bottom:2px solid #4f46e5;padding-bottom:4px;margin:20px 0 10px",
  p: "margin:0 0 12px",
  ul: "margin:0 0 12px;padding-left:24px",
  ol: "margin:0 0 12px;padding-left:24px",
  li: "margin:0 0 4px",
  blockquote: "margin:0 0 12px;border-left:3px solid #cbd5e1;padding-left:12px;color:#475569;font-style:italic",
  hr: "border:0;border-top:1px solid #e2e8f0;margin:20px 0",
  a: "color:#4f46e5;text-decoration:underline",
};

// Email clients ignore most stylesheets, so the editor's look is written inline.
function inlineStyles(html: string): string {
  let out = html.replace(/<li([^>]*)>\s*<p([^>]*)>([\s\S]*?)<\/p>/g, "<li$1><span$2>$3</span>");
  for (const [tag, style] of Object.entries(BLOCK_STYLES)) {
    out = out.replace(new RegExp(`<${tag}(\\s[^>]*)?>`, "g"), (_m, attrs = "") => {
      const existing = /style="([^"]*)"/.exec(attrs);
      if (existing) return `<${tag}${attrs.replace(existing[0], `style="${style};${existing[1]}"`)}>`;
      return `<${tag}${attrs} style="${style}">`;
    });
  }
  return out;
}

export function newsletterHtml(issue: Issue): string {
  const body = inlineStyles(bodyHtml(issue));
  const pad = marginPx(issue.bodyMargin);
  const preheader = htmlToText(issue.bodyHtml ?? issue.body).split("\n").find((l) => l.trim()) ?? "";
  const demo = demoMode().on
    ? `<tr><td style="background:#fef3c7;color:#92400e;font-size:12px;padding:8px ${pad}px;text-align:center">DEMO MODE: this would go to the pack-leader list. It was sent only to you.</td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px">
${demo}
<tr><td style="padding:28px ${pad}px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b">${body}</td></tr>
<tr><td style="padding:16px ${pad}px 24px;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b;text-align:center">
You’re receiving The Pack Leader because you’ve worked with or spoken to CBI K9.<br>
Growth Impact Group, LLC · [GIG MAILING ADDRESS] · <a href="#" style="color:#64748b">Unsubscribe</a>
</td></tr></table></td></tr></table></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------- Workflow notifications ----------

const FOOTER = `<p style="margin:0;font-size:12px;color:#64748b">The Pack Leader approval platform · Growth Impact Group</p>`;
const wrap = (inner: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:560px">${inner}${FOOTER}</div>`;
const button = (href: string, label: string) =>
  `<p style="margin:0 0 16px"><a href="${href}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(label)}</a></p>`;

export async function notify(roles: Role[], issue: Issue, headline: string, detail?: string): Promise<SendResult[]> {
  const html = wrap(`<p style="margin:0 0 12px"><strong>${escapeHtml(headline)}</strong></p>
${detail ? `<p style="margin:0 0 12px;white-space:pre-wrap">${escapeHtml(detail)}</p>` : ""}
<p style="margin:0 0 12px">Subject line: ${escapeHtml(issue.subject || "—")}</p>
${button(`${appUrl()}/issues/${issue.id}`, `Open Pack Leader #${issue.number}`)}`);
  return Promise.all(
    roles.map((role) => send({ to: roleEmail(role), intendedFor: ROLE_NAME[role], subject: `Pack Leader #${issue.number}: ${headline}`, html })),
  );
}

// ---------- Daily schedule (8:00 pm Philippine time) ----------

export type DailySchedule = {
  upcoming: Issue[]; // scheduled to send in the next 24 hours
  unscheduled: Issue[]; // planned for today (Pacific) but not scheduled, sent or held
  next: Issue | null; // the next scheduled send after that window
};

export function sendDailySchedule(day: DailySchedule, now: Date): Promise<SendResult> {
  const line = (i: Issue, extra: string) =>
    `<li style="margin:0 0 8px"><a href="${appUrl()}/issues/${i.id}" style="color:#4f46e5"><strong>Pack Leader #${i.number}</strong></a> — ${escapeHtml(i.subject || "no subject yet")}<br><span style="color:#475569">${escapeHtml(extra)}</span></li>`;
  const list = (items: string[]) => `<ul style="margin:0 0 16px;padding-left:20px">${items.join("")}</ul>`;

  const parts: string[] = [];
  if (day.upcoming.length) {
    parts.push(`<p style="margin:0 0 8px"><strong>Going out in the next 24 hours</strong></p>`);
    parts.push(list(day.upcoming.map((i) => line(i, `Sends ${formatBoth(new Date(i.scheduledFor!))}`))));
  } else {
    parts.push(`<p style="margin:0 0 12px"><strong>Nothing is scheduled to go out in the next 24 hours.</strong></p>`);
  }
  if (day.unscheduled.length) {
    parts.push(`<p style="margin:0 0 8px;color:#b45309"><strong>Planned for today but not scheduled</strong></p>`);
    parts.push(list(day.unscheduled.map((i) => line(i, `Planned for ${formatDate(i.issueDate)} · stage: ${i.stage.replace(/_/g, " ").toLowerCase()}`))));
  }
  if (day.next) {
    parts.push(`<p style="margin:0 0 8px"><strong>Next scheduled after that</strong></p>`);
    parts.push(list([line(day.next, `Sends ${formatBoth(new Date(day.next.scheduledFor!))}`)]));
  }

  const subject = day.upcoming.length
    ? `Today's schedule: ${day.upcoming.map((i) => `#${i.number}`).join(", ")} going out`
    : "Today's schedule: nothing going out";
  const html = wrap(`<p style="margin:0 0 12px;color:#64748b;font-size:13px">Daily schedule · ${escapeHtml(formatBoth(now))}</p>
${parts.join("\n")}
${button(`${appUrl()}/schedule`, "Open the schedule")}`);
  return send({ to: roleEmail("operator"), intendedFor: ROLE_NAME.operator, subject: `Pack Leader — ${subject}`, html });
}

# The Pack Leader — Approvals

Approval and scheduling platform for **The Pack Leader**, CBI K9's weekly email.
A Growth Impact Group system.

Live: https://pack-leader-platform.vercel.app (Vercel team `growth-impact-group`).
Pushing to `main` deploys to production. It follows the Pack Leader Operating Manual v2.0:
section 7 (approval workflow), Appendix A5 (Approval Packet) and A6 (logs).

## What it does

- **Pipeline** — every issue by stage: Draft → Ready for review → Changes requested → Approved → Sent, or Held.
- **Approval Packet** — subject line, full issue text, verification checklist, rule check,
  flags and test-email confirmation. Submitting is blocked until every claim has a source
  marked "opened and read", all four rule checks are ticked and the test email is sent.
- **Review Agent scorecard** — PASS / FIX / BLOCK, value score and required fixes. Advice only.
- **Grace's decision** — only the Final Approver login can approve. Approval writes the
  permanent record `APPROVED — Pack Leader #N — date — Grace`.
- **Scheduling** — only after approval, only by the Operator. Suggests Wednesday 10:00 am PT,
  or Thursday 10:00 am PT if approval missed Wednesday 9:00 am. Any edit after approval sends
  the issue back for approval.
- **Timing alerts** — packet due Tuesday 3:00 pm, approval by Wednesday 9:00 am, held after
  Thursday 12:00 pm (all Pacific).
- **Logs** — Approval Log and Send Log fill in automatically; Run Log lines are added by hand.

Not connected yet (paused on purpose): GoHighLevel, the Claude Projects, Grok and Perplexity.
The Operator still schedules the send in GoHighLevel and records it here.

## Sign-in

One Basic Auth login per role, set by environment variables (see `.env.example`):
Operator, Final Approver (Grace) and Review Agent. The role decides what each person can do.

## Local development

```bash
cp .env.example .env.local   # fill in the logins
npm install
npm run dev
```

Without `DATABASE_URL`, data is stored in `data/db.json` (local only, not committed).

## Database (Supabase)

Production data lives in Supabase Postgres. Set these in Vercel (team `growth-impact-group`,
project `pack-leader-platform`):

- `DATABASE_URL` — the Supabase connection string (the Vercel Supabase integration sets
  `POSTGRES_URL`, which also works).
- `DATABASE_CA_CERT` — contents of Supabase's root CA certificate (Project Settings → Database →
  SSL configuration → Download certificate), so the connection is verified.

On first use the app creates a private `pack_leader` schema with one table, `state`, with
row-level security on. Supabase's public Data API doesn't expose that schema.

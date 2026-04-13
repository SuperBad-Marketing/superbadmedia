# B1 — Sentry + reportIssue + cost alerts — Session Brief

> Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0 + §G11.b rolling cadence.
> Written by A8 (Wave 1 closing session) against current repo state 2026-04-13.
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** B1
- **Wave:** 2 — Foundation B
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** medium

## 2. Spec references

- `BUILD_PLAN.md` Wave 2 §B1 — owner block (full description).
- `docs/specs/cost-usage-observatory.md` §4.1 `external_call_log` — confirms the cost-aggregation columns B1's alert wiring reads from.
- `FOUNDATIONS.md` §11.1 — `logActivity()` usage (B1 logs `support_ticket_created` kind).
- `sessions/a8-handoff.md` §"Open threads for B1" — NextAuth session shape + PATCHES_OWED context.

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md B1)

```
B1 — Sentry + reportIssue + cost alerts
- Sentry SDK wired: client + server + edge runtimes. Fingerprint-based
  dedupe. `SENTRY_DSN` env var declared + validated at boot in lib/env.ts.
- `lib/support/reportIssue(context)` callable from every client-facing
  surface. Context shape: { surface: string, page: string, description?:
  string }.
- "Report an issue" footer button global — renders on every admin page.
- `support_tickets` table: id, user_id, surface, page_url, description,
  session_replay_url, sentry_issue_id, status (open/resolved), created_at_ms,
  resolved_at_ms.
- `/lite/admin/errors` triage dashboard — lists open support tickets,
  links to Sentry issue URL.
- Cost-alert thresholds wired: email Andy when Anthropic daily AUD cap,
  Stripe fee anomaly multiplier, or Resend bounce rate threshold is crossed.
  Uses settings.get() for all three thresholds; calls sendEmail() with
  classification 'transactional'.
- npx tsc --noEmit → zero errors.
- npm test → green.
- npm run build → clean (pre-existing Google Fonts 403 in sandbox is a
  known environment limitation and not a regression gate — consistent with
  A7/A8 precedent).
```

## 4. Skill whitelist

- `nextauth` — reading `auth()` session in Server Components + Sentry user context binding.

(B1 is primarily a third-party SDK integration; no additional skills needed.)

## 5. File whitelist (G2 scope discipline)

- `lib/support/report-issue.ts` — `reportIssue(context)` primitive (`new`)
- `lib/db/schema/support-tickets.ts` — `support_tickets` table (`new`)
- `lib/db/migrations/0005_b1_support_sentry.sql` — B1 tables (`new`)
- `lib/env.ts` — add `SENTRY_DSN` validation (`edit`)
- `app/lite/admin/errors/page.tsx` — triage dashboard (`new`)
- `app/lite/admin/errors/actions.ts` — Server Actions for the dashboard (`new`)
- `components/lite/report-issue-button.tsx` — global footer button (`new`)
- `app/layout.tsx` — mount ReportIssueButton globally + Sentry init (`edit`)
- `instrumentation.ts` (or `instrumentation.node.ts`) — Sentry server init (`new`)
- `lib/db/schema/index.ts` — add `support-tickets` export (`edit`)
- `lib/auth/permissions.ts` — add `/lite/admin/errors` rule (`edit`)
- `tests/report-issue.test.ts` — unit tests for `reportIssue()` (`new`)
- `tests/support-tickets.test.ts` — schema smoke tests (`new`)
- `.env.example` — add `SENTRY_DSN` (`edit`)
- `package.json` + lock — `@sentry/nextjs` (`edit`)

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** `alerts.anthropic_daily_cap_aud`, `alerts.stripe_fee_anomaly_multiplier`, `alerts.resend_bounce_rate_threshold` (all seeded by A5 — verify below).
- **Seeds (new keys):** none.

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] Foundation-A complete: `ls sessions/a8-handoff.md`
- [ ] `logActivity()` exported from `@/lib/activity-log` — verify: `grep "export async function logActivity" lib/activity-log.ts`
- [ ] `sendEmail()` exported from `@/lib/channels/email` — verify: `grep "export async function sendEmail" lib/channels/email/send.ts`
- [ ] `external_call_log` table exists — verify: `grep "external_call_log" lib/db/schema/external-call-log.ts`
- [ ] `alerts.anthropic_daily_cap_aud` seeded — verify: `grep "anthropic_daily_cap_aud" lib/db/migrations/0001_seed_settings.sql`
- [ ] `alerts.stripe_fee_anomaly_multiplier` seeded — verify: `grep "stripe_fee_anomaly_multiplier" lib/db/migrations/0001_seed_settings.sql`
- [ ] `alerts.resend_bounce_rate_threshold` seeded — verify: `grep "resend_bounce_rate_threshold" lib/db/migrations/0001_seed_settings.sql`
- [ ] `auth()` importable from `@/lib/auth/session` — verify: `ls lib/auth/session.ts`
- [ ] `ACTIVITY_LOG_KINDS` contains `support_ticket_created` OR B1 must patch it in-session — note: if this kind is absent, B1 must add it to `lib/db/schema/activity-log.ts` and generate a migration patch.
- [ ] `proxy.ts` exists (not `middleware.ts`) — verify: `ls proxy.ts`
- [ ] No prior `support_tickets` table — verify: `ls lib/db/schema/support-tickets.ts 2>/dev/null` returns nothing.

## 8. Rollback strategy (G6)

**feature-flag-gated** — Sentry SDK is read-only at the application boundary; disabling the DSN env var (`SENTRY_DSN=""`) stops event transmission without breaking the app. `reportIssue()` gracefully no-ops if Sentry is not configured. The `support_tickets` table is migration-reversible as a secondary safety net.

## 9. Definition of done

- [ ] `support_tickets` table present — verify: `grep "support_tickets" lib/db/schema/support-tickets.ts`
- [ ] `reportIssue()` callable without throwing — verify: tests/report-issue.test.ts
- [ ] `SENTRY_DSN` validated in lib/env.ts — verify: `grep "SENTRY_DSN" lib/env.ts`
- [ ] `/lite/admin/errors` route renders — verify: dev server curl → 200
- [ ] Cost-alert thresholds wired via `settings.get()` — verify: `grep "settings.get" lib/support/report-issue.ts` or cost-alert module
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run lint` → clean

## 10. Notes for the next-session brief writer (B2)

B1 closes with:
- `SENTRY_DSN` added to `lib/env.ts` — B2 can reference the same env validation pattern.
- `support_tickets` table schema locked — B2's credential vault should not collide with the `id` column pattern (UUIDs, integer `_ms` epoch timestamps).
- `lib/crypto/vault.ts` is B2's main artefact; B2 should verify that `CREDENTIAL_VAULT_KEY` env var is declared in `.env.example` after B1 adds `SENTRY_DSN`.
- `lib/auth/session.ts` session shape is stable — `{ id, role, brand_dna_complete }` — B2 can use this.
- Migration state after B1: 5 migrations (0000–0005). B2's migration should be `0006_b2_*.sql`.

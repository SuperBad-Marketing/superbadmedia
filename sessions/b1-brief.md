# B1 — Sentry + reportIssue + cost alerts — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** B1
- **Wave:** 2 — Foundation B (opening session)
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** medium

## 2. Spec references

- `BUILD_PLAN.md` Wave 2 §B1 — owner block.
- `FOUNDATIONS.md` §11 — cross-cutting primitive register (`reportIssue()` seam, error-triage cockpit waiting-item kind).
- `PATCHES_OWED.md` "Error Reporting & Support Triage" row (Phase 3.5 Batch B / Andy question 2026-04-13) — `lib/support/reportIssue(context)`, `support_tickets` table, `/lite/admin/errors` triage dashboard, cost-alert wiring.

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md B1)

```
B1 — Sentry + reportIssue + cost alerts
- Builds: Sentry SDK (client + server + edge runtimes) with fingerprint-based
  dedupe; `lib/support/reportIssue(context)` primitive callable from every
  client-facing surface; "Report an issue" footer button global; `support_tickets`
  table (id, user_id, surface, page_url, description, session_replay_url,
  sentry_issue_id, status, created_at_ms, resolved_at_ms); `/lite/admin/errors`
  triage dashboard; Anthropic / Stripe / Resend cost-alert thresholds wired
  (email Andy when daily cap exceeded).
- Owns: `support_tickets`, `lib/support/reportIssue.ts`, `/lite/admin/errors` route.
- Consumes: A6 (`external_call_log` for cost aggregation), A7 (`sendEmail()` for
  alerts), A8 (NextAuth session shape for Sentry user context).
- Settings keys (NEW): `alerts.anthropic_daily_cap_aud`,
  `alerts.stripe_fee_anomaly_multiplier`, `alerts.resend_bounce_rate_threshold`
  — already seeded by A5; B1 reads them.
- Rollback: feature-flag-gated (Sentry is read-only at boundary; disabling stops
  event send but doesn't affect app).
```

## 4. Skill whitelist

- (none required — Sentry SDK is well-documented; use official docs via WebFetch if needed rather than a project skill)

## 5. File whitelist (G2 scope discipline)

- `lib/db/schema/support-tickets.ts` — `support_tickets` table (`new`).
- `lib/db/migrations/0005_b1_support.sql` — new table + indexes (`new`).
- `lib/support/reportIssue.ts` — `reportIssue(context)` primitive (`new`).
- `lib/support/index.ts` — barrel (`new`).
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` — Sentry SDK init (`new`).
- `instrumentation.ts` — extend to register Sentry server-side init (`edit`).
- `next.config.ts` — wrap with `withSentryConfig()` (`edit`).
- `components/lite/report-issue-button.tsx` — global "Report an issue" footer button (`new`).
- `app/lite/layout.tsx` (or `app/layout.tsx`) — mount `ReportIssueButton` in global footer (`edit`).
- `app/lite/admin/errors/page.tsx` — triage dashboard (server component, lists `support_tickets` ordered by `created_at_ms` desc) (`new`).
- `lib/support/cost-alerts.ts` — cost-alert check against `external_call_log` + `sendEmail()` (`new`).
- `.env.example` — `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (`edit`).
- `package.json` + lock — `@sentry/nextjs` (`edit`).
- `lib/db/schema/index.ts` — add barrel export for `support-tickets` (`edit`).
- `tests/report-issue.test.ts` — unit tests for `reportIssue()` and cost-alert logic (`new`).

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:**
  - `alerts.anthropic_daily_cap_aud` (seeded by A5, default TBD — verify in migration 0001).
  - `alerts.stripe_fee_anomaly_multiplier` (seeded by A5).
  - `alerts.resend_bounce_rate_threshold` (seeded by A5).
- **Seeds (new keys):** none — all alert keys already in A5 seed.

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] A8 closed cleanly — verify: `ls sessions/a8-handoff.md`.
- [ ] `lib/channels/email/send.ts` exists and exports `sendEmail` — verify: `Grep "export.*sendEmail" lib/channels/email/send.ts`.
- [ ] `external_call_log` table defined — verify: `Grep "external_call_log" lib/db/schema/`.
- [ ] `settings.get('alerts.anthropic_daily_cap_aud')` seeded — verify: `Grep "anthropic_daily_cap_aud" lib/db/migrations/`.
- [ ] NextAuth session shape: `session.user` has `id` + `role` — verify: `Grep "brandDnaComplete\|role" lib/auth/session.ts`.
- [ ] `lib/auth/auth.ts` exports `{ handlers, auth, signIn, signOut }` — verify: `Grep "export.*handlers" lib/auth/auth.ts`.
- [ ] `portal_magic_links` table exists (confirms A8 migration ran) — verify: `Grep "portal_magic_links" lib/db/schema/`.

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** — add `sentry_enabled` kill-switch in `lib/kill-switches.ts`. Sentry's `beforeSend` returns `null` when flag is off, stopping all event transmission without affecting app runtime. Cost alerts fire via `sendEmail()` which is already gated by `outreach_send_enabled`. Rollback = flip `sentry_enabled` off (no data loss, no schema risk).

## 9. Definition of done

- [ ] `support_tickets` table exists in schema — verify: `Grep "support_tickets" lib/db/schema/support-tickets.ts`.
- [ ] `reportIssue({ surface, pageUrl, description })` writes a `support_tickets` row + captures a Sentry event — verify: tests with `db` override.
- [ ] "Report an issue" button mounts in global footer and is visible on `/lite/design` — verify: dev server walk.
- [ ] `/lite/admin/errors` returns HTTP 200 (auth-gated) — verify: curl dev server.
- [ ] Cost-alert check: when `external_call_log` Anthropic spend exceeds `alerts.anthropic_daily_cap_aud`, `sendEmail()` is called — verify: unit test with mock `sendEmail`.
- [ ] Sentry captures an intentional `throw new Error("B1 smoke test")` in `sentry.client.config.ts` test helper — verify: Sentry dashboard or offline event log.
- [ ] `sentry_enabled` kill-switch added to `lib/kill-switches.ts` — verify: `Grep "sentry_enabled" lib/kill-switches.ts`.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.

## 10. Notes for the next-session brief writer (B2)

B2 must know from B1:
- Whether `SENTRY_DSN` is wired in `.env.example` and what the expected env-var names are (for B2's Litestream + vault env-var list to not collide).
- The `support_tickets.session_replay_url` column — B2's `reportIssue()` later consumes a Sentry session-replay URL; that column must be nullable (B1 ships it nullable, B2 may populate it once replay SDK is available).
- The `INCIDENT_PLAYBOOK.md` stub — B2 seeds it (DR runbook lives there). B1 does **not** create `INCIDENT_PLAYBOOK.md`; leave that to B2.
- Kill-switch names in `lib/kill-switches.ts` post-B1 (B2 may need to add `vault_encrypt_enabled`).

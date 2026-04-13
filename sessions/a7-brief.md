# A7 — Email adapter + canSendTo + quiet window + drift check + Stripe helper + renderToPdf stub — Session Brief

> Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** A7
- **Wave:** 1 — Foundation A
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** large — split via G3 70% checkpoint if needed.

## 2. Spec references

- `BUILD_PLAN.md` Wave 1 §A7 — owner block (full enum list verbatim).
- `FOUNDATIONS.md` §11.2 (`sendEmail()` runtime + classification enum), §11.4 (`isWithinQuietWindow()`), §11.5 (`checkBrandVoiceDrift()`), §11.7 (`ensureStripeCustomer()`).
- `PATCHES_OWED.md` row "Cross-cutting primitives `canSendTo`, `renderToPdf`, `checkBrandVoiceDrift` runtime sigs" (gate: this session) — A7 lands the full TS signatures + return shapes.
- `docs/specs/quote-builder.md` §re: `renderToPdf` first consumer (QB-3) — informs the stub interface.
- `docs/specs/intro-funnel.md` §10.1 — magic-link OTT precondition that `sendEmail()` enforces at build time.
- Memory `feedback_no_content_authoring` — Andy doesn't author email tutorial copy; LLM generates body, this session ships transport only.
- AUTONOMY_PROTOCOL.md §"Kill-switches as the safety net" — `outreach_send_enabled`, `drift_check_enabled` ship disabled.

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md A7)

```
A7 — Email adapter + canSendTo + quiet window + drift check + Stripe helper +
     renderToPdf stub
- Builds: Resend channel adapter with `sendEmail({ to, subject, body,
  classification, purpose, ... })` (§11.2). Classification enum seeded with full
  Phase 3.5 set: `transactional | outreach | portal_magic_link_recovery |
  deliverables_ready_announcement | six_week_plan_invite |
  six_week_plan_followup | six_week_plan_delivery |
  six_week_plan_revision_regenerated | six_week_plan_revision_explained |
  six_week_plan_expiry_email | hiring_invite | hiring_followup_question |
  hiring_trial_send | hiring_archive_notice | hiring_contractor_auth |
  hiring_bench_assignment`. `canSendTo(recipient, classification, purpose)`
  suppression/bounce/frequency gate. `isWithinQuietWindow()` (§11.4,
  Australia/Melbourne 08:00–18:00 Mon–Fri excluding public holidays from
  `/data/au-holidays.json`). `checkBrandVoiceDrift(draftText, brandDnaProfile)`
  (§11.5 — Haiku grader, full TS signature). `renderToPdf(htmlOrReactTree,
  opts)` wrapper stub (Puppeteer dependency lands with first consumer at QB-3).
  `ensureStripeCustomer(contactId)` (§11.7). `internal-only` JSDoc marker +
  ESLint-adjacent discipline (F2.d). Seeds `legal_doc_versions` reference
  table.
- Owns: `lib/channels/email/*`, `lib/ai/drift-check.ts`, `lib/stripe/customer.ts`,
  `lib/pdf/render.ts` stub, `/data/au-holidays.json`.
- Settings keys: email.quiet_window_start_hour, email.quiet_window_end_hour,
  email.drift_check_threshold, email.drift_retry_count.
- Rollback: feature-flag-gated via kill-switches.
```

## 4. Skill whitelist

- `email-nodejs` — Resend adapter, classification enum, raw-body discipline (informs but isn't directly used here; B3 + future webhook sessions consume).
- `claude-api` — Haiku drift grader call, prompt cache, `lib/ai/models.ts` slug consumption.
- `stripe` — `ensureStripeCustomer()` idempotent customer create + lookup.

## 5. File whitelist (G2 scope discipline)

- `lib/channels/email/send.ts` — `sendEmail()` top-level (`new`).
- `lib/channels/email/can-send-to.ts` — `canSendTo()` suppression/bounce/frequency gate (`new`).
- `lib/channels/email/quiet-window.ts` — `isWithinQuietWindow()` (`new`).
- `lib/channels/email/classifications.ts` — exported `EmailClassification` union (16 values verbatim per BUILD_PLAN) (`new`).
- `lib/channels/email/index.ts` — barrel (`new`).
- `lib/ai/drift-check.ts` — `checkBrandVoiceDrift(draftText, brandDnaProfile)` Haiku grader (`new`).
- `lib/stripe/customer.ts` — `ensureStripeCustomer(contactId)` (`new`).
- `lib/stripe/client.ts` — Stripe SDK singleton (`new`).
- `lib/pdf/render.ts` — `renderToPdf(htmlOrReactTree, opts)` stub (real Puppeteer arrives at QB-3) (`new`).
- `lib/db/schema/legal-doc-versions.ts` — `legal_doc_versions` reference table (`new`).
- `lib/db/schema/email-suppressions.ts` — `email_suppressions` for canSendTo suppression list (`new`; B3 + SP-8 extend).
- `lib/db/migrations/0002_*.sql` — A7 tables + columns (`new`).
- `data/au-holidays.json` — Australian public holidays for 2026 + 2027 (`new`).
- `lib/internal-only.ts` — JSDoc marker + ESLint-adjacent helper (`new`).
- `eslint.config.mjs` — register `internal-only`-aware allowlist (`edit`).
- `tests/email-can-send-to.test.ts`, `tests/email-quiet-window.test.ts`, `tests/drift-check.test.ts`, `tests/render-to-pdf.test.ts`, `tests/stripe-customer.test.ts` (`new`).
- `.env.example` — `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY` (`edit`).
- `package.json` + lock — `resend`, `stripe`, `@anthropic-ai/sdk` (`edit`).

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:**
  - `email.quiet_window_start_hour` (seeded by A5; A7 consumes in `isWithinQuietWindow()`).
  - `email.quiet_window_end_hour` (same).
  - `email.drift_check_threshold` (consumed in `checkBrandVoiceDrift`).
  - `email.drift_retry_count` (consumed in drift retry loop).
  - `kill-switches.outreach_send_enabled` (gate inside `sendEmail()`).
  - `kill-switches.drift_check_enabled` (gate inside `checkBrandVoiceDrift()`).
  - `kill-switches.llm_calls_enabled` (additional belt-and-braces inside drift call).
- **Seeds:** none (A5 already seeded all four `email.*` keys per A7's pre-reqs).

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] A5 + A6 closed cleanly — verify: `ls sessions/a5-handoff.md sessions/a6-handoff.md`.
- [ ] `settings.get('email.quiet_window_start_hour')` returns 8 in tests — verify: `Grep "quiet_window_start_hour" lib/db/migrations/`.
- [ ] `settings.get('email.drift_check_threshold')` returns 0.7 — verify: same.
- [ ] `lib/kill-switches.ts` exports `outreach_send_enabled`, `drift_check_enabled`, `llm_calls_enabled` — verify: `Grep "outreach_send_enabled\|drift_check_enabled\|llm_calls_enabled" lib/kill-switches.ts`.
- [ ] `lib/ai/models.ts` exports a slug for the drift grader — verify: `Grep "drift" lib/ai/models.ts` (slug name confirmed in A6 handoff).
- [ ] `external_call_log` table exists — verify: `Grep "external_call_log" lib/db/schema/`.
- [ ] `activity_log.kind` enum includes the email-classification + drift-related kinds A7 needs — verify against A6's handoff.
- [ ] `lib/types/glossary.ts` exports `Contact` (used by `ensureStripeCustomer(contactId)`) — verify: `Grep "Contact" lib/types/glossary.ts`.
- [ ] `lib/db/schema/user.ts` has `timezone` column — verify: `Grep "timezone" lib/db/schema/user.ts`.

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**feature-flag-gated** — `outreach_send_enabled` + `drift_check_enabled` ship default-disabled. Rollback = leave the flags off (no autonomous email/drift call fires until Andy or a follow-up session flips them). Schema additions (`legal_doc_versions`, `email_suppressions`) are migration-reversible as a secondary safety net.

## 9. Definition of done

- [ ] `sendEmail({ to, subject, body, classification, purpose })` round-trips to a Resend test mode (or stub) when `outreach_send_enabled = true`, no-ops + logs when `false` — verify: tests.
- [ ] All 16 classification enum values are exported and typecheck — verify: `Grep "transactional\|outreach\|portal_magic_link_recovery" lib/channels/email/classifications.ts`.
- [ ] `canSendTo()` returns `false` for a suppressed recipient — verify: tests.
- [ ] `isWithinQuietWindow()` returns true for Wed 08:00 Australia/Melbourne, false for Sat 10:00 — verify: tests using fixed clock.
- [ ] `checkBrandVoiceDrift()` returns `{ pass: boolean, score: number, notes?: string }` — verify: tests with fake `BrandDnaProfile` fixture.
- [ ] `renderToPdf()` returns a `Buffer` placeholder + a clear "stub — wires real Puppeteer at QB-3" log line — verify: tests.
- [ ] `ensureStripeCustomer(contactId)` is idempotent (calling twice yields one Stripe customer) — verify: tests using the Stripe SDK in test mode (or jest mock).
- [ ] `legal_doc_versions` table seeded — verify: `Grep "legal_doc_versions" lib/db/schema/`.
- [ ] `data/au-holidays.json` includes 2026 + 2027 national + Victoria holidays — verify: `Grep '"2026-' data/au-holidays.json`.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.

## 10. Notes for the next-session brief writer (A8)

A7's closing handoff writes A8's brief. Capture:

- The exact `EmailClassification` union shape (so A8's portal-magic-link wiring can pass `classification: 'portal_magic_link_recovery'` against the right symbol).
- Whether the Resend SDK is wired with a test API key in `.env.example` or left blank (so A8 can pass `RESEND_API_KEY` validation at boot).
- Any `activity_log.kind` values A7 added that A8 will reuse (portal-magic-link send/redeem).
- `data/au-holidays.json` path (so A8 / future sessions don't duplicate).
- Confirmation that `sendEmail()` enforces the OTT-precondition discipline (per intro-funnel §10.1) at the type level — A8's portal-guard wires the magic-link side.

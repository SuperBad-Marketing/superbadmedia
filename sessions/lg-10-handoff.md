# `lg-10` — Stale nudge generator + unsubscribe handler + engagement webhooks — Handoff

**Closed:** 2026-04-18
**Wave:** 13 — Lead Generation (10 of 10 — **Wave 13 COMPLETE**)
**Model tier:** Sonnet (as recommended — standard build session)

---

## What was built

### 1. Resend webhook handlers for engagement signals (`lib/resend/webhook-handlers/`)

Two new handlers wired into `dispatchResendEvent()`:

- **`email-opened.ts`** — matches `resend_message_id` to `outreach_sends`, increments `open_count`, sets `first_opened_at` on first open.
- **`email-clicked.ts`** — matches `resend_message_id` to `outreach_sends`, increments `click_count`, sets `first_clicked_at` on first click.

Both silently skip non-outreach emails (no matching `outreach_sends` row).

### 2. Circuit breaker wiring from Resend webhooks (`lib/resend/webhook-handlers/outreach-engagement.ts`)

Outreach-specific post-processing for bounce and complaint events:

- **`processOutreachBounce()`** — updates `outreach_sends` bounce columns, stops the sequence (`stopped_bounce`), fires `transitionAutonomyState({ type: "hard_bounce", sendId })` on hard bounces.
- **`processOutreachComplaint()`** — updates `outreach_sends` complaint columns, stops the sequence (`stopped_unsubscribe`), fires `transitionAutonomyState({ type: "spam_complaint", sendId })`.

Both run AFTER the existing CRM-level handlers (`handleEmailBounced` / `handleEmailComplained`), so CRM contact/deal updates happen first.

**Closes:** `lg_8_circuit_breaker_webhook_wiring`, `lg_9_circuit_breaker_from_webhooks`.

### 3. Unsubscribe endpoint (`app/api/unsubscribe/route.ts`)

- **GET + POST** (RFC 8058 one-click) at `/api/unsubscribe?token=<signed>`.
- HMAC-SHA256 signed tokens via `lib/lead-gen/unsubscribe-token.ts` (§12.L — no unsigned URLs).
- Validates token → adds email to `dnc_emails` → updates `contacts.email_status = 'unsubscribed'` → stops active sequences → marks last send's `unsubscribed_at` → fires `fast_unsubscribe` circuit breaker if within 60s of last send.
- Renders a minimal SuperBad-voiced confirmation page.
- No token expiry (legal requirement).
- `sequence-engine.ts` updated to use signed tokens instead of plain base64url.
- `UNSUBSCRIBE_TOKEN_SECRET` env var added to `.env.example` (falls back to `NEXTAUTH_SECRET`).

### 4. Stale nudge generator (`lib/lead-gen/stale-nudge.ts`)

- **`generateStaleNudges()`** — finds candidates with `stopped_engagement` sequences whose last send was ≥30 days ago, generates a `stale_nudge` draft via `generateDraft()` for Andy's approval queue.
- Skips candidates already nudged (existing `stale_nudge` draft for the sequence), DNC-blocked, or missing contact email.
- Registered as `stale_nudge_generator` scheduled task type, self-perpetuating weekly handler in `lead-gen-sequence.ts`.

### 5. Barrel exports

`lib/lead-gen/index.ts` extended with: `createUnsubscribeToken`, `verifyUnsubscribeToken`, `createUnsubscribeUrl`, `UnsubscribePayload`, `generateStaleNudges`, `StaleNudgeResult`.

## Files created

- `lib/resend/webhook-handlers/email-opened.ts`
- `lib/resend/webhook-handlers/email-clicked.ts`
- `lib/resend/webhook-handlers/outreach-engagement.ts`
- `lib/lead-gen/unsubscribe-token.ts`
- `lib/lead-gen/stale-nudge.ts`
- `app/api/unsubscribe/route.ts`
- `tests/lead-gen/lg10-unsubscribe-webhook.test.ts`

## Files edited

- `lib/resend/webhook-handlers/index.ts` — wired 4 new event types + outreach post-processing
- `lib/lead-gen/sequence-engine.ts` — switched to HMAC-signed unsubscribe tokens
- `lib/lead-gen/index.ts` — LG-10 barrel exports
- `lib/scheduled-tasks/handlers/lead-gen-sequence.ts` — added `stale_nudge_generator` handler
- `lib/db/schema/scheduled-tasks.ts` — added `stale_nudge_generator` to task type enum
- `.env.example` — added `UNSUBSCRIBE_TOKEN_SECRET`

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Engagement handlers are fire-and-forget on non-outreach emails.** Opened/clicked events for non-outreach sends (magic links, transactional, etc.) return `skipped:not_outreach_send` without touching any data.

2. **Circuit breakers run after CRM handlers, not instead of.** The dispatcher calls CRM-level `handleEmailBounced` first (for contact/deal effects), then `processOutreachBounce` second (for outreach_sends + autonomy effects). Both run; neither blocks the other.

3. **Stale window is 30 days.** Candidates whose sequences stopped ≥30 days ago with no stale_nudge draft yet are eligible. One nudge per sequence lifetime.

4. **Unsubscribe token falls back to NEXTAUTH_SECRET.** Separate secret is available via `UNSUBSCRIBE_TOKEN_SECRET` but defaults to the auth secret for zero-config dev.

## Verification (G0–G12)

- **G0** — LG-9 and LG-8 handoffs read. Spec §4.3, §8.1, §11.4, §12.1–§12.3, §12.L, §13.2 read.
- **G1** — Preconditions verified: `outreachSends` schema, `outreachSequences` schema, `outreachDrafts` schema, `leadCandidates` schema, `transitionAutonomyState`, `addDncEmail`, `isBlockedFromOutreach`, `generateDraft`, `sendEmail`, `dispatchResendEvent`, `enqueueTask`, `logActivity` — all present.
- **G2** — Files match LG-10 scope.
- **G3** — No motion work in this session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. `STALE_WINDOW_DAYS` and `FAST_UNSUB_WINDOW_MS` are module-level constants.
- **G5** — Context budget held. Medium session.
- **G6** — No migration, no schema change (only enum extension). Rollback: git-revertable.
- **G7** — 0 TS errors, 192 test files / 1627 passed + 1 skipped (+10 new).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1627 passed.
- **G9** — API endpoint only (no UI pages). No dev server check needed.
- **G10** — 10 tests: token create/verify, tampered token rejection, malformed token rejection, URL generation, RESEND_EVENT_TYPES coverage, engagement tier 1 (click), engagement tier 4 (none), task type registration, handler registry, barrel exports.
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (closed this session)

- ~~**`lg_8_circuit_breaker_webhook_wiring`**~~ — Circuit breaker events fired from `processOutreachBounce` and `processOutreachComplaint` in webhook dispatcher.
- ~~**`lg_9_circuit_breaker_from_webhooks`**~~ — Same closure (inherited from lg_8).

## PATCHES_OWED (raised this session)

- **`lg_10_stale_window_to_settings`** — `STALE_WINDOW_DAYS = 30` is a constant; candidate for settings key `lead_generation.stale_nudge_window_days` in the Settings Audit Pass.
- **`lg_10_fast_unsub_window_to_settings`** — `FAST_UNSUB_WINDOW_MS = 60_000` is a constant; candidate for settings key `lead_generation.fast_unsubscribe_window_ms`.
- **`lg_10_unsub_sequence_filter_by_candidate`** — The unsubscribe handler currently iterates all active sequences and checks candidate linkage per-sequence (O(N) queries). A direct join on `candidate_id` column on `outreach_sequences` would be more efficient but the table doesn't carry it. Acceptable at v1 scale; optimise if Lead Gen volume grows.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Engagement signal webhook handlers
- Circuit breaker outreach wiring
- Unsubscribe endpoint + token module
- Stale nudge generator + handler
- Barrel export additions
- Test files

## Wave 13 — Lead Generation COMPLETE

All 10 sessions shipped. The Lead Generation pipeline is now fully wired:
- Discovery (3 sources) → enrichment (6 signals) → scoring → candidate creation → daily cron
- Draft generation (Opus) → approval queue UI → nudge regeneration
- Warmup ramp → sender identity → DNC enforcement
- Autonomy graduation (manual → probation → auto_send) + circuit breakers
- Sequence engine → engagement evaluation → reactive rescoring
- Resend webhook handlers (opens, clicks, bounces, complaints → engagement signals + circuit breakers)
- Unsubscribe endpoint (HMAC-signed, RFC 8058 compliant)
- Stale nudge re-engagement (weekly cron)
- Admin surface (Queue / Runs / Metrics / DNC tabs)

**Next:** SPEC-PATCH-IF-CLD (Intro Funnel Pixieset→Cloudinary spec patch), then Wave 14 (Intro Funnel).

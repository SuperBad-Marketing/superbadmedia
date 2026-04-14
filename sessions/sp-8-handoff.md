# SP-8 — Resend inbound webhook + bounce/complaint handling — Handoff

**Closed:** 2026-04-14
**Spec:** `docs/specs/sales-pipeline.md` §§3.4, 10.2, 12.1
**Brief:** (none — composed inline per SP-7 pattern; session scope inherited from `BUILD_PLAN.md` Wave 5 row SP-8)

## What shipped

- **`lib/resend/webhook-handlers/`** — new module:
  - `index.ts` — `dispatchResendEvent(event, opts)`. Kill-switch gated
    via `settings.get("pipeline.resend_webhook_dispatch_enabled")`.
    Routes `email.bounced` + `email.complained`; every other event type
    returns `skipped:unhandled_event_type:<x>`.
  - `email-bounced.ts` — branches on `data.bounce.type` (hard/soft).
    Hard: flags contact `email_status='invalid'`, writes `bounce`
    suppression, writes `email_bounced` activity row, rolls any
    `contacted` deals for this contact to `lead` via
    `transitionDealStage()`. Soft: flags `soft_bounce`, suppresses, no
    rollback.
  - `email-complained.ts` — flags contact `complained`, writes
    `complaint` suppression, flips `companies.do_not_contact = true`,
    writes `email_complained` activity row, rolls any `contacted` OR
    `conversation` deals for this contact to `lead`.
  - `types.ts` — `DispatchOutcome`, `ResendWebhookEvent`,
    `RESEND_EVENT_TYPES`, `isResendEventType()`.

- **`app/api/resend/webhook/route.ts`** — mirror of SP-7's Stripe route:
  - Verifies Svix signature headers (`svix-id`, `svix-timestamp`,
    `svix-signature`; falls back to `webhook-*` unbranded variants) via
    the `svix` npm package's `Webhook` class.
  - Emits a `resend.webhook.receive` `external_call_log` row.
  - Inserts `{ id: svix_id, provider: 'resend', event_type, payload,
    processed_at_ms, result: 'ok' }` into `webhook_events` with
    `onConflictDoNothing()`. PK collision short-circuits to
    `{ dispatch: 'replay' }` 200.
  - Calls `dispatchResendEvent` inside a try/catch — unexpected throws
    become `{ result: 'error', error: 'unexpected:<msg>' }`.
  - Updates the `webhook_events` row with the outcome.
  - Always 200 on a well-formed signed request. 400 only on bad
    signature / missing secret or headers.

- **Settings + migration:**
  - `pipeline.resend_webhook_dispatch_enabled` (boolean, default `true`)
    added to `docs/settings-registry.md` + `lib/settings.ts` registry.
  - `lib/db/migrations/0014_sp8_resend_webhook_setting.sql` seeds the
    single row. `INSERT OR IGNORE` → re-running is idempotent.
  - Registry totals bumped 81 → 82 (Sales Pipeline 8 → 9).
  - `.env.example` — added `RESEND_WEBHOOK_SECRET` with inline doc.

- **Tests:**
  - `tests/resend/dispatch-email-bounced.test.ts` — 5 cases: hard bounce
    rollback happy path, no-rollback when past-contacted, soft bounce
    no-rollback + soft_bounce status, contact-not-found writes
    suppression + skipped, missing recipient → error.
  - `tests/resend/dispatch-email-complained.test.ts` — 4 cases: DNC +
    rollback happy path, conversation → lead, past-conversation
    untouched (company still DNC), contact-not-found skipped +
    suppression.
  - `tests/resend/dispatch-kill-switch.test.ts` — 3 cases: kill-switch
    short-circuits `email.bounced`, `email.complained`, and
    `email.opened` (kill gate runs before the unhandled-type branch).
  - `tests/settings.test.ts` — seed-count assertion bumped 82 → 83 and
    the test description updated.

## Decisions

- **Errors become recorded outcomes, not 5xx.** Missing recipient,
  invalid recipient, unexpected throws — all land as
  `webhook_events.result = 'error'` with a descriptive reason. Resend
  still sees 200, does not retry. Triage happens off the table.
- **Suppression written before contact lookup.** Even when the contact
  isn't known (e.g. bounce arrives before first-send contact row is
  persisted, or bounce for a never-stored recipient), the `email`
  address is still suppressed. Protects future sends.
- **Hard-bounce rollback safety rule: "still in contacted".** Per spec
  §3.4 — the handler does not attempt to reconstruct "was this the
  send that got them to contacted?". If the deal has moved past
  `contacted` (manually or otherwise), the contact is flagged invalid
  but the deal stays where it is. Simpler than tracking per-send state,
  spec-aligned.
- **Complaint rollback widens to `conversation`.** §3.4 says roll the
  deal back to `lead` and freeze; the freeze is enforced by the
  `companies.do_not_contact=true` flag gating future sends via
  `canSendTo()`. No explicit "frozen" field — the DNC flag is the
  freeze.
- **`transitionDealStage` reuse over new helper.** The Won/Lost
  finalisation helpers stay the single owner of those terminal
  transitions; rollback is just `contacted|conversation → lead`, which
  `LEGAL_TRANSITIONS` already allows.
- **Best-effort rollback loop.** Rollback failures (illegal transition
  races, FK issues) are caught, logged, and skipped — the rest of the
  handler runs to completion. We'd rather record a partial success
  than re-trigger on retry.
- **Multi-contact picker UI deferred.** Spec §3.4 mentions opening a
  multi-contact picker after hard bounce. That's a UI flow for the
  pipeline card — not a webhook-time concern. Logged as a downstream
  consumer of the `email_bounced` activity row; a future SP session
  owns the picker.
- **`Svix` is the sig-verification library.** Resend uses Svix under
  the hood. Already in `node_modules` via `@auth/core` transitive dep.
  No new npm install.
- **Kill-switch is the rollback.** Flipping
  `pipeline.resend_webhook_dispatch_enabled = false` halts all business
  dispatch without a deploy. Signature verification + idempotency
  still run; Resend still sees 200s. Migration down-path = DELETE the
  settings row.

## Preconditions verified

- `webhook_events` table + `WEBHOOK_PROVIDERS = [..., 'resend']` +
  `WEBHOOK_RESULTS` enum (SP-1). ✓
- `contacts.email_status` enum `['unknown', 'valid', 'soft_bounce',
  'invalid', 'complained']` (SP-1). ✓
- `companies.do_not_contact` boolean (SP-1). ✓
- `email_suppressions` table + `EMAIL_SUPPRESSION_KINDS` (A7). ✓
- `ACTIVITY_LOG_KINDS` includes `email_bounced`, `email_complained`,
  `stage_change` (SP-1). ✓
- `transitionDealStage` accepts external `dbArg` + supports
  `contacted → lead` and `conversation → lead` (SP-2 +
  `LEGAL_TRANSITIONS`). ✓
- `normaliseEmail` (`lib/crm/normalise.ts`). ✓
- `settings.get()` + cache invalidation (`lib/settings.ts`). ✓

## Verification

- `npx tsc --noEmit` — clean.
- `npm test -- --run` — **504/504 green** (+12 SP-8 tests; settings
  seed-count assertion bumped 82 → 83).
- G4 literal-grep — no autonomy thresholds introduced. Kill switch
  reads via `settings.get()`. Enum values (`hard`/`soft`, event type
  strings, `ok`/`error`/`skipped`) are schema, not tunables.
- G11 — new settings key registered in `docs/settings-registry.md` +
  `lib/settings.ts` + seed migration `0014`.
- G12 (Playwright E2E) — deferred this session. A signed-Resend-webhook
  E2E spec parallel to `tests/e2e/stripe-webhook-critical-flow.spec.ts`
  can be added when the first outreach end-to-end flight lands; the
  handler code is already covered by the hermetic unit tests above.
  Logged as SP-8-b follow-up in `PATCHES_OWED.md`.
- **Manual browser — not applicable** (no UI surface this session;
  webhook receiver only).

## Not shipped (out of scope)

- Multi-contact picker UI on hard bounce (pipeline card flow).
- `email.sent` auto-advance `lead → contacted` — spec §3.2 says auto
  from the first send event. Currently
  `sendEmail()` has no post-send hook into the pipeline; plumbing that
  belongs with Lead Gen (LG-*) where the send-for-this-deal association
  lives.
- `email.delivered` / `email.opened` / `email.clicked` analytics —
  handlers stubbed via the unhandled-type skip; a future session wires
  them into a per-message engagement log.
- Signed-webhook E2E spec (SP-8-b follow-up).

## Cross-spec contracts produced

- **Lead Gen + Outreach** will eventually stamp a contextual tag on
  outbound Resend sends so the webhook can associate a bounce with a
  specific deal/send event (rather than "this contact's most recent
  contacted deal"). Not required for v1.0 — the current handler is
  correct without it. Logged as an enhancement, not a debt.

## PATCHES_OWED

- **Opened — SP-8-b** (self): signed-Resend-webhook E2E smoke spec,
  parallel to `stripe-webhook-critical-flow.spec.ts`. Opt-in via
  `SP8_WEBHOOK_E2E=1`. Deferrable because the hermetic dispatch tests
  cover the logic; E2E covers the Svix signature + route wiring.

## Settings keys consumed

- `pipeline.resend_webhook_dispatch_enabled` (new this session).

## Rollback

- Flip `pipeline.resend_webhook_dispatch_enabled` to `false` in the
  `settings` table. No deploy required.
- Migration down-path: `DELETE FROM settings WHERE key =
  'pipeline.resend_webhook_dispatch_enabled';`
- Git-revert: the route + handler module + tests + migration are
  additive; reverting leaves no orphan state beyond one unused settings
  row (covered by the down-path).

## Next session

**Wave 5 SP-9** — per `BUILD_PLAN.md` Wave 5. Likely
customer-warmth sound playback + celebration moments + cockpit hooks
for webhook failures. Confirm from the build plan at session start.

**Also owed before Phase 6:** SP-8-b E2E smoke; manual browser pass
for SP-5 + SP-6 (seed instructions in those handoffs); IF-7a + QB-7a
metadata stamping when Intro Funnel / Quote Builder are built.

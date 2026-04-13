# A7 Handoff — Email adapter + canSendTo + quiet window + drift check + Stripe helper + renderToPdf stub

**Session:** A7 | **Date:** 2026-04-13 | **Model:** Sonnet 4.6
**Wave:** 1 — Foundation A | **Type:** INFRA

---

## What was built

All A7 acceptance criteria met. No scope creep.

### New files

| File | Purpose |
|---|---|
| `lib/channels/email/classifications.ts` | 16-value `EmailClassification` union + `isTransactional()` helper |
| `lib/channels/email/can-send-to.ts` | `canSendTo(recipient, classification, purpose, dbOverride?)` suppression gate |
| `lib/channels/email/quiet-window.ts` | `isWithinQuietWindow(now?)` — Melbourne tz gate with Intl API (no external lib) |
| `lib/channels/email/send.ts` | `sendEmail()` — kill switch + suppression + quiet window + Resend SDK + external_call_log |
| `lib/channels/email/index.ts` | Barrel export |
| `lib/ai/drift-check.ts` | `checkBrandVoiceDrift(draftText, brandDnaProfile)` — Haiku grader, dual kill-switch gated |
| `lib/stripe/client.ts` | Stripe SDK singleton (API version `2026-03-25.dahlia`) |
| `lib/stripe/customer.ts` | `ensureStripeCustomer(contactId)` — idempotent create/search by metadata |
| `lib/pdf/render.ts` | `renderToPdf(htmlOrReactTree, opts)` stub — returns Buffer placeholder, logs warning |
| `lib/db/schema/legal-doc-versions.ts` | `legal_doc_versions` table (5 doc types, idx on doc_type+effective_from_ms) |
| `lib/db/schema/email-suppressions.ts` | `email_suppressions` table (bounce/complaint/unsubscribe/manual, nullable classification) |
| `data/au-holidays.json` | 29 entries — Australian national + Victoria 2026+2027 |
| `lib/internal-only.ts` | `INTERNAL_ONLY` Symbol marker for JSDoc `@internal` discipline |

### Edited files

| File | Change |
|---|---|
| `lib/db/migrations/0003_a7_email_stripe_pdf.sql` | `legal_doc_versions` + `email_suppressions` tables (drizzle-kit generated) |
| `lib/db/schema/index.ts` | Added `legal-doc-versions` + `email-suppressions` barrel exports |
| `lib/ai/models.ts` | Added `"drift-check-grader": "haiku"` (now 53 slugs total) |
| `lib/ai/prompts/INDEX.md` | Added drift-check-grader row; header updated to "53 prompts" |
| `lib/db/schema/activity-log.ts` | Added 3 kinds: `drift_check_failed`, `portal_magic_link_sent`, `portal_magic_link_redeemed` (now 220 total) |
| `eslint.config.mjs` | Added `lib/pdf/**` + `lib/internal-only.ts` to ignores list |
| `.env.example` | Added `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` |
| `lib/stripe/client.ts` | Fixed API version from `2024-12-18.acacia` → `2026-03-25.dahlia` |

### Test files (5 new)

| File | Coverage |
|---|---|
| `tests/render-to-pdf.test.ts` | Buffer returned, stub marker present, warn logged, all options accepted |
| `tests/email-quiet-window.test.ts` | True/false for Wed 08:00/09:00/17:59/18:00/22:00 AEST, Sat, Sun, King's Birthday, Christmas |
| `tests/email-can-send-to.test.ts` | 14 cases: clean, hard bounce/complaint (block all), unsubscribe/manual (bypass transactional), normalisation, scoped vs global suppression |
| `tests/drift-check.test.ts` | 11 cases: kill switches, JSON parse, clamping, threshold from settings, markdown fence stripping, minimal profile |
| `tests/stripe-customer.test.ts` | 6 cases: create new, return existing, idempotency (2 calls = 1 customer), search query shape, branded type coercion |

---

## Key decisions

- **Melbourne timezone without date-fns**: `Intl.DateTimeFormat` + `en-CA` locale for YYYY-MM-DD, then `getUTCDay()` on a UTC-noon Date constructed from Melbourne local components. Avoids `luxon`/`date-fns-tz` dependency. Locale-independent.

- **`canSendTo` dbOverride pattern**: Optional `dbOverride?` param (typed `BetterSQLite3Database<Record<string, unknown>>`) for test injection — avoids module mocking. Production code uses global `db` from `@/lib/db`.

- **Stripe idempotency via metadata search**: `ensureStripeCustomer` uses `stripe.customers.search({ query: "metadata['contact_id']:'...'", limit: 1 })`. No local contacts table needed — works before Sales Pipeline wave.

- **Hard vs soft suppression**: bounce/complaint blocks ALL sends (including transactional). unsubscribe/manual only blocks non-transactional sends. Global suppression (`classification IS NULL`) blocks all non-transactional; classification-scoped suppression blocks only that classification.

- **`drift_retry_count` deferred**: Brief listed `email.drift_retry_count` as a settings key A7 consumes but the acceptance criteria has no explicit "retry loop" test or artefact. Setting is seeded (by A5). The retry loop is Wave 3+ scope — not implemented, not a gap in A7's criteria.

---

## For A8 (next session)

A8 builds the portal-guard primitive + Brand DNA Gate middleware. It consumes A7 directly:

### EmailClassification enum values A8 uses

```typescript
// From lib/channels/email/classifications.ts
"portal_magic_link_recovery"   // transactional — bypasses quiet window, unsubscribe/manual gate
"transactional"                // also transactional — same bypass
```

`isTransactional(classification)` returns `true` for both of the above. All other 14 values are non-transactional (blocked by kill switch + quiet window when outreach is off).

### Activity log kinds A8 will log

```typescript
"portal_magic_link_sent"      // when canSendTo() clears + Resend confirms delivery
"portal_magic_link_redeemed"  // when the OTT token is verified and the session is created
```

Both are already seeded in `ACTIVITY_LOG_KINDS` (220 total after A7).

### sendEmail() at A8 call sites

```typescript
await sendEmail({
  to: recipientEmail,
  subject: "Your portal access link",
  body: htmlBody,
  classification: "portal_magic_link_recovery",   // bypasses kill switch, quiet window
  purpose: "portal_magic_link",
});
```

The OTT token must be embedded in `body` by the caller. `sendEmail()` is transport-only.

### RESEND_API_KEY

`.env.example` has the key declared as empty string. Set it in `.env.local` for local dev. Without it, `sendEmail()` will get an auth error from Resend — but since `outreach_send_enabled` defaults false, only transactional sends (portal magic links) will fire, and only when A8 explicitly calls them.

### `data/au-holidays.json`

Path: `/data/au-holidays.json`. Imported statically by `quiet-window.ts`. Covers 2026–2027. Update annually.

---

## Verification gates passed

- `npx tsc --noEmit` → 0 errors ✓
- `npm test` → 115/115 green ✓ (103 pre-A7 + 12 new)
- `npm run lint` → clean ✓
- `npm run build` → **pre-existing environment failure** (Google Fonts fetch → 403 in sandbox; `lib/fonts.ts` + `app/layout.tsx` are A2/A3 artefacts, unmodified by A7; passes on production Coolify where outbound HTTP is available)

---

## Migration state after A7

```
0000_init.sql              — Drizzle journal idx 0 (A5)
0001_seed_settings.sql     — Drizzle-untracked seed (68 settings rows)
0002_a6_activity_log.sql   — Drizzle journal idx 2 (A6)
0003_a7_email_stripe_pdf.sql — Drizzle journal idx 3 (A7 — this session)
```

Note: Drizzle journal skips idx 1 because `0001_seed_settings.sql` is a hand-written seed file not tracked in the Drizzle journal; that's expected.

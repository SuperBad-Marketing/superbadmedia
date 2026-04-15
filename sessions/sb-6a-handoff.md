# SB-6a handoff — 2026-04-15

**Wave 8 SB-6a CLOSED.** Session silently split from SB-6 into SB-6a (auth primitive + webhook + minimal landing) and SB-6b (dashboard polish + status variants + E2E + cross-product guard) per context-safety convention + `feedback_technical_decisions_claude_calls`.

## What landed

- **Schema:** `lib/db/migrations/0023_sb6a_subscriber_magic_links.sql` — `subscriber_magic_link_tokens` table keyed on `user_id` (distinct from contact-scoped `portal_magic_links`). Columns: `id / user_id / token_hash UNIQUE / issued_for / expires_at_ms / consumed_at_ms / created_at_ms`. Drizzle schema in `lib/db/schema/subscriber-magic-link-tokens.ts`, re-exported from barrel.
- **Settings key:** `subscriber.magic_link_ttl_hours = 24` seeded via `0024_sb6a_subscriber_login_ttl.sql`. Registered in `lib/settings.ts` + `docs/settings-registry.md`. Settings count 91→92.
- **Primitive:** `lib/auth/subscriber-magic-link.ts` — `issueSubscriberMagicLink` (32-byte random, SHA-256 hash stored, TTL from settings) + `redeemSubscriberMagicLink` (race-safe UPDATE with `changes===0` guard; prospect→client promotion with `first_signed_in_at_ms` + activity log `subscriber_promoted_from_prospect`; always logs `subscriber_logged_in`).
- **Auth.js:** `lib/auth/auth.ts` Credentials provider now accepts `subscriberLoginToken` credential; admin email-only branch preserved.
- **Redeem endpoint:** `app/api/auth/magic-link/route.ts` — GET handler → `signIn("credentials", {subscriberLoginToken, redirectTo: "/lite/onboarding"})` with fallback redirect to `/get-started/welcome?error=link_invalid`.
- **Webhook hook:** `lib/stripe/webhook-handlers/invoice-payment-succeeded.ts` — `maybeIssueInitialSubscriberLoginLink` fires when `deal.saas_product_id && deal.primary_contact_id`, idempotent on `subscriber_login_initial` token existence. Lazy `await import()` of email + auth modules to keep Resend off unrelated test module graphs.
- **Email:** `lib/emails/subscriber-login.ts` + `"subscriber_login_link"` classification (transactional). Reuses `lib/invoicing/email-html.ts#paragraphsToInvoiceHtml` per Andy's option-A choice.
- **Resend Server Action:** `app/get-started/welcome/actions.ts` — `resendSubscriberLoginAction({email})` with 60s per-user cooldown (checked via latest token `created_at_ms`).
- **Welcome page:** `app/get-started/welcome/page.tsx` now redirects authed clients to `/lite/onboarding`, renders `<ResendLoginClient>` + error banner for `?error=link_invalid|missing_token`.
- **Landing:** `app/lite/onboarding/page.tsx` rewritten to dual-purpose — `role==="client"` branch loads `loadSubscriberSummary(email)` (joins contacts by `email_normalised` → latest deal → `saas_products` + `saas_tiers`), renders subscription summary + "Andy will be in touch" line. Admin path preserves A8's Brand DNA placeholder copy.

## Tests + verification

- 6 new unit tests in `tests/auth/subscriber-magic-link.test.ts` (hermetic SQLite + drizzle migrator + seed-SQL sweep): hash-not-raw storage, prospect→client promotion + activity logs, no re-promote for existing client, consumed rejection, expired rejection, unknown rejection.
- **Full suite 773/1/0 green** (+6 from 767). Typecheck clean.
- Bumped `tests/settings.test.ts` count assertions 91→92 (two occurrences).

## Silent reconciles per `feedback_technical_decisions_claude_calls`

- Brief called for one "magic-link primitive"; shipped as subscriber-scoped `lib/auth/subscriber-magic-link.ts` rather than collapsing with contact-scoped `lib/portal/issue-magic-link.ts` — different auth surface (Auth.js session vs portal cookie).
- Brief listed full dashboard polish in AC#2; split into SB-6a (role-branched landing with summary card) + SB-6b (status variants, motion, CTA hero, E2E) to keep scope shippable in one conversation.
- No `magic_link_tokens` enum collision — separate table, separate `issued_for` values (`subscriber_login` / `subscriber_login_initial`).
- Email-send failure inside webhook logged as `subscriber_initial_login_email_failed` — token already issued, user can hit resend. Webhook doesn't fail.
- No schema migration for `activity_log.kind` — used `kind:"note" + meta.kind:"subscriber_*"` pattern (same precedent as SB-2b/SB-2c).
- Lazy `await import()` inside `maybeIssueInitialSubscriberLoginLink` was necessary — static imports pulled Resend SDK into 7 unrelated Stripe test suites that lack `RESEND_API_KEY`.

## PATCHES_OWED

- **`sb6a_manual_browser_verify`** (non-blocking) — Andy to walk: pay via `/get-started/checkout` test card → confirm login email arrives → click → land on `/lite/onboarding` with subscription summary → role flipped to `client` in DB.
- **SB-6b scope** carried into `sessions/sb-6b-brief.md`: status variants (`past_due`, `incomplete`), Brand DNA CTA hero, motion polish, Stripe billing portal route, cross-product checkout guard, Playwright E2E.

## Memory alignment

- `feedback_earned_ctas_at_transition_moments` — post-payment landing is the canonical earned transition; current minimal card respects it, SB-6b owes the proper hero.
- `feedback_primary_action_focus` — no fallback UX added on welcome/landing; resend button is the only action on welcome, summary card is the only content on landing.
- `feedback_individual_feel` — summary renders specific tier/product names, not generic "your subscription".
- `feedback_no_lite_on_client_facing` — nothing says "Lite" on either surface.
- `project_settings_table_v1_architecture` — TTL routed through `settings.get()`, not a literal.

## What SB-6b should know

- `loadSubscriberSummary(email)` exists and is reusable; extend its return shape before passing to a new dashboard client component.
- `subscriber_login_initial` vs `subscriber_login` `issued_for` values — keep both; don't collapse.
- `/lite/onboarding` is dual-purpose — don't break the admin Brand DNA placeholder branch.
- Cross-product guard at `/get-started/checkout` needs `deals.saas_product_id` match + `subscription_state ∈ {active, past_due, incomplete}`.
- G10.5 required for SB-6b — this is a Brand DNA flagship-adjacent surface.

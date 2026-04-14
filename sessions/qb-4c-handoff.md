# QB-4c — Stripe Payment Intent + accept side-effects — handoff

**Closed:** 2026-04-14 · Wave 6 · `/deep` Opus

## What landed

- **`/api/quotes/[token]/payment-intent` (POST)** — creates or reuses a PaymentIntent per quote. Idempotency key `quote_pi:{quote_id}`. `automatic_payment_methods.enabled`. Stamps `metadata: {product_type:"quote", quote_id, deal_id, company_id, structure}`. Ensures Stripe Customer via `ensureStripeCustomer()`, keeps email/name fresh, denormalises `stripe_payment_intent_id` on quotes + `stripe_customer_id` on deals. Reused when PI is still `requires_payment_method` / `requires_confirmation` / `requires_action`.
- **`lib/quote-builder/accept.ts · acceptQuote()`** — the real side-effect engine. Loads quote/deal/company/primaryContact, idempotent on `status="accepted"`, rejects non-`sent|viewed`. Computes `committed_until_date_ms` for retainer/mixed via UTC month arithmetic. Captures proof: ip, user-agent, `accepted_content_hash` (sha256 of `content_json`), `accepted_tos_version_id`, `accepted_privacy_version_id` (resolved via new `lib/quote-builder/legal.ts`). Atomic `transitionQuoteStatus(sent|viewed → accepted)` with patch, plus a trailing UPDATE for legal version IDs. Logs `quote_accepted` activity.
  - **Manual mode:** synchronous `finaliseDealAsWon` (try/catch for already-won), enqueue `manual_invoice_generate:{deal}:0`, enqueue settle email via `enqueueManualSettleEmail`.
  - **Stripe mode:** defers deal-win / subscription / settle email to the webhook. Quote still flips to `accepted` synchronously so proof-of-acceptance is captured before the Payment Element confirms.
- **`app/lite/quotes/[token]/actions.ts · acceptQuoteAction()`** — thin wrapper around `acceptQuote()`. Reads ip/user-agent from `headers()`. Returns `{ok:true, paymentMode}` or `{ok:false, error}`.
- **Client components** (`components/lite/quote-builder/`):
  - `quote-accept-block.tsx` — state machine `idle → payment → confirming → confirmed`. `layoutId="quote-primary-action"` morphs the Accept button into the Payment Element card and finally the confirmation card. On `paymentMode="manual"` the flow skips straight `idle → confirmed`. Calls `onPhaseChange` so the parent can dim the surrounding sections.
  - `quote-payment-element.tsx` — `PaymentElementHost` fetches `clientSecret` from the new PI route, mounts `<Elements>` with `appearance.variables.colorPrimary="#cc2a2a"`. Inner `PayForm` exposes `handleRef.current.confirm()` which calls `stripe.confirmPayment({elements, confirmParams:{return_url}, redirect:"if_required"})`.
  - `quote-web-experience.tsx` — new `paymentMode` prop; Section component now accepts `isDimmed` and applies `opacity:0.15 blur(2px)` + `transition-all duration-300` when the accept block is mid-flow; `Stepper` gains a `locked` prop (`pointerEvents:none opacity:0.3`) that engages for `payment` / `confirming`. Dead `AcceptBlock` + `statusMessage` helpers removed. New `PreviewAcceptPlaceholder` for the Send modal preview column.
- **`app/lite/quotes/[token]/page.tsx`** — passes `paymentMode={company.billing_mode}`.
- **Webhook: `lib/stripe/webhook-handlers/payment-intent-succeeded.ts`** — rewritten. Branches on `metadata.product_type==="quote"` (otherwise returns `skipped: covered_by_checkout_session`). Logs `quote_settled`. Calls `finaliseDealAsWon` (won_outcome `retainer` for `structure="retainer"`, `project` for `project|mixed`) wrapped in try/catch. For retainer/mixed with non-null `retainer_monthly_cents_inc_gst`: creates a per-quote Stripe Product, then a Subscription with inline `price_data` (`product: product.id`, `recurring:{interval:"month"}`). Stamps `stripe_subscription_id` on quotes + deals and sets `deals.subscription_state="active"` + `committed_until_date_ms`. Enqueues stripe settle email via `enqueueStripeSettleEmail`. Stripe client imported lazily inside the branch so empty `STRIPE_SECRET_KEY` in unit tests doesn't blow up the module-load of `webhook-handlers/index.ts`.
- **Schema: migration `0018_qb4c_quote_accept_legal_versions.sql`** — two nullable FK cols on `quotes`: `accepted_tos_version_id`, `accepted_privacy_version_id` (→ `legal_doc_versions.id`). Drizzle statement-breakpoint marker between the two `ALTER`s so the runtime migrator splits the SQL correctly. Journal idx 18.
- **Env: `.env.example`** — added `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (browser-visible, safely equal to `STRIPE_PUBLISHABLE_KEY`).
- **New deps (flagged):** `@stripe/stripe-js`, `@stripe/react-stripe-js`. Essential for Payment Element — `spec §7.1` calls for inline Payment Element (not Checkout redirect) so the Tier-2 morph works.

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — **77 test files, 556 passed, 1 skipped**.
- Manual browser verification **deferred** (`dev.db` migration mismatch; BDA-4, QB-2b, QB-3, QB-4a, QB-4b all sit on the same backlog — non-blocking per the standing carry).

## Key decisions

- **PaymentIntent, not Checkout Session.** Spec §7.1 was ambiguous until §7.3 locked in dynamic-amount PI + client-side `confirmPayment` so the Tier-2 shared-element morph works. Existing Checkout Session flows (Intro Funnel, SaaS) stay on `checkout.session.completed`; quote adds a new `product_type="quote"` branch in `payment-intent-succeeded`.
- **Per-quote Stripe Product.** Subscription item price_data needs `product: string` not `product_data`. Rather than maintain a Stripe Product catalogue, we create a Product per quote at subscription time and tag it with `metadata.{quote_id, deal_id}`. Cheap and self-documenting in the Stripe dashboard.
- **Stripe client is lazy-imported inside the subscription branch.** `lib/stripe/client.ts` throws when `STRIPE_SECRET_KEY` is unset; test environment doesn't set it. Lazy import keeps the webhook dispatch tests green without a test-harness env hack.
- **Proof capture is sync; subscription + settle are async.** Acceptance flips `status="accepted"` + stamps proof immediately (Server Action), then the Payment Element confirms client-side. If payment fails later, spec §7.1 requires the quote to *stay* accepted — the webhook is not the proof gate.
- **`subscription_started` logged as `kind:"note" + meta.kind:"subscription_started"`** — it's not in the activity_log enum; matches the SP-9 precedent for unknown kinds rather than growing the enum this session.

## Carry

- Manual browser verify (QB-2b, QB-3, QB-4a, QB-4b, QB-4c) — all gated on a `dev.db` reseed that hasn't been booked.
- No sound on accept (see PATCHES_OWED `qb4c_sound_quote_accepted_emit`).
- Subscription lifecycle webhooks not wired (`qb4c_subscription_lifecycle_webhooks`).
- `manual_invoice_generate` handler still throws NotImplementedError — Branded Invoicing owns it (`qb4c_manual_invoice_generate_handler`).
- `payment_intent.payment_failed` not registered — trivial skipped entry owed by QB-5 (`qb4c_payment_failed_handler`).
- Unit tests for `acceptQuote()` and `payment-intent-succeeded`'s new quote branch NOT written this session — full test suite still green, but coverage is thin on the new code paths. Land in QB-5 or a dedicated mini-session.

## What the next session needs

**Wave 6 QB-5 — Stripe metadata contract + send/sent side-effects.** Pre-session reads:
- `docs/specs/quote-builder.md` §7.1 + §7.3
- `PATCHES_OWED.md` rows `sp7_if_stripe_metadata_contract`, `sp7_qb_stripe_metadata_contract`, and every `qb4c_*` row from this session
- `sessions/qb-4c-handoff.md` (this file), `sessions/qb-4b-handoff.md`
- `BUILD_PLAN.md` Wave 6

QB-5 may also be where the Stripe webhook receiver adds `payment_intent.payment_failed` (trivial skipped) and the first subscription-lifecycle handlers land — decide at session kickoff.

# BI-2b brief — Branded Invoicing Stripe + client experience + Claude emails

**Wave:** 7. **Tier:** `/deep` required (Stripe Payment Element + `payment_intent.succeeded` webhook + 4 Claude-drafted emails each drift-checked against Brand DNA + client two-section scroll-snap). **Split from:** original `bi-2-brief.md` — BI-2 was realistically two sessions; BI-2a owns admin surfaces, BI-2b owns integrations + client experience + AI drafting. **Pre-authored by:** BI-2a (G11.b).

## Why this session

BI-2a delivered Andy's admin control panel over manual-billed invoices. What's still missing before branded invoicing is "done":
- Clients can't pay online — no Stripe Payment Element on the token web view.
- The token web view is minimum-viable (BI-1b); it needs the full branded two-section scroll-snap experience.
- Every invoice email is currently deterministic. Spec §4.6 requires Claude-drafted, drift-checked emails for send / overdue reminder / manual follow-up / supersede.
- `ensureStripeCustomer()` is still unwired — blocking PATCHES_OWED.
- `SUPERBAD_ABN` / `SUPERBAD_BILLING_EMAIL` env seeding still owed.

BI-2b closes all of this.

## Pre-conditions (verify before coding)

- Read `sessions/bi-1a-handoff.md` + `sessions/bi-1b-handoff.md` + `sessions/bi-2a-handoff.md` end-to-end.
- Read `docs/specs/branded-invoicing.md` §4.4 + §4.5 + §4.6 + §6 (Claude prompts) + §7 (Stripe integration).
- Read `app/lite/quotes/[token]/` — the Quote Builder client experience is the visual + motion reference.
- Read `components/lite/quote-builder/quote-payment-element.tsx` + `lib/quote-builder/accept.ts` — the Payment Element + PI pattern to mirror.
- Read `lib/ai/prompts/quote-builder/*` + `lib/ai/registry.ts` — the prompt-file-per-slot + drift-check pattern to mirror.
- Read `app/api/stripe/webhook/route.ts` (or wherever the Stripe webhook router lives) + the existing `payment_intent.succeeded` handler — extend, don't duplicate.
- Read FOUNDATIONS §11.7 — `ensureStripeCustomer(contactId)` contract and the no-direct-`stripe.customers.create`-import ESLint rule.
- Confirm `killSwitches.invoicing_manual_cycle_enqueue_enabled === true`.

## Expected scope

**Stripe integration:**
1. `ensureStripeCustomer(deal.primary_contact_id)` call on every Stripe-touching path: (a) before creating a PI for an invoice, (b) inside the `payment_intent.succeeded` handler if the customer wasn't already attached. Closes PATCHES_OWED row `bi1_ensure_stripe_customer_precondition`.
2. New route `app/api/invoices/[token]/payment-intent/route.ts` — POST; token-gated; creates a PaymentIntent with `automatic_payment_methods.enabled: true`, `metadata.product_type="invoice"`, `metadata.invoice_id=<id>`, `customer=<ensured>`, `idempotencyKey: invoice_pi:{id}`. Reuses existing PI on re-POST.
3. `payment_intent.succeeded` handler extension — gate on `metadata.product_type==="invoice"`. Calls `markInvoicePaid({invoiceId, paidVia: "stripe", stripePaymentIntentId})`. Logs `invoice_paid_online`. Enqueues any next-cycle chain unchanged (handler stays a pure transition). Safe on re-delivery (idempotent via `markInvoicePaid`).
4. `payment_intent.payment_failed` handler — log-only for invoices; mirror QB-5 pattern.

**Client-facing branded web experience** (`app/lite/invoices/[token]/page.tsx` — replaces BI-1b minimum viable):
1. Two-section scroll-snap layout (spec §4.4) mirroring Quote Builder's scroll-snap shell. Section one = invoice (masthead / Tax-Invoice title / meta / parties / scope summary / line-items / totals / "View original proposal →"). Section two = payment (bank-transfer details first / Stripe Payment Element inline / sprinkle / fine print).
2. Payment Element mount via `<Elements>` with POST-fetched `clientSecret`. `confirmPayment({redirect: "if_required"})`. Cinematic inline reveal — **inherits Quote Builder's Tier-2 motion slot** (shared `layoutId="quote-primary-action"` pattern; no new slot).
3. Post-payment state (replaces section two): "Paid" badge, receipt reference (Stripe PI id), "Download PDF" CTA (paid variant), sprinkle `"paid in full. pleasure doing business."`.
4. Overdue state: subtle "This invoice is overdue" indicator above payment options. Warm, factual.
5. Void state (superseded): gentle redirect card "This invoice has been updated." + "View the current version →" link to replacement invoice web URL. Mirror Quote Builder superseded-URL treatment.
6. Full suppression — zero hidden eggs on this surface; ambient voice only (per memory `feedback_surprise_and_delight_philosophy`).

**Claude-drafted emails** (prompt files under `lib/ai/prompts/branded-invoicing/`):
1. `invoice-send.ts` — Opus; contextual subject + body; reads Brand DNA + Client Context Engine; drift-checked.
2. `invoice-overdue-reminder.ts` — Opus; warm, not aggressive; references invoice number + amount.
3. `invoice-manual-followup.ts` — Opus; aware of `reminder_count` + days-overdue + Brand DNA + Context; Andy previews in send-modal before dispatch.
4. `invoice-supersede.ts` — Opus; references superseded invoice number.
- All routed through `lib/ai/registry.ts` with new slugs: `branded-invoicing-draft-send-email` / `…-overdue-reminder` / `…-manual-followup` / `…-supersede`.
- All drift-checked against `superbad_self` Brand DNA + the client Brand DNA profile. On drift-check fail OR kill-switch OR empty-context → fallback to the deterministic `compose*Email` variants from BI-1a (already in place).
- Replace deterministic composer call-sites with registry-routed Claude drafting behind the drift-check wrapper. Deterministic composers stay as fallback paths.

**Send modal** (for manual follow-up):
- Mirror `components/lite/quote-builder/send-quote-modal.tsx`. Drift badge + 60-char subject counter + Andy-edit-before-send. Dispatch on confirm.

**Env seeding:**
- Add `SUPERBAD_ABN` + `SUPERBAD_BILLING_EMAIL` to `.env.example` with documented-default comments.
- Document on deploy-target notes (wherever `LAUNCH_READY.md` lists env).
- Closes reviewer note BI-1b #1.

**Spec-gap sweep:**
- Close `qbe2e_manual_quote_settled_missing` if it belongs on the new `invoice_paid` transition (the manual-accept path now settles via `manual_invoice_generate → send → paid`). Document the close in PATCHES_OWED.

## Out of scope

- BAS / EOFY export bundling (Finance Dashboard owns).
- PDF caching (render-fresh is fine; measure before optimising).
- New admin surfaces — BI-2a closed that out.

## Gates (G0–G12)

- G0–G3 pre-reads (spec + all three BI handoffs + registry + kill-switches + FOUNDATIONS §11.7).
- G4 literal grep — any new setting (e.g. Stripe-related timeouts) must flow through `settings.get()`; no magic numbers.
- G5 rollback — Stripe webhook handler is additive (metadata-gated on `product_type==="invoice"`); revert via git. Payment Element is a client-surface addition; revert = client view falls back to BI-1b minimum-viable. Kill-switch path: re-flip `invoicing_manual_cycle_enqueue_enabled → false` stops new invoice chains.
- G10 motion — `layoutId` Tier-2 morph for the Payment Element reveal; houseSpring; reduced-motion parity.
- G10.5 external reviewer — **required** (Stripe payment surface + Claude-drafted drift-checked emails + client public surface all warrant external eyes). Flag explicitly.
- G11 budget checkpoint — if all four Claude prompts + drift-check wiring + scroll-snap + Payment Element + webhook handler are in flight at 70% context, split `bi-2b-ii` for Claude emails and land Stripe + client UI first.
- G11.b — close by writing `sessions/bi-e2e-brief.md` (full wave-closing Playwright E2E on the deal → quote → accept → invoice → pay chain).
- G12 typecheck + tests — include Playwright E2E against at least the online-payment flow (metadata + PI + webhook → paid state).

## Tests owed

- Stripe integration: PI creation + idempotency + webhook-dispatch mapping from `metadata.product_type="invoice"` → `markInvoicePaid` + double-delivery idempotency.
- Drift-check: each of the four prompts rejected body → deterministic fallback path.
- Client page: scroll-snap renders two sections; void/overdue/paid state branches; Payment Element mounts when `status IN (sent, overdue)`.
- E2E: accept retainer quote → `manual_invoice_generate` fires → send → client opens token URL → pays via Payment Element → webhook → UI flips to paid.

## Open items carried forward

- BI-E2E session is the wave closer.
- Post-launch: measure reminder open/reply rates and consider Claude-prompt refinement.

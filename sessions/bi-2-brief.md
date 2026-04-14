# BI-2 brief — Branded Invoicing admin surfaces + client payment experience

**Wave:** 7. **Tier:** `/deep` recommended (multi-surface; Stripe payment; Claude-drafted emails; drift-check). **Pre-authored by:** BI-1b (G11.b).

## Why this session

BI-1a + BI-1b landed the full pipeline + PDF + minimum-viable token web view, and flipped `killSwitches.invoicing_manual_cycle_enqueue_enabled → true`. Every retainer accept now enqueues a `manual_invoice_generate` task that auto-chains: generate (3-day review window) → send → 3-day-overdue reminder → next cycle. What's missing is (a) Andy's admin surfaces to see/touch invoices, and (b) the client-facing branded payment experience. BI-2 owns both.

## Pre-conditions (verify before coding)

- Read `sessions/bi-1a-handoff.md` + `sessions/bi-1b-handoff.md` end-to-end.
- Read `docs/specs/branded-invoicing.md` §4.1–4.4 + §4.6 fresh.
- Confirm `killSwitches.invoicing_manual_cycle_enqueue_enabled === true`.
- `lib/invoicing/{generate,send,mark-paid,sweep,transitions,compose-emails,pdf-template,render-invoice-pdf}.ts` — all exist; reuse.
- PATCHES_OWED row for `ensureStripeCustomer()` precondition — **apply in this session** on every Stripe-touching path (Payment Element mount, `payment_intent.succeeded` handler).
- Ensure `SUPERBAD_ABN` + `SUPERBAD_BILLING_EMAIL` env vars are seeded in `.env.example` + deploy-target docs.

## Expected scope

**Admin surfaces** (behind auth):
1. **Invoice index** `/lite/admin/invoices` — filterable list (All / Draft / Sent / Overdue / Paid / Void), summary cards, `?filter=<name>` deep-link support.
2. **Invoice detail / drawer** — actions by status per spec §4.3 (Send now, Add line item, Void, Supersede, Send reminder, Mark as paid, Preview PDF, Preview web view).
3. **Compose / pre-send review** — drives the 3-day auto-send window. Andy adds one-off line items, adjusts due date, previews PDF, sends immediately or lets the timer run.
4. **Supersede flow** — void + reissue; email variant; link from superseded token to replacement.
5. **Company profile billing tab** — same list component filtered to a company.
6. **"Send reminder" manual button** — Claude-drafts a contextual chase; preview-before-send modal.
7. **Mark-as-paid** — admin button (bank-transfer path); calls `markInvoicePaid()`.

**Client-facing branded web experience** (`/lite/invoices/[token]`, replaces BI-1b minimum viable):
1. Two-section scroll-snap: section one = the invoice (masthead/title/meta/parties/scope/line-items/totals), section two = payment (bank-transfer details + Stripe Payment Element + "View original proposal" + footer sprinkle).
2. Post-payment state replaces section two: "Paid" badge, receipt reference, Download-PDF (paid variant), sprinkle `"paid in full. pleasure doing business."`.
3. Overdue state: subtle "overdue" indicator above payment options. Warm, not aggressive.
4. Void state: gentle redirect card to replacement invoice (mirrors quote supersede pattern).
5. Full suppression: zero hidden eggs; ambient voice only.

**Claude-drafted emails** (`lib/ai/prompts/branded-invoicing/`):
1. Send email (contextual subject + body + PDF attachment + "View online →").
2. Overdue reminder (warm, referenced invoice + amount, no PDF re-attach).
3. Manual follow-up (Andy-triggered; aware of reminder count + days overdue).
4. Supersede notification (replaces prior invoice; new PDF attached).
5. All drift-checked against Brand DNA + Context Engine.

**Stripe integration**:
1. `ensureStripeCustomer(deal.primary_contact_id)` on every Stripe-touching path (PATCHES_OWED row).
2. Payment Element mount + `payment_intent.succeeded` webhook handler that matches by metadata and transitions to `paid` + logs `invoice_paid_online`.
3. Safe failure modes for Stripe declines (no state change on payment failure).

## Out-of-scope (defer to later wave)

- Invoice analytics / BAS dashboards (Finance Dashboard owns).
- Multi-document export bundling (Finance Dashboard owns; primitive lives in `lib/pdf/render.ts`).
- PDF caching (BI-1b renders fresh every request; optimise only if hot).

## Gates (G0–G12)

- G0–G3 pre-reads (spec + handoffs + registry + kill-switches).
- G4 literal grep — autonomy thresholds must flow through `settings.get()`.
- G5 rollback — kill-switch re-flip is the hard rollback; admin surfaces are behind auth so no public blast radius.
- G10.5 external reviewer — required before session close (Stripe + client-facing payment surface warrants it).
- G11.b — write `sessions/bi-3-brief.md` (if BI-3 exists) or close wave into BI-E2E.

## Open items carried forward

- `bi1_ensure_stripe_customer_precondition` (PATCHES_OWED) — **must close in this session**.
- `SUPERBAD_ABN` / `SUPERBAD_BILLING_EMAIL` env seeding (reviewer note BI-1b #1).
- `qbe2e_manual_quote_settled_missing` — consider closing in-session if the manual `quote_settled` path belongs on the new `invoice_paid` transition (spec gap check).
- BI-E2E session is the natural successor once BI-2 is green.

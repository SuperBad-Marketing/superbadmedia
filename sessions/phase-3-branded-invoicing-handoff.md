# Phase 3 — Branded Invoicing — Handoff Note

**Date:** 2026-04-12
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/branded-invoicing.md`
**Status:** Locked, 25 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for Branded Invoicing — the invoice generation and delivery system for manual-billed companies. 25 multi-choice questions asked, all locked. No pushbacks or mid-brainstorm corrections from Andy — decisions landed cleanly. One correction on Q24 (Andy caught that "paid in full" can't appear on an unpaid invoice PDF) which led to the split treatment for the sprinkle claim.

**Spec structure (15 sections):**
1. Purpose and shape
2. The 25 locks (quick-reference table)
3. End-to-end journey (automated cycle + manual create + supersede)
4. Surfaces and UI (index page, company billing tab, admin detail, web view, PDF, emails)
5. Data model (1 new table, column additions)
6. Claude prompts (3 prompts: send email, reminder, supersede notification)
7. Stripe integration (Payment Intent for online payment, webhook handling)
8. Scheduled-tasks integration (3 handlers, overdue sweep)
9. Two-step primitive interface (`generateInvoice` + `sendInvoice`)
10. Voice & delight treatment (sprinkle claim + suppression)
11. Cross-spec flags
12. Content mini-session scope
13. Open questions
14. Risks
15. Reality check

---

## 2. Key decisions summary

- **Year-prefixed sequential numbering** (`SB-INV-2026-0001`) — parallel to Quote Builder.
- **Two-step primitive:** `generateInvoice()` creates draft, `sendInvoice()` dispatches. Clean seam for the add-on review flow.
- **3-day pre-send review window:** worker generates draft 3 days early, cockpit notifies Andy, auto-sends if he doesn't intervene. Add-on line items are additive only — recurring lines from the quote are never edited.
- **Two tasks per cycle:** `manual_invoice_generate` + `manual_invoice_send`, self-perpetuating chain.
- **Per-company payment terms** (default 14 days) — set once on the company profile.
- **Bank transfer primary + optional Stripe online payment** — respects why manual-billed clients are manual-billed.
- **One-click mark-as-paid** — no form, no amount confirmation. Andy is the source of truth.
- **5-state lifecycle:** draft / sent / overdue / paid / void. Overdue transitions automatically.
- **One automated reminder 3 days after due date** + manual follow-ups Andy can trigger any time.
- **Full branded web view** — two scroll-snap sections (invoice + payment), inline Payment Element, in-page post-payment confirmation.
- **Shared PDF renderer** with Quote Builder, separate tax invoice template.
- **Email with PDF attached** — diverges from Quote Builder's link-only pattern because invoices are filing-cabinet documents.
- **No credit notes in v1** — void + reissue via supersede covers the common case.
- **Sprinkle split:** dry footer on unpaid PDF (content mini-session), *"paid in full. pleasure doing business."* on web view paid confirmation.
- **Full hidden-egg suppression** on all invoice surfaces.

---

## 3. Quote Builder handler refinement

The original Quote Builder spec described a single `handleManualInvoiceSend` handler that calls `generateInvoice()` + `sendInvoice()`. Branded Invoicing refines this into two separate tasks per cycle:

- `handleManualInvoiceGenerate` — creates the draft, fires cockpit notification, enqueues the send task.
- `handleManualInvoiceSend` — checks status and sends (or skips if Andy already sent/voided).

**Impact on Quote Builder's spec:** the settle handler for manual-billed quotes now enqueues `manual_invoice_generate` (not `manual_invoice_send`). The handler map gains one new entry. The `manual_invoice_send` handler narrows from "generate + send" to "send only with status precondition." This is a non-breaking refinement — the handler signature from Quote Builder §8.3 is preserved, the payload shape changes slightly (adds `invoice_id` since the invoice row now already exists when send fires).

---

## 4. Cross-spec flags (consolidated)

### 4.1 Quote Builder
- First cycle enqueue at quote settle changes from `manual_invoice_send` to `manual_invoice_generate`.
- Handler map gains `manual_invoice_generate` entry.
- `manual_invoice_send` handler narrows to send-only.

### 4.2 Sales Pipeline
- `companies` gains `payment_terms_days` (integer, default 14).
- `activity_log.kind` gains 8 new values.

### 4.3 Daily Cockpit
- Consumes: draft-review-window cards, overdue invoice cards, failed invoice task escalations.

### 4.4 Client Management
- Company profile gains a Billing tab (payment terms, invoice list, "New invoice" button).

### 4.5 Client Portal
- Read-only invoice list + pay-online links for the client's invoices.

### 4.6 Comms Inbox
- Invoice emails thread via `In-Reply-To` / `References`, same pattern as Quote Builder.

### 4.7 Foundations
- `sendEmail({ classification: 'transactional' })` dependency (already owed).

### 4.8 Design System Baseline
- No new motion slots. No new sound slots.

---

## 5. New tables

- **`invoices`** — full schema in spec §5.1.

One new table only. All other changes are column additions to existing tables (`companies.payment_terms_days`, `activity_log.kind` enum, `scheduled_tasks.task_type` enum).

---

## 6. No new memories

No new principles surfaced. The spec applied existing memories (`feedback_felt_experience_wins`, `feedback_individual_feel`, `project_client_size_diversity`, `feedback_surprise_and_delight_philosophy`) without needing new ones.

---

## 7. Content mini-session scope

Smaller than Quote Builder's content session. Can fold into that session or run independently:
- Invoice PDF footer dry line
- Example email outputs (send, reminder, follow-up, supersede)
- Web view copy (section headings, payment instructions, overdue indicator, void/superseded cards, confirmation)
- Empty-state copy for invoice index

---

## 8. What the next session should know

### 8.1 Next recommended spec: Brand DNA Assessment

Brand DNA Assessment (#5 in the backlog) is the next major spec and one of the largest. It's the premium retainer differentiator — 50–100 indirect-signal MC questions per bank, dual-mode (Founder / Business), shape-aware delivery, multi-stakeholder blending, signal-tag output, reusable as perpetual LLM context. Several downstream specs depend on it: Onboarding + Segmentation, Client Context Engine, Surprise & Delight (build ordering), Content Engine.

Andy should load `superbad-brand-voice` and `superbad-visual-identity` skills at session start — question bank design is creative work.

### 8.2 Phase 5 sizing for Branded Invoicing

2 sessions:
- **Session A:** data model + primitives + handlers + PDF template + mark-as-paid. Must land before Quote Builder Session C.
- **Session B:** web view + Payment Element + index page + company billing tab + manual create + manual follow-up.

### 8.3 Things easily missed

- **The review window's 3-day gap.** Every handler must be defensive about stale state. Deal cancelled mid-window, Andy voids the draft, quote superseded upstream — all need graceful handling via status precondition checks.
- **GST rounding.** Derive at the total level, not per line item, to avoid rounding discrepancies.
- **`companies.payment_terms_days` default.** Must be set to 14 at migration time for all existing companies. Don't leave it null.
- **Bank details source.** SuperBad's BSB + account number need to live in Lite's config somewhere. Resolve in the setup wizard spec or Phase 5 infra session.
- **PDF storage vs re-render.** Open question — store after send, re-render on status change (paid stamp). Resolve in Phase 5.

---

## 9. Backlog state

**Phase 3 spec backlog: 16 total, 7 locked, 9 remaining.**

Locked: Lead Generation, Intro Funnel, Quote Builder, Design System Baseline, Sales Pipeline, Surprise & Delight (pre-written), Task Manager, **Branded Invoicing** (this session).

Next recommended: Brand DNA Assessment (#5).

---

**End of handoff.**

# Quote Builder — Feature Spec

**Phase 3 output. Locked 2026-04-12.**

> **Prompt files:** `lib/ai/prompts/quote-builder.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

The Quote Builder is SuperBad Lite's surface for turning a Pipeline deal at the **Conversation** or **Trial Shoot** stage into a committed, priced, payable proposal — and for handling everything that happens after the client says yes, up to and including their exit from the relationship months later. It owns the entire lifecycle of a priced document: drafting, sending, viewing, accepting, paying, superseding, expiring, renewing, and cancelling. It composes the five FOUNDATIONS §11 cross-cutting primitives, inherits Intro Funnel's cinematic Payment Element pattern (no new Tier-2 motion slot spent), and introduces one new shared primitive — the `scheduled_tasks` worker — that every subsequent Phase 3 spec can build on.

Integration with the Sales Pipeline (`docs/specs/sales-pipeline.md`) is via `transitionDealStage()` at send (Conversation/Trial Shoot → **Quoted**) and at settle (Quoted → **Won**), with `deals.won_outcome` set to `'retainer'` or `'project'` based on the accepted quote's structure. Integration with the Intro Funnel (`docs/specs/intro-funnel.md`) is via the retainer-fit recommendation that lands in Andy's cockpit after a trial shoot — Quote Builder consumes that recommendation as context when drafting the first quote for a recently-shot lead.

---

## 1. Purpose and shape

A quote in SuperBad Lite is **a premium branded document that happens to transact**, not a PDF that happens to be branded. That framing distinguishes it from every generic "invoice tool" pattern and dictates decisions across the spec:

- The web page is editorial and cinematic, not a pricing table with a "Pay now" button.
- The draft flow is Claude-assisted from context by default — Andy can fall through to a blank slate but shouldn't have to.
- The accept → pay transition is the same physical surface becoming the next thing, not a modal takeover or a route change.
- The PDF is a deliberate second artefact for forwarding internally, not a compressed snapshot of the web page.
- The cancel flow honours commitment by charging a real exit fee or routing to a human conversation, never by trapping the client.

The Quote Builder is the first Lite feature where **money actually moves**. This makes it the canary for Stripe Payment Intent + Subscription + webhook idempotency wired end-to-end, and for the `scheduled_tasks` primitive introduced here. Any gap in §11 or in the Pipeline's Won/Lost transitions becomes visible here first.

Quote Builder **only handles retainer and project quoting for SuperBad's clients**. SaaS subscription billing (Lite-as-SaaS-to-other-operators) has its own separate flow in `docs/specs/saas-subscription-billing.md` — public signup, not quote-based — but the early-cancel retention flow and the `scheduled_tasks` primitive are both shared infrastructure that this spec locks first and SaaS inherits.

---

## 2. The 21 locks (quick reference)

| # | Decision | Detail |
|---|---|---|
| Q1 | **Quote structure** | Stage-gated proposal with named sections (*What you told us* → *What we'll do* → *Price* → *Terms* → *Accept*), not flat line items. Sections render as scroll-snap panels on the web page. |
| Q2 | **Mixed structure support** | A single quote can hold both a recurring retainer component and one-off line items settled on the first invoice via Stripe `add_invoice_items`. `quotes.structure` enum: `retainer` / `project` / `mixed`. |
| Q3 | **Drafting mode** | Three modes in the draft editor: **Claude draft-from-context** (default, Opus-tier), **template load**, **blank**. All three land in the same two-pane editor. |
| Q4 | **Term length** | Per-quote picker — 3 / 6 / 12 months, or custom. No global default, no fixed tiers. `quotes.term_length_months` integer. |
| Q5 | **Billing mode per company** | `companies.billing_mode` enum from Pipeline: `stripe` / `manual`. Quote respects it. Manual-billed quotes schedule monthly PDF invoice auto-send (owned by `branded-invoicing.md`, scheduled via the primitive in §8 here). |
| Q6 | **GST storage and display** | **GST-inclusive is canonical.** Store `base_price_cents_inc_gst`, derive ex-GST for downstream tax invoices. Rationale: felt experience (no post-total surprise). Principle: *when convention and felt experience conflict, felt experience wins unless compliance forces the convention.* Tax invoice compliance handled downstream by Stripe receipts (Stripe-billed) or Branded Invoicing PDFs (manual-billed). |
| Q7 | **Quote state machine** | 7 states: `draft` / `sent` / `viewed` / `accepted` / `superseded` / `withdrawn` / `expired`. View tracking via token-URL first-fetch timestamp. |
| Q8 | **Expiry** | Per-quote expiry picker with default 14 days. Stored as `quotes.expires_at`. Sweeps via `scheduled_tasks`. |
| Q9 | **Catalogue content deferral** | Structural shape in this spec; actual catalogue categories, units, seeded items, retainer tier names, and starter templates authored in a follow-up **Quote Builder content mini-session** loaded with `superbad-business-context` + `superbad-brand-voice` skills. |
| Q10 | **Catalogue shape** | Structured `catalogue_items` table with `category`, `unit` enum (`hour` / `day` / `project` / `month` / `piece`), `base_price_cents_inc_gst`, `tier_rank` integer (retainers only, nullable). Snapshot-on-add into the quote row to preserve audit cleanliness across catalogue changes. |
| Q11 | **Web page layout** | Scroll-snap vertical sections (Q1's 5 sections) with a sticky right-side stepper indicator (progress + jumplinks). `scroll-snap-type: y proximity`, `min-height: 100dvh` per section, IntersectionObserver with `threshold: 0.3` for stepper sync. |
| Q12 | **Draft editor layout** | Two-pane split — left: structured editor (section headers + fields), right: live preview rendering exactly what the client will see. Pane ratio 40/60. Debounced 300ms on edits. |
| Q13 | **Send email composition** | Claude-drafted per-quote (`draft-send-email.ts`), drift-checked, Andy reviews in send modal before dispatch. Output schema `{subject_line, body_paragraphs, sign_off}`. Max 60-char subject. URL rendered as a button in HTML, excluded from Claude's body text. Link-only delivery (no PDF attachment — deliverability, experience-routing, view-tracking). |
| Q14 | **PDF shape** | Deliberate second artefact — invoice-style one-pager (Puppeteer rendering `app/lite/quotes/[token]/pdf/page.tsx`). Masthead → quote number + dates → client + ABN block → one-line scope summary → line items table → total inc-GST → term length + commitment note → dry cover line (sprinkle claim) → terms link → "Accept online →" CTA back to web page. Not a compression of the web page. |
| Q15 | **Accept → Pay transition** | Same-page reveal — Payment Element blooms inline via Framer `layoutId` transform. Inherits Intro Funnel's existing Tier-2 cinematic Payment Element slot (**no new motion slot spent**; closed-list count unchanged). Mount-on-tickbox. Step-back affordance. Inline error recovery. |
| Q16 | **Post-accept confirmation** | Shared shell, billing-mode-specific content. Both modes get masthead + Playfair italic dry line + "Andy's got it from here." Stripe-billed shows receipt ref + download-receipt link + Billing Portal link. Manual-billed shows "first invoice lands {date}" + "my invoices" link. |
| Q17 | **"What you told us" drafting** | Pyramid synthesis via Opus-tier Claude prompt (`draft-intro-paragraph.ts`). Reads all available sources with explicit rank weighting per the `feedback_client_doc_source_hierarchy` memory: **client docs > direct notes > activity log > Brand DNA + Client Context Engine**. Higher rank wins conflicts. Rank-4-only case produces an empty-state placeholder, not a robo-paragraph. Drift-checked. |
| Q18 | **Scheduled-job primitive** | New `scheduled_tasks` table + single Node cron worker on Coolify, polymorphic `task_type` enum with handler map dispatch. Polls every minute. Idempotency keys, stale-row reclaim, exponential retry. Inherited by every future spec that needs scheduling. |
| Q19 | **Sound registry addition** | One new sound: `sound:quote_accepted` — admin-cockpit-only, idempotent per quote. Registry count 7 → 8. Customer-facing audio explicitly withdrawn from Q15. |
| Q20 | **Edit after send** | Supersede via new row with `supersedes_quote_id` FK. Original row preserved with `status = 'superseded'`, rendered as a gentle redirect card at its old URL. Hash-based `accepted_content_hash` computed at Send (invariant after). Drafts freely mutable; sent quotes immutable. |
| Q21 | **Commitment enforcement + retention** | **Retainer early cancel:** 3 options — *"let's chat"* intercept (no charge), pay remainder, 50% buyout. **SaaS early cancel:** 3 options — pay remainder, 1-month pause (one per commitment, extends `committed_until_date`), continue. **Post-term cancel (both):** retention page with upgrade / downgrade / "here's what you'd be losing" / cancel through. No discounts, ever. Lives in the future Client Portal spec as `/lite/portal/subscription`. |

---

## 3. End-to-end journey

Narrated once so every subsequent section has a shared mental model. Two parallel tracks: Andy side (drafting + sending) and Client side (receiving + paying). Plus the long tail (renewal + cancel).

### 3.1 Andy side

1. **Trigger.** A deal in the pipeline reaches a state where Andy decides to quote: post–trial-shoot with a retainer-fit recommendation in the cockpit, or a Conversation-stage deal Andy wants to pitch cold. Andy opens the deal drawer → clicks **"Quote"** button → draft editor opens.

2. **Drafting mode selection.** The draft editor opens in one of three initial states (Q3):
   - **Claude draft-from-context** (default) — a background call to `draft-quote-from-context.ts` has already fired the moment Andy clicked "Quote", using retainer-fit recommendation (if present), Brand DNA, Client Context, activity log highlights, and any client docs on the deal. By the time Andy sees the editor (~2–4s wait with a subtle loading shimmer), the left pane is pre-populated with a drafted quote structure. Andy reviews and edits.
   - **Template load** — Andy picks from a dropdown of named templates (`quote_templates` table, CRUD via Settings → Templates). Template loads into the left pane, fields populate with template defaults. Andy edits per-deal.
   - **Blank** — empty fields, Andy fills in manually. Same two-pane editor.

3. **Two-pane editor (Q12).** 40/60 split. Left: structured editor with section headers (Q1's 5 sections), line-item picker pulling from `catalogue_items` with override capability, term-length picker (Q4), expiry picker (Q8), billing-mode indicator (read-only, derived from `companies.billing_mode`), buyout-percentage field (hidden by default, 50% fixed). Right: live preview rendering the exact web-page view the client will see, scroll-snap stepper and all. Debounced 300ms.

4. **Intro paragraph review.** The *What you told us* section is populated by the Q17 pyramid-synthesis prompt. Renders with a rank-provenance hint (*"drafted from: rank-1 + rank-3"*), low-confidence warning badge if only rank 4 was available, and a "redraft" button with optional freeform instruction box. Andy can always edit directly. If all sources are empty (brand new deal), the slot renders as a placeholder prompt (*"not enough context yet — write one line, or pull a thread from the discovery call"*) — Claude does not attempt to generate from vacuum.

5. **Send.** Andy clicks **Send quote**. The send modal opens with:
   - Pre-drafted subject line + body paragraphs + sign-off from `draft-send-email.ts` (Q13), drift-checked, editable in the modal.
   - Drift indicator if the copy scored borderline.
   - Recipient confirmation (falls through `sendEmail()` + `canSendTo()` safety gate).
   - **Quiet-window override** affordance: transactional sends respect §11.4 by default but offer a one-click "send anyway" (pre-authorised by class — see FOUNDATIONS §11.2 patch owed in Phase 5 for the `classification` parameter Task Manager flagged).
   - Final "send" button.

   On send:
   - `quotes.status` → `sent`, `sent_at` timestamp written, `accepted_content_hash` computed and stored (Q20 invariant).
   - `transitionDealStage(deal_id, 'quoted')` called (idempotent).
   - `logActivity({ kind: 'quote_sent', ... })`.
   - PDF generated via Puppeteer and cached against the quote row by content hash (Q14).
   - Send email dispatched via `sendEmail(classification: 'transactional')`.
   - Two scheduled tasks enqueued (see §8): `quote_reminder_3d` and `quote_expire`.
   - `In-Reply-To` and `References` headers set on the outbound email for conversation threading.

6. **Cockpit awareness.** While Andy works on other things, the cockpit surfaces state changes on sent quotes: a subtle badge on the relevant deal card when the quote is viewed, and the `sound:quote_accepted` registry sound firing when the client accepts. Clicking the badge opens the deal drawer with the quote state inline.

7. **Edit after send (Q20).** If Andy needs to edit a sent quote, the draft editor shows a banner: *"sent N days ago — editing creates a new version."* Clicking Edit forks the sent row into a new `quotes` row with `supersedes_quote_id` set, `status = draft`. Andy edits freely. Sending supersedes the original in a single transaction, enqueues fresh scheduled tasks, cancels old ones as `skipped`, and sends a new email explaining that this replaces the prior quote.

8. **Withdraw (vs supersede).** Distinct action. *"Withdraw quote"* in the drawer → confirm → `status = withdrawn`, scheduled tasks skipped, no replacement quote, old URL renders the "no longer active" card (distinct from the supersede "replaced" card). Used when the deal has gone `lost` or on-ice without revision.

### 3.2 Client side

1. **Receive.** Client receives the Claude-drafted email. Subject line is specific (not "Your quote"), body is short, there's one primary CTA button — *"Read your quote →"* — that opens the token URL.

2. **Open.** Client lands on `/lite/quotes/[token]`. First-fetch triggers view tracking — `quotes.viewed_at` stamped, `logActivity({ kind: 'quote_viewed' })`, scheduled `quote_reminder_3d` task marked `skipped` (since they viewed it). The deal card in Andy's cockpit gets a subtle "viewed" badge. No sound on the admin side (high-frequency event, would fatigue — see §10).

3. **Scroll-snap sections (Q11).** Five sections top to bottom, each a full-viewport panel:
   - **§1 *What you told us*** — the personalised pyramid-synthesis paragraph from Q17. Frames the whole quote in the client's own context.
   - **§2 *What we'll do*** — deliverables, scope, sequencing. Rendered from line items + Andy's prose. Catalogue item names are the vocabulary grounding.
   - **§3 *Price*** — GST-inclusive total, break-down of retainer vs one-off (if mixed), term-length commitment clearly stated with the honour-based framing (*"6-month retainer — cancel any time from your account, honour-based commitment"*).
   - **§4 *Terms*** — summary of key terms + link out to full terms page. Tickbox placement is in §5, not §4.
   - **§5 *Accept*** — tickbox ("I agree to the terms"), Accept button, and the Payment Element mount target.
   
   Sticky right-side stepper shows progress and jumplinks. Tier-1 house spring scroll behaviour. `scroll-snap-type: y proximity` so the user isn't forced into rigid snaps — they can pause between sections if reading.

4. **Tick + Accept (Q15).** Ticking the tickbox mounts the Payment Element in a hidden container immediately (warms the Stripe Elements cold-start). Clicking Accept:
   - Captures proof-of-acceptance: `accepted_at`, `accepted_ip`, `accepted_user_agent`, `accepted_content_hash`.
   - For **Stripe-billed** quotes: the Accept button morphs via Framer `layoutId="quote-primary-action"` into the Payment Element container. Surrounding sections drop to `opacity: 0.15` + `blur(2px)`. Tier-2 spring (`mass:1 stiffness:140 damping:22`). Stepper locks. A small "step back" link appears under the Payment Element — clicking it reverses the animation and un-ticks the tickbox (commitment must be re-made).
   - For **manual-billed** quotes: no Payment Element. The Accept button morphs directly into the confirmation screen (Q16) via the same `layoutId`.

5. **Payment (Stripe-billed only).** Client enters card (Stripe Payment Element handles 3DS, Apple Pay, Google Pay per the dynamic amount Payment Intent already created at draft-send time — see §9). On success, Payment Element dissolves into the confirmation screen (Q16). On failure, error state renders inline inside the Payment Element slot, up to 3 retries, then falls through to a gentle *"something's not right — andy@superbadmedia.com.au"* card in the same slot (`quotes.status` stays `accepted`, never rolls back).

6. **Confirmation (Q16).** Shared shell, branching content. Both variants: masthead → headline line (*"Payment received."* or *"Accepted."*) → one Playfair italic dry line → fact block → *"Andy's got it from here."* → footer. Stripe-billed fact block: receipt ref + download-receipt link + Billing Portal link. Manual-billed fact block: "first invoice lands {date}" + "my invoices" link. Terminal state — no "back to dashboard" button because the client doesn't have a dashboard. Only available action is closing the tab or clicking a footer link.

7. **Post-accept side effects (both modes):**
   - `transitionDealStage(deal_id, 'won')` — idempotent.
   - `logActivity({ kind: 'quote_settled', ... })`.
   - `deals.won_outcome` set: `retainer` for `structure = retainer`, `project` for `structure = project` or `mixed`.
   - Stripe-billed: Stripe Subscription created (plain rolling, no Phases — see §9). For `mixed` structure, `add_invoice_items` appends the one-off line items to the first invoice.
   - Manual-billed: first `manual_invoice_generate` row enqueued in `scheduled_tasks` with `run_at = first_invoice_date - 3 days` (the generate/send split is a Branded Invoicing refinement — see §3.3 and §8.3; the 3-day pre-send review window lets Andy add one-off line items or void before auto-send).
   - Transactional settle email fired (content mini-session owes copy; link-only, points back to the quote's now-accepted URL).
   - `sound:quote_accepted` fires in any open admin cockpit session where `document.visibilityState === 'visible'`.

### 3.3 The long tail

1. **Monthly invoicing** (Stripe-billed): Stripe handles natively. No Lite-side job.

2. **Monthly invoicing** (manual-billed): two tasks per cycle, per Branded Invoicing's refinement. Three days before each `next_invoice_date`, the `manual_invoice_generate` handler runs — it calls `generateInvoice()` (owned by `docs/specs/branded-invoicing.md`), creating a draft, fires a cockpit "ready for review" notification, and enqueues the corresponding `manual_invoice_send` task at `next_invoice_date`. On `next_invoice_date`, the `manual_invoice_send` handler checks invoice status: if still `draft` it calls `sendInvoice()` (Branded Invoicing) and logs `invoice_sent`; if Andy already sent or voided the draft manually it skips without action. On success it enqueues the next cycle's `manual_invoice_generate` task at `next_cycle_send_date - 3 days`. See §8 for the full task lifecycle. The chain stops when the deal leaves `won` or commitment ends.

3. **View status (post-accept)** is visible to Andy in the deal drawer (accepted quote + current subscription state + `committed_until_date`).

4. **Cancel flow.** Owned by the future Client Portal spec (`/lite/portal/subscription`). Quote Builder locks the *shape* of the flow here (Q21) and provides the data columns it reads. Three branches:
   - **Pre-term retainer:** 3 options — *"let's chat"*, *pay remainder*, *50% buyout*.
   - **Pre-term SaaS:** 3 options — *pay remainder*, *1-month pause*, *continue*.
   - **Post-term (both):** retention page with upgrade / downgrade / "here's what you'd be losing" / cancel through.
   
   See §11 for mechanics and §12 for cross-spec flags.

5. **Supersession / withdrawal.** Admin-driven via the deal drawer (§3.1). Client-side URL behaviour differs: superseded URLs redirect-card to the new version, withdrawn URLs show the "no longer active" card. Acceptance is blocked on non-`sent` statuses.

---

## 4. Surfaces and UI

### 4.1 Andy — draft editor (`/lite/deals/[id]/quotes/new` and `.../[quote_id]/edit`)

Two-pane split (Q12), 40/60:

**Left pane — structured editor:**
- Top: billing-mode indicator (read-only badge), deal context summary (company + contact + stage)
- Section 1 *What you told us*: textarea + rank-provenance hint + redraft button + confidence badge + empty-state placeholder
- Section 2 *What we'll do*: line-item picker (search, filter by category) + free-text prose below items + catalogue override inline editor (name, price, unit)
- Section 3 *Price*: derived totals (read-only, computed live); breakdown of retainer vs one-off; GST-inclusive labelling throughout
- Section 4 *Terms*: terms-template selector + any per-quote overrides textarea
- Section 5 *Accept*: not editable — this is the client's interaction zone, shown in preview only
- Sidebar controls: term-length picker (Q4), expiry picker (Q8 — default `sent_at + 14 days`), template save-as button, save draft button, **Send quote** button

**Right pane — live preview:**
- Renders exactly what the client will see at the token URL, including scroll-snap behaviour, motion, and typography
- Updates debounced 300ms on any left-pane edit
- Read-only click-through — clicking simulates scroll-snap navigation for preview purposes but doesn't submit anything
- Mobile/desktop toggle at the top right for preview device framing

**Motion spec (added 2026-04-13 Phase 3.5):**
- Pane mount: left and right fade-in in parallel, 200ms ease-out. No slide.
- Edit → preview propagation: each 300ms-debounced settle triggers a soft `houseSpring` crossfade on the affected preview block only (not the whole preview) — dirty block detected by section key, others untouched. Crossfade duration 220ms.
- Section add/remove on the left: items height-animate in/out with `houseSpring` (`mass:1, stiffness:220, damping:25`); reordering uses dnd-kit drop animation shared with Pipeline Kanban.
- Mobile/desktop toggle: preview frame width animates with `houseSpring`, 380ms. Content inside reflows naturally.
- Drift indicator (see §4.2): state changes (neutral → green → amber) use 180ms colour crossfade + a single-pulse halo 240ms on first amber appearance. No sound (Pipeline sound registry is authoritative; drift surface uses no registered key).
- Reduced-motion: all transitions drop to ≤20ms linear; editor and preview remain fully functional.

### 4.2 Andy — send modal

Full-viewport modal (not sheet). Contents:
- Preview of the sent state (left column)
- Editable email fields (right column): subject (≤60 char counter), body paragraphs, sign-off
- Drift indicator (green/amber based on `checkBrandVoiceDrift()` result)
- Recipient row (from deal's primary contact) — read-only, with a "change primary contact" link back to the deal
- Quiet-window status indicator: if inside window, shows green "sends now"; if outside, shows amber "queued for {next_window_open}" + override toggle
- **Cancel** (secondary) and **Send** (primary, brand-red) buttons

### 4.3 Client — quote web page (`/lite/quotes/[token]`)

- Full scroll-snap editorial experience described in §3.2.3
- Brand typography: Black Han Sans for section headers, DM Sans for body, Playfair italic for dry lines and the sign-off
- Dark mode only (FOUNDATIONS §9)
- Brand tokens: warm cream background (`--brand-cream`), charcoal text (`--brand-charcoal`), brand red (`--brand-red`) on the single primary action (Accept button)
- Sticky right-side stepper indicator (5 sections, progress dots + labels, jumplinks)
- Mobile: stepper collapses to a top progress bar; sections scale to `min-height: 100dvh`
- Superseded URL: renders a replacement card with the new URL's button, no scroll-snap
- Withdrawn URL: renders a "no longer active" card, no scroll-snap
- Expired URL: renders an "expired" card with *"still interested? andy@superbadmedia.com.au"*, no scroll-snap

### 4.4 Client — PDF (generated via `app/lite/quotes/[token]/pdf/page.tsx`)

A4 portrait, single page, print CSS. Content blocks in order:
1. SuperBad masthead (smaller than the web header, not competing)
2. Quote number + issue date + expiry date
3. Client + ABN block (from `companies` row + contact)
4. One-line scope summary (Claude-drafted, drift-checked, ≤140 chars — content mini-session owes the prompt slot)
5. Line items table: name | qty | unit | price inc GST
6. Total inc GST (large, right-aligned)
7. Term length + honour-based commitment note
8. **One dry Playfair italic cover line** (sprinkle claim — §10)
9. Terms link URL (printed for paper readers, clickable in the digital PDF)
10. "Accept online →" CTA with the full token URL

Generated on first quote-send, cached against the row by content hash. Regenerated on supersede (new row, new hash, new PDF).

Typography: Black Han Sans masthead, DM Sans body, Playfair italic cover line, brand cream background, brand charcoal text, brand red accent on the CTA. File name: `SuperBad-Quote-{client-slug}-{quote-number}.pdf`.

### 4.5 Settings → Templates

Simple CRUD surface for `quote_templates`:
- List view of saved templates (name + last-updated + usage count)
- Create / edit modal with the same left-pane structure as the draft editor (§4.1)
- Delete with confirm (templates referenced by no existing quotes — hard delete; templates referenced by quotes — soft delete via `deleted_at`)
- A template is a structural scaffold (sections, default line items, default term length) — it does not contain client-specific content like the *What you told us* paragraph

### 4.6 Settings → Products / Catalogue

CRUD surface for `catalogue_items`:
- List view filtered by category (content mini-session owes the category taxonomy)
- Create / edit modal: name, category, unit, `base_price_cents_inc_gst`, `tier_rank` (retainers only)
- Per-item history: prior prices preserved (audit trail; see snapshot-on-add in §5)
- Content mini-session seeds the initial item set

### 4.7 Client Portal cancel flow (owned by future spec, shape locked here)

Path: `/lite/portal/subscription`. Branches on `today >= committed_until_date`:

**Pre-term retainer:** three option cards — *Let's chat*, *Pay the remainder*, *50% buyout* — each routing through confirmation step per §11.

**Pre-term SaaS:** three option cards — *Pay the remainder*, *1-month pause*, *Continue*.

**Post-term:** retention page with three equally-weighted cards — *Upgrade*, *Downgrade*, *Cancel* — the cancel card showing the "here's what you'd be losing" list.

Full mechanics in §11. Content mini-session owes all copy. Client Portal spec owes the actual page component and navigation wiring.

---

## 5. Data model

All schema changes are additive. Existing Pipeline tables gain columns only; no drops.

### 5.1 `quotes` (new table)

```
quotes
  id                           text pk
  deal_id                      text fk → deals.id
  company_id                   text fk → companies.id (denormalised)
  token                        text unique   -- URL slug, nanoid
  quote_number                 text unique   -- human-readable, e.g., "SB-2026-0042"
  status                       enum: draft | sent | viewed | accepted | superseded | withdrawn | expired
  structure                    enum: retainer | project | mixed
  
  -- content
  content_json                 jsonb        -- full section structure, line items, prose; snapshotted at send
  catalogue_snapshot_json      jsonb        -- snapshot of catalogue_items referenced at draft time (audit)
  
  -- pricing
  total_cents_inc_gst          integer      -- canonical GST-inclusive total
  retainer_monthly_cents_inc_gst integer nullable  -- for retainer/mixed
  one_off_cents_inc_gst        integer nullable    -- for project/mixed
  
  -- commitment
  term_length_months           integer nullable    -- null for project-only
  committed_until_date         date nullable       -- populated at accept for retainer/mixed
  buyout_percentage            integer default 50  -- per-quote, v1 all = 50
  tier_rank                    integer nullable    -- snapshotted from catalogue (retainers only)
  
  -- dates
  created_at                   timestamptz
  sent_at                      timestamptz nullable
  viewed_at                    timestamptz nullable
  accepted_at                  timestamptz nullable
  expires_at                   timestamptz nullable
  superseded_at                timestamptz nullable
  withdrawn_at                 timestamptz nullable
  
  -- supersede chain
  supersedes_quote_id          text fk → quotes.id nullable
  superseded_by_quote_id       text fk → quotes.id nullable
  
  -- proof of acceptance
  accepted_content_hash        text nullable       -- sha256 of content_json at send time
  accepted_ip                  text nullable
  accepted_user_agent          text nullable
  
  -- stripe
  stripe_payment_intent_id     text nullable
  stripe_subscription_id       text nullable
  
  -- pdf
  pdf_cache_key                text nullable       -- content hash → R2 cached PDF path
  
  -- email thread
  thread_message_id            text nullable       -- RFC Message-ID of the original send, for In-Reply-To
  
  -- audit
  last_edited_by_user_id       text
```

**Validation rules:**
- `structure = retainer` → `term_length_months NOT NULL`, `retainer_monthly_cents_inc_gst NOT NULL`, `one_off_cents_inc_gst = 0 OR NULL`
- `structure = project` → `term_length_months = NULL`, `retainer_monthly_cents_inc_gst = 0 OR NULL`, `one_off_cents_inc_gst NOT NULL`
- `structure = mixed` → all three populated
- `status` transitions via `transitionQuoteStatus(quote_id, new_status)` only — validated state machine in `lib/quotes/transitions.ts`
- Valid transitions:
  - `draft → sent` (via Send action)
  - `sent → viewed` (via first-fetch on client side)
  - `sent | viewed → accepted` (via Accept action)
  - `sent | viewed → superseded` (via Edit-after-send)
  - `sent | viewed → withdrawn` (via Withdraw action)
  - `sent | viewed → expired` (via scheduled task)
  - `draft → withdrawn` (delete-draft path, soft)
  - Terminal: `accepted`, `superseded`, `withdrawn`, `expired`

### 5.2 `catalogue_items` (new table)

```
catalogue_items
  id                           text pk
  name                         text
  category                     text              -- content mini-session owes taxonomy
  unit                         enum: hour | day | project | month | piece
  base_price_cents_inc_gst     integer
  tier_rank                    integer nullable  -- retainers only, higher = more expensive
  description                  text nullable     -- short for quote rendering
  created_at                   timestamptz
  updated_at                   timestamptz
  deleted_at                   timestamptz nullable
```

**Snapshot-on-add pattern:** when a catalogue item is added to a quote draft, its full row is copied into `quotes.catalogue_snapshot_json` keyed by item id. Subsequent price changes to the catalogue item do not affect existing sent quotes, but the draft editor surfaces a *"catalogue updated since draft — refresh price?"* affordance. Rationale: audit cleanliness + no drift between what the client saw and what the system records.

### 5.3 `quote_templates` (new table)

```
quote_templates
  id                           text pk
  name                         text
  structure                    enum: retainer | project | mixed
  term_length_months           integer nullable
  default_sections_json        jsonb             -- prose scaffold per section
  default_line_items_json      jsonb             -- array of catalogue_item references
  usage_count                  integer default 0
  created_at                   timestamptz
  updated_at                   timestamptz
  deleted_at                   timestamptz nullable
```

### 5.4 `scheduled_tasks` (new table — shared primitive, §8)

> **Consolidated `task_type` enum** — Quote Builder owns this table and the single Node cron worker that dispatches it (§8). Every downstream spec that schedules recurring or deferred work extends the enum and registers a handler. The enum below is the authoritative union across the platform as of Phase 3.5 step 2a (2026-04-13). Each block is owned by its originating spec; Phase 5 foundation migration seeds the full union.

```
scheduled_tasks
  id                           text pk
  task_type                    enum:
    -- Quote Builder (owner, 5 values — note: manual_invoice_send split into a two-step
    --   generate → send chain per Branded Invoicing refinement; see §3.2, §3.3, §8.3):
    quote_expire | quote_reminder_3d | manual_invoice_generate | manual_invoice_send |
    subscription_pause_resume_reminder | subscription_pause_resume |
    -- Branded Invoicing (1 additional — `manual_invoice_generate` lives in the Quote Builder
    --   block above because Quote Builder owns the enum; Branded Invoicing adds overdue reminder):
    invoice_overdue_reminder |
    -- Client Context Engine (2):
    context_summary_regenerate | context_action_item_extract |
    -- Content Engine (6):
    content_keyword_research | content_generate_draft | content_fan_out |
    content_newsletter_send | content_ranking_snapshot | content_outreach_match |
    -- Client Management (2):
    client_data_export | intro_funnel_portal_migration |
    -- Daily Cockpit (1):
    cockpit_brief_regenerate |
    -- Unified Inbox (5):
    inbox_draft_reply | inbox_hygiene_purge | inbox_morning_digest |
    inbox_graph_subscription_renew | inbox_initial_import |
    -- SaaS Subscription Billing (3):
    saas_data_loss_warning | saas_annual_renewal_reminder | saas_card_expiry_warning |
    -- Cost & Usage Observatory (5):
    cost_anomaly_detector_hard | cost_anomaly_detector_rate | cost_anomaly_detector_learned |
    cost_anomaly_diagnose | weekly_digest_send |
    -- Finance Dashboard (6):
    finance_snapshot_take | finance_narrative_regenerate | finance_observatory_rollup |
    finance_stripe_fee_rollup | recurring_expense_book | finance_export_generate
    -- extensible by future specs; any new spec that schedules work patches this enum and the
    -- handler map in §8.2 in the same session
  run_at                       timestamptz       -- UTC
  payload_json                 jsonb             -- task-specific shape
  status                       enum: pending | running | done | failed | skipped
  attempts                     integer default 0
  last_attempted_at            timestamptz nullable
  last_error                   text nullable
  idempotency_key              text unique       -- e.g., quote_expire:{quote_id}
  created_at                   timestamptz
  done_at                      timestamptz nullable
  reclaimed_at                 timestamptz nullable
```

### 5.5 `worker_heartbeats` (new table — thin observability)

```
worker_heartbeats
  worker_name                  text pk
  last_tick_at                 timestamptz
  last_tick_tasks_processed    integer
```

The scheduled-tasks worker writes to this every tick. Admin cockpit reads the row to render a red banner if `now() - last_tick_at > 5 minutes`.

### 5.6 Column additions to existing Pipeline tables

**`companies`:**
- `gst_applicable` boolean default true — for non-GST cases (rare, but possible for overseas clients)
- `abn` text nullable — already likely on Pipeline, confirm during Build

**`deals`:**
- `committed_until_date` date nullable — denormalised from accepted quote
- `subscription_state` enum: `active | paused | pending_early_exit | cancelled_paid_remainder | cancelled_buyout | cancelled_post_term | ended_gracefully`
- `pause_used_this_commitment` boolean default false — SaaS pause anti-stack
- `stripe_subscription_id` text nullable — denormalised for fast webhook resolution
- `stripe_customer_id` text nullable — denormalised for fast webhook resolution

**`deals.won_outcome` enum** gains the value `'project'` (currently `retainer | saas`). Cross-spec flag for Pipeline.

### 5.7 `activity_log.kind` enum additions (cross-spec flag for Pipeline)

All values additive, non-breaking. Logged via `logActivity()` per §11.1:

- `quote_draft_started`
- `quote_sent`
- `quote_viewed`
- `quote_accepted`
- `quote_settled`
- `quote_superseded`
- `quote_expired`
- `quote_withdrawn`
- `scheduled_task_dispatched`
- `subscription_cancel_intercepted_preterm`
- `subscription_early_cancel_paid_remainder`
- `subscription_early_cancel_buyout_50pct`
- `subscription_paused`
- `subscription_pause_ended`
- `subscription_upgrade_intent`
- `subscription_downgrade_intent`
- `subscription_cancelled_post_term`
- `subscription_ended_gracefully`

### 5.8 `contacts` additions

None required from Quote Builder. Contacts are read-only from Pipeline for this spec.

---

## 6. Claude prompts

All prompts live under `lib/quote-builder/prompts/`. All pass through `checkBrandVoiceDrift()` per FOUNDATIONS §11.5.

### 6.1 `draft-quote-from-context.ts` (Opus-tier)

**Purpose:** populate a new draft from deal context (Q3 default mode).

**Input:**
```ts
{
  deal: { ... },
  company: { ... },
  primary_contact: { ... },
  brand_dna: { ... } | null,
  client_context: { ... } | null,
  activity_log_highlights: ActivityLogEntry[],
  client_docs: ClientDoc[],
  retainer_fit_recommendation: RetainerFitRec | null,  // from Intro Funnel if present
  catalogue_items: CatalogueItem[],                     // full available catalogue as vocabulary
  billing_mode: 'stripe' | 'manual',
}
```

**Output schema (constrained JSON):**
```ts
{
  structure: 'retainer' | 'project' | 'mixed',
  suggested_term_length_months: number | null,
  sections: {
    what_you_told_us: string,         // max ~120 words
    what_well_do: {
      prose: string,                   // framing paragraph
      line_item_refs: {                // catalogue items Claude recommends
        catalogue_item_id: string,
        qty: number,
        override_price_cents_inc_gst: number | null,
        override_reason: string | null,
      }[],
    },
    price_framing: string,             // one-paragraph framing of the total
    terms_highlights: string[],        // bullet list of the key terms to surface in §4
  },
  confidence: 'high' | 'medium' | 'low',
  flags_json: { [key: string]: string },
}
```

**Guardrails in prompt:**
- Claude MUST select line items only from the catalogue vocabulary provided. Never invent items.
- Claude MAY override catalogue prices with explicit reasoning. Overrides surface in Andy's review.
- Rank hierarchy applies per the `feedback_client_doc_source_hierarchy` memory.
- Brand voice per the core voice memory. Ban `synergy` / `leverage` / `solutions`.
- No filler. No generic openers. Texture only.

### 6.2 `draft-intro-paragraph.ts` (Opus-tier) — Q17

**Purpose:** regenerate the *What you told us* paragraph on demand (redraft button) with optional freeform instruction.

Prompt structure detailed in Q17 (§2 row). Input same as 6.1 plus an optional `freeform_instruction` string ("make it shorter", "reference the EOFY deadline", etc.). Output schema:

```ts
{
  paragraph_text: string,              // ≤120 words, target ~80
  primary_source_rank: 1 | 2 | 3 | 4,
  drew_from_ranks: (1|2|3|4)[],
  confidence: 'high' | 'medium' | 'low',
  flags_json: { ... },
}
```

**Hard rules (in prompt):** rank-1 wins conflicts; rank-4-only → `confidence: low` + flag; no invented specifics; no greeting/sign-off/we/our; voice per the memory.

**Throttle:** soft cap 5 redrafts per quote per hour.

### 6.3 `draft-send-email.ts` (Opus-tier) — Q13

**Purpose:** draft the email that delivers the quote link.

**Input:** quote row + company + contact + deal context.

**Output schema:**
```ts
{
  subject_line: string,                // ≤60 chars
  body_paragraphs: string[],           // 2–4 short paragraphs, no URL
  sign_off: string,                    // one line, Playfair italic on client side
}
```

**Hard rules:**
- Never include the URL in the body. The URL is rendered by the template as a branded button.
- Never mention "attached PDF" — delivery is link-only.
- Address by first name. No "Hi there" / "To whom". No generic openers.
- Reference one specific thing from the deal context (proves human attention).

### 6.4 `draft-scope-summary.ts` (Haiku-tier) — for PDF line 4

**Purpose:** compress the *What we'll do* section into a single ≤140-char scope summary line for the PDF header block.

**Input:** `quotes.content_json` of the quote row.

**Output:** `{ scope_summary_text: string }`, max 140 chars.

Haiku-tier — this is a compression task, not a reasoning task.

### 6.5 `draft-pdf-cover-line.ts` (Opus-tier) — for PDF line 8 (sprinkle claim)

**Purpose:** generate one dry Playfair italic cover line for the PDF. Content mini-session will decide whether this fires per-quote (Claude-drafted, drift-checked) or pulls from a rotation pool of hand-written lines (simpler, safer). Structural slot is locked here; the choice between per-quote generation and rotation pool is deferred to the content mini-session.

### 6.6 `draft-settle-email.ts` (Opus-tier)

**Purpose:** post-accept transactional email (§3.2.7 side effects).

Branches on billing mode:
- Stripe-billed: references the payment, the receipt link, and the first-deliverable date
- Manual-billed: references the first-invoice date and the first-deliverable date

**Output:** same `{subject_line, body_paragraphs, sign_off}` shape as 6.3. Always drift-checked.

### 6.7 `draft-cancel-intercept-email.ts` (Opus-tier)

**Purpose:** when a retainer client clicks *Let's chat* on the pre-term cancel intercept, a cockpit alert pops and this prompt pre-drafts a check-in email from Andy to the client.

**Input:** quote + deal + committed_until_date + months_remaining + whatever context exists in Client Context Engine.

**Output:** `{subject_line, body_paragraphs, sign_off}`.

**Hard rules:**
- Never defensive. Never begging.
- Acknowledge the client's position openly.
- Offer a 15-minute call, not a text-based back-and-forth.
- Dry, warm, specific.

---

## 7. Stripe integration shape

### 7.1 Payment Intent (accept + pay)

**At quote Send:** no Stripe call yet. Draft + sent state live entirely in Lite.

**At tickbox-tick (client side):** Payment Element mounts in a hidden container using a Payment Intent created lazily just-in-time via a server route (`POST /api/quotes/[token]/payment-intent`). The Payment Intent uses the canonical `total_cents_inc_gst` at this moment (not a Stripe Price), matching the Intro Funnel dynamic-amount pattern. Currency AUD. Metadata includes `quote_id`, `deal_id`, `company_id`. Customer object created-or-matched on Stripe against the company's email (`stripe_customer_id` denormalised back to `deals`).

**At Accept (button click, post-tickbox):** proof-of-acceptance captured in the DB in a single transaction with the Payment Intent confirm call. If Payment Intent succeeds:
- For `structure = retainer`: a Stripe Subscription is created immediately *after* the Payment Intent succeeds, using the same customer. The subscription is a plain rolling subscription with monthly price = `retainer_monthly_cents_inc_gst`. Metadata includes `quote_id`, `deal_id`, `committed_until_date` (ISO). **No Subscription Schedules / Phases** — commitment is enforced at the Lite UX layer via the cancel flow, not at the Stripe layer.
- For `structure = project`: Payment Intent is the whole transaction. No subscription created.
- For `structure = mixed`: subscription created for the retainer portion, Stripe `add_invoice_items` appended to the first invoice with the one-off items. First invoice settles everything.

**Webhook events consumed** (per FOUNDATIONS §8 idempotency discipline):
- `payment_intent.succeeded` — Quote Builder handles, logs `quote_settled`, triggers settle email
- `payment_intent.payment_failed` — logs `quote_payment_failed` (activity log value added to the cross-spec list if not already — confirm in Build)
- `customer.subscription.created` — logs `subscription_started`, denormalises `stripe_subscription_id` to `deals`
- `customer.subscription.deleted` — handled by the cancel flow branching in §11 (webhook only fires for genuine Stripe-side cancels, which in our model means a cancel already processed by our custom cancel flow — the webhook is the confirmation handshake, not the trigger)
- `customer.subscription.paused` / `customer.subscription.resumed` — SaaS pause lifecycle events, updates `deals.subscription_state`
- `invoice.payment_failed` — logs, surfaces in cockpit; does not auto-cancel the subscription (Stripe's default dunning policy handles retries). Transitions `deals.subscription_state` from `active_current` to `past_due` per the canonical subscription state machine in FOUNDATIONS.md §12. Retainer clients follow the same `past_due` lockout rule as SaaS subscribers — no platform access until payment recovers.
- `invoice.payment_succeeded` — logs, updates any relevant dashboard state

### 7.2 Billing Portal configuration

Configured in Stripe Dashboard (or via API during Build):
- **Cancellation disabled.** The "Cancel subscription" button removed from the portal.
- **Payment method updates enabled.**
- **Invoice history enabled.**
- **Custom link:** "Manage subscription →" pointing at `/lite/portal/subscription` (the future Client Portal cancel surface).
- Logo + brand colours configured per FOUNDATIONS §9 tokens.

### 7.3 Dynamic-amount Payment Intent pattern

Inherited from Intro Funnel. Rationale: Stripe Products + Prices are immutable at the catalogue level, but quote totals are editable up until Send. Creating Payment Intents with runtime amounts sidesteps the immutability problem cleanly. Downside: we lose Stripe's native product reporting. Acceptable tradeoff — Lite owns the catalogue, not Stripe.

### 7.4 Idempotency across retries

Every webhook handler uses `webhook_events` table idempotency per FOUNDATIONS §8. Every one-off Payment Intent created for cancel-flow paid exits uses an idempotency key of the form `quote_exit:{deal_id}:{exit_type}:{month_cursor}` so a double-click never double-charges.

---

## 8. The scheduled-tasks primitive (shared infrastructure)

Introduced by this spec, inherited by every future spec that needs scheduling. This is a cross-cutting primitive with the same load-bearing status as the §11 cross-cutting primitives — treat it as shared infrastructure, not as Quote Builder internals.

### 8.1 Table shape

See §5.4.

### 8.2 Worker process

`workers/scheduled-tasks-worker.ts`, mounted as a separate Coolify service alongside the main Next.js app. Uses `node-cron` with a `* * * * *` tick (every minute).

**Per-tick logic:**
1. Write heartbeat row to `worker_heartbeats`.
2. Reclaim stale `running` rows: `UPDATE scheduled_tasks SET status='pending', reclaimed_at=now() WHERE status='running' AND last_attempted_at < now() - interval '15 minutes'`.
3. Pull up to 50 due rows: `SELECT * FROM scheduled_tasks WHERE status='pending' AND run_at <= now() ORDER BY run_at ASC LIMIT 50`.
4. For each row: `UPDATE ... SET status='running', last_attempted_at=now(), attempts=attempts+1`.
5. Dispatch to handler via handler map in `lib/scheduled-tasks/handlers/index.ts`. Each block is owned by its originating spec; Quote Builder's §8.3 only defines the Quote-Builder-owned handlers — the others are defined by their owner specs but must appear in this single dispatch map so the worker compiles:
   ```ts
   const handlers: Record<TaskType, TaskHandler> = {
     // Quote Builder (owner, §8.3):
     quote_expire: handleQuoteExpire,
     quote_reminder_3d: handleQuoteReminder3d,
     manual_invoice_generate: handleManualInvoiceGenerate,   // two-step chain per Branded Invoicing (§3.3)
     manual_invoice_send: handleManualInvoiceSend,
     subscription_pause_resume_reminder: handlePauseResumeReminder,
     subscription_pause_resume: handlePauseResume,
     // Branded Invoicing (§8 in branded-invoicing.md):
     invoice_overdue_reminder: handleInvoiceOverdueReminder,
     // Client Context Engine (§11 in client-context-engine.md):
     context_summary_regenerate: handleContextSummaryRegenerate,
     context_action_item_extract: handleContextActionItemExtract,
     // Content Engine (§6 in content-engine.md):
     content_keyword_research: handleContentKeywordResearch,
     content_generate_draft: handleContentGenerateDraft,
     content_fan_out: handleContentFanOut,
     content_newsletter_send: handleContentNewsletterSend,
     content_ranking_snapshot: handleContentRankingSnapshot,
     content_outreach_match: handleContentOutreachMatch,
     // Client Management (§6 in client-management.md):
     client_data_export: handleClientDataExport,
     intro_funnel_portal_migration: handleIntroFunnelPortalMigration,
     // Daily Cockpit (§6 in daily-cockpit.md):
     cockpit_brief_regenerate: handleCockpitBriefRegenerate,
     // Unified Inbox (§6 in unified-inbox.md):
     inbox_draft_reply: handleInboxDraftReply,
     inbox_hygiene_purge: handleInboxHygienePurge,
     inbox_morning_digest: handleInboxMorningDigest,
     inbox_graph_subscription_renew: handleInboxGraphSubscriptionRenew,
     inbox_initial_import: handleInboxInitialImport,
     // SaaS Subscription Billing (§6 in saas-subscription-billing.md):
     saas_data_loss_warning: handleSaasDataLossWarning,
     saas_annual_renewal_reminder: handleSaasAnnualRenewalReminder,
     saas_card_expiry_warning: handleSaasCardExpiryWarning,
     // Cost & Usage Observatory (§ detectors in cost-usage-observatory.md):
     cost_anomaly_detector_hard: handleCostAnomalyDetectorHard,
     cost_anomaly_detector_rate: handleCostAnomalyDetectorRate,
     cost_anomaly_detector_learned: handleCostAnomalyDetectorLearned,
     cost_anomaly_diagnose: handleCostAnomalyDiagnose,
     weekly_digest_send: handleWeeklyDigestSend,
     // Finance Dashboard (§24 in finance-dashboard.md):
     finance_snapshot_take: handleFinanceSnapshotTake,
     finance_narrative_regenerate: handleFinanceNarrativeRegenerate,
     finance_observatory_rollup: handleFinanceObservatoryRollup,
     finance_stripe_fee_rollup: handleFinanceStripeFeeRollup,
     recurring_expense_book: handleRecurringExpenseBook,
     finance_export_generate: handleFinanceExportGenerate,
   };
   ```
6. Handler signature: `(row: ScheduledTaskRow, db: Database) => Promise<{ ok: true } | { ok: false, error: string, retry?: boolean }>`.
7. On `ok: true`: `UPDATE ... SET status='done', done_at=now()`.
8. On `ok: false, retry: true`: if `attempts < 3`, reschedule with exponential backoff (`run_at = now() + interval '5 minutes' * 6^attempts`). If `attempts >= 3`, mark `failed`.
9. On `ok: false, retry: false`: mark `failed` immediately.
10. Every dispatch calls `logActivity({ kind: 'scheduled_task_dispatched', ... })`.

**Quiet-window respect:** handlers that call `sendEmail()` inherit the §11.4 quiet window automatically via `sendEmail()`'s internal gating. No special handling in the worker.

**Stale-row reclaim** prevents lost work from a worker process crash mid-task: any row stuck in `running` for >15 minutes is returned to `pending` on the next tick.

### 8.3 Handlers Quote Builder owns

**`handleQuoteExpire({ quote_id })`:**
- Re-read quote row
- If `status NOT IN ('sent', 'viewed')`: return `ok: true` (no-op — already moved on)
- Else: transition `status` → `expired`, fire expiry email to client (link-only: *"your quote expired, still interested? here's how to reach out"*), log `quote_expired`, return `ok: true`

**`handleQuoteReminder3d({ quote_id })`:**
- Re-read quote row
- If `status NOT IN ('sent')` (note: excludes `viewed`): return `ok: true` (skip — either already actioned or viewed, and `handleQuoteReminder3d` was already marked `skipped` at view time)
- Else: fire reminder email (Claude-drafted, drift-checked, short), log `quote_reminder_sent` (not currently in the cross-spec list — add if missing), return `ok: true`

**`handleManualInvoiceGenerate({ deal_id, cycle_index, cycle_start, cycle_end, send_at })`** (added per Branded Invoicing refinement, 2026-04-13):
- Call `generateInvoice()` on `docs/specs/branded-invoicing.md` — creates an invoice row with `status = 'draft'` and a fresh idempotency key `manual_invoice_generate:{deal_id}:{cycle_index}`
- Fire cockpit "ready for review" notification (attention-rail chip sourced from Quote Builder, rendered by Daily Cockpit)
- Enqueue the matching `manual_invoice_send` row (same `deal_id`, `cycle_index`, `run_at = send_at`) with idempotency key `manual_invoice_send:{deal_id}:{cycle_index}`
- Return `ok: true`
- On generation failure: return `ok: false, retry: true` for backoff; after 3 fails, escalate to cockpit and return `ok: false, retry: false`

**`handleManualInvoiceSend({ deal_id, cycle_index, cycle_start, cycle_end })`** (narrowed to send-only per Branded Invoicing refinement — the generation step now runs 3 days earlier in `handleManualInvoiceGenerate`):
- Re-read the draft invoice created by the matching `manual_invoice_generate` task
- If `status = 'sent'` (Andy already sent it manually during the review window): mark task `skipped`, no action, but still enqueue the next cycle's `manual_invoice_generate` (see below)
- If `status = 'void'` (Andy voided the draft during the review window): mark task `skipped`, no action, do not enqueue next cycle (voiding is a full-stop signal — Andy will re-initiate manually if needed)
- Else (`status = 'draft'`): call `sendInvoice()` on `docs/specs/branded-invoicing.md`, log `invoice_sent`
- On success (or `sent` skip above): check deal is still active + within commitment. If yes: enqueue next cycle's `manual_invoice_generate` row (cycle_index + 1, `run_at = next_cycle_send_date - 3 days`) with fresh idempotency key. If no: stop the chain.
- Also enqueue `invoice_overdue_reminder` with `run_at = due_at + 3 days` (handler owned by Branded Invoicing)
- Return `ok: true`
- On send failure: return `ok: false, retry: true` for backoff; after 3 fails, escalate to cockpit "attention needed" and return `ok: false, retry: false`

**`handlePauseResumeReminder({ deal_id })`:**
- Fire a Claude-drafted heads-up email to the client 3 days before their pause ends
- Return `ok: true`

**`handlePauseResume({ deal_id })`:**
- No Stripe action (Stripe auto-resumes at `pause_collection.resumes_at`)
- Log `subscription_pause_ended`, clear `deals.subscription_state` back to `active`
- Return `ok: true`

### 8.4 Idempotency keys

All Quote Builder-owned task creations use deterministic idempotency keys so re-running the creation logic cannot double-enqueue:

| Task | Idempotency key format |
|---|---|
| `quote_expire` | `quote_expire:{quote_id}` |
| `quote_reminder_3d` | `quote_reminder_3d:{quote_id}` |
| `manual_invoice_send` | `manual_invoice_send:{deal_id}:{cycle_index}` |
| `subscription_pause_resume_reminder` | `pause_reminder:{deal_id}:{resume_date}` |
| `subscription_pause_resume` | `pause_resume:{deal_id}:{resume_date}` |

### 8.5 Observability

Admin cockpit reads `scheduled_tasks` directly for the "what's scheduled" pane. Query pattern: `SELECT * FROM scheduled_tasks WHERE status='pending' AND run_at <= now() + interval '7 days' ORDER BY run_at ASC`. Failed rows surface as a "needs your attention" queue (`status='failed'`). Worker heartbeat banner fires red if `worker_heartbeats.last_tick_at < now() - interval '5 minutes'`.

---

## 9. Q21 cancel flow — structural locks and mechanics

Flow lives at `/lite/portal/subscription` (owned by the future Client Portal spec). Quote Builder specifies the shape here; the Client Portal spec owes implementation.

### 9.1 Gate: which branch?

```
if deals.subscription_state = 'paused':
  render pause-status page with "resume early" + "extend pause" options
  (pause handling — not a cancel branch)

elif today < deals.committed_until_date:
  → pre-term branch (below)

else:
  → post-term branch (below)
```

### 9.2 Pre-term retainer branch (3 options)

Renders three option cards, equal visual weight:

**Option 1 — *Let's chat*:**
- Click → `logActivity('subscription_cancel_intercepted_preterm')`
- Fire admin cockpit alert (real-time layer)
- Pre-draft Claude check-in email in Andy's send modal (`draft-cancel-intercept-email.ts`)
- Page state: renders a *"noted — Andy will reach out. If you want to come back and pick a different option, this page stays available."* message
- No Stripe action. Subscription stays active.
- Client can return to the page anytime and pick a different option.

**Option 2 — *Pay the remainder*:**
- Click → confirmation screen with calculated amount (*"you'll be charged $X,XXX inc. GST today"*), exact cancel-effective date (today), "no further deliverables from {today}" line
- Confirmation button: charcoal-on-cream, not brand-red. Deliberately de-emphasised.
- Secondary "go back" link
- On confirm: `POST /api/portal/cancel-pay-remainder` creates an off-session Payment Intent against `customer.default_payment_method` for `remainder_cents`
- Calculation: `remainder_cents = monthly_amount_cents * months_remaining_rounded_up`, where `months_remaining = ceil((committed_until_date - today) / 30)`. Clean and legible.
- On success: Stripe subscription cancelled immediately (not at period end), `deals.subscription_state = 'cancelled_paid_remainder'`, log `subscription_early_cancel_paid_remainder`, redirect to confirmation screen
- On failure: inline error, retry up to 3 attempts, then fallback to "Let's chat" option visible
- Idempotency key: `quote_exit:{deal_id}:paid_remainder:{today_iso}`

**Option 3 — *50% buyout*:**
- Click → same confirmation screen pattern with `buyout_cents = floor(remainder_cents / 2)` (client-favourable rounding)
- Same double-confirmation UX, same de-emphasised button styling
- On confirm: same Payment Intent mechanics with key `quote_exit:{deal_id}:buyout:{today_iso}`
- On success: subscription cancelled immediately, `deals.subscription_state = 'cancelled_buyout'`, log `subscription_early_cancel_buyout_50pct`, redirect to confirmation screen

### 9.3 Pre-term SaaS branch (3 options)

**Option 1 — *Pay the remainder*:** same as retainer Option 2.

**Option 2 — *1-month pause*:**
- Click → confirmation screen (*"your subscription pauses today and resumes on {resume_date}. Your commitment now runs until {new_committed_until_date}."*)
- On confirm: Stripe API `subscriptions.update(id, { pause_collection: { behavior: 'void', resumes_at: <unix>} })`
- `deals.committed_until_date += 30 days`, `deals.pause_used_this_commitment = true`, `deals.subscription_state = 'paused'`
- Two scheduled tasks enqueued: `subscription_pause_resume_reminder` (run 3 days before resume) and `subscription_pause_resume` (run on resume date)
- Log `subscription_paused`, redirect to pause-confirmation screen

**Option 3 — *Continue*:** page closes, no action.

**Anti-stack rule:** if `deals.pause_used_this_commitment = true`, Option 2 renders as disabled with a *"you've already used this commitment's pause"* tooltip. Resets to false only on new commitment acceptance (new quote superseding, or post-term renewal).

### 9.4 Post-term branch (both retainer and SaaS)

Three equally-weighted cards:

**Upgrade:** renders other retainer-category catalogue items with `tier_rank > current_tier_rank` as option cards. Click → `logActivity('subscription_upgrade_intent')`, admin alert, pre-drafted Claude email opens in Andy's send modal. No auto-transaction. Client resumes or leaves.

**Downgrade:** same shape but `tier_rank < current_tier_rank`. Edge case: if no lower-ranked items exist, renders *"you're already on the smallest retainer."* (content mini-session — flagged).

**Cancel:** shows the "here's what you'd be losing" list — bulleted line items pulled from the accepted quote's `content_json`. Dry factual presentation. Two buttons: *"actually, I'll stay"* (closes) and *"cancel anyway"* (confirmation step → Stripe subscription cancel → `deals.subscription_state = 'cancelled_post_term'`, log `subscription_cancelled_post_term`).

### 9.5 Card-not-on-file edge (pre-term paid exits)

If `customer.default_payment_method` is absent (rare — Stripe may purge after a very long inactive period), paid-exit options render as disabled with *"payment method needed — update in Billing Portal first"*. *Let's chat* stays available and becomes the effective fallback.

### 9.6 Payment failure handling (pre-term paid exits)

- Card declined / network error: inline error on the confirmation step, retry up to 3 attempts
- After 3 failures: paid-exit options for this session locked out (prevents card-tester abuse), *Let's chat* remains available
- Charge succeeds but Stripe subscription-cancel API fails: retry 3× with exponential backoff, then escalate to admin cockpit with red "manual cancel needed" flag. Charge is *not* auto-refunded — Andy decides bilaterally.

### 9.7 Legal hygiene notes (moved from Q21 flag)

- Terms copy (content mini-session) must plainly disclose the three paid-exit options for retainers and the three options for SaaS, *before* the tickbox agreement
- No hidden fine print
- Short solicitor review of terms copy before launch is prudent (not blocking)

---

## 10. Voice & delight treatment

Per the cross-cutting constraint: every customer-facing spec references `docs/specs/surprise-and-delight.md` under this heading and identifies which ambient slots apply, which hidden eggs may fire, and which sprinkles it claims from `docs/candidates/sprinkle-bank.md`.

### 10.1 Ambient layer slots that apply

- **Empty states** — the draft editor's "no catalogue items yet" empty state, the "no context yet" intro-paragraph placeholder, the "no upgrade options" retention card
- **Error pages** — payment failure inline errors, Stripe webhook-lost escalation banners, expired/withdrawn/superseded quote URL cards
- **Loading copy** — the 2–4s draft generation wait ("reading the thread…", "pulling what you told us…")
- **Success toasts** — quote sent, template saved, catalogue item updated (admin-side only)
- **Placeholder text** — the intro-paragraph empty-state prompt, the send-modal editable fields

### 10.2 Sprinkles claimed from the bank

- **§3 Transactional voice → Quote PDF cover line.** Claimed. The dry Playfair italic line at position 8 in the PDF (§4.4). Content mini-session decides between per-quote Claude generation and rotation from a hand-written pool.

### 10.3 Hidden eggs

None expected to fire *inside* the Quote Builder surfaces. The customer-facing quote page, the accept flow, the Payment Element reveal, the confirmation screen — all are context-aware-suppressed per the S&D spec's hard gates (mid-payment, wizards, errors, first session, etc.). Quote Builder pages are among the most gate-protected surfaces in the platform — nothing rare should fire during a quote decision.

### 10.4 Tier-2 motion moments

- **Payment Element reveal (Q15)** — **inherits Intro Funnel's existing slot**. No new motion slot spent. Closed-list count unchanged.
- No other Tier-2 moments added by this spec.

### 10.5 Sound registry additions

- **`sound:quote_accepted`** — one new slot. Admin-cockpit-only, idempotent per quote, visibility-gated. Registry count 7 → 8 (plus whatever Intro Funnel contributes). Characteristics in Q19. Sound file authored via content mini-session or sound-production pass.

### 10.6 The "felt experience wins" principle (proposed memory promotion)

Q6's GST decision surfaced a principle that applies beyond this spec:

> **When convention and felt experience conflict, felt experience wins unless compliance forces the convention.**

Proposing this be promoted to a new feedback memory after spec lock. Captured in the handoff note for Andy's sign-off before writing the memory file.

---

## 11. Cross-spec flags (running list consolidated)

Every additive flag identified during the brainstorm, grouped by target spec. None of these are implemented by Quote Builder itself — they are obligations on other specs.

### 11.1 Pipeline (`docs/specs/sales-pipeline.md`)

- `deals.won_outcome` enum: add `'project'` value (currently `retainer | saas`)
- `deals.committed_until_date` (date, nullable) — denormalised from accepted quote
- `deals.subscription_state` (enum as listed in §5.6)
- `deals.pause_used_this_commitment` (boolean, default false)
- `deals.stripe_subscription_id`, `deals.stripe_customer_id` (text, nullable) — denormalised
- `companies.gst_applicable` (boolean, default true)
- `activity_log.kind` enum additions (18 values — see §5.7)

### 11.2 Branded Invoicing (`docs/specs/branded-invoicing.md`)

- Must expose an invoice-generation primitive callable by `handleManualInvoiceSend` — signature TBD by that spec
- Must handle recurring monthly auto-send for manual-billed companies — wiring is through the `scheduled_tasks` primitive this spec introduces
- Must render invoices as ATO-compliant tax invoices (GST line itemised, ABN, "Tax invoice" in the document title) — derived from the GST-inclusive `total_cents_inc_gst` stored on the quote

### 11.3 Client Management (`docs/specs/client-management.md`)

- Must surface a "my invoices" page for manual-billed clients accessible from the Q16 manual-billed confirmation screen's footer link
- Must surface subscription state (active / paused / committed-until / pending early exit) on the client profile

### 11.4 Client Portal (currently rolled into Client Management until split)

- Owes `/lite/portal/subscription` with the pre-term and post-term branches defined in §9
- Owes the pause-status page for currently-paused subscriptions
- Owes the confirmation screens for each paid-exit outcome

### 11.5 SaaS Subscription Billing (`docs/specs/saas-subscription-billing.md`)

- Tier pricing model: longer commitment = cheaper monthly rate. 3/6/12-month tiers with progressive discounts (real numbers locked in that spec)
- Early-cancel "remainder" calculation must use the client's locked-in committed rate, not the rate they'd pay under a shorter tier — closes the "cancel 12-month, resubscribe 3-month" loophole
- SaaS-specific early-cancel flow per §9.3 (pause + pay remainder + continue)
- Consider whether SaaS signup uses Quote Builder at all or is a direct public-signup flow (likely direct signup — most of Quote Builder's draft-review-send machinery doesn't apply to SaaS activation)

### 11.6 Design System Baseline (`docs/specs/design-system-baseline.md`)

- No new Tier-2 motion slots claimed (Payment Element reveal inherits Intro Funnel's slot)
- One new sound registry slot claimed: `sound:quote_accepted` (total after this spec: 7 locked + 3 from Intro Funnel + 1 from here = 11)
- Design-system-baseline revisit (already owed) should note the additional registry entry and validate the characterisation

### 11.7 Surprise & Delight (`docs/specs/surprise-and-delight.md`)

- No new ambient-layer surface categories added
- One sprinkle claimed from `docs/candidates/sprinkle-bank.md`: §3 Quote PDF cover line
- No new hidden eggs proposed

### 11.8 Daily Cockpit (`docs/specs/daily-cockpit.md`)

- Must subscribe to the real-time admin event stream that surfaces `quote_viewed` / `quote_accepted` / `subscription_cancel_intercepted_preterm` / "needs attention" items
- Must render the scheduled-tasks "what's scheduled" pane as a small admin surface (query pattern in §8.5)
- Must render the worker-heartbeat red banner if the cron worker goes cold

### 11.9 Comms Inbox (`docs/specs/unified-inbox.md`)

- Quote-related emails (send, settle, expire, reminder, cancel-intercept) must thread correctly with the deal's contact thread via `In-Reply-To` / `References` headers

### 11.10 Foundations §11 patches

- **§11.2 `sendEmail()` gate:** already owed a `classification: 'transactional' | 'outreach'` parameter from Task Manager. Quote Builder uses `transactional` for every outbound it triggers (send, reminder, settle, expiry, cancel-intercept, early-exit confirmations). Monthly manual invoices use `transactional`. Post-term retention upgrade/downgrade emails drafted by Andy are also `transactional` since they're response-to-action, not unsolicited outreach.

---

## 12. Content mini-session scope (deferred)

Quote Builder intentionally defers all tone-specific content to a dedicated mini-session loaded with `superbad-business-context` + `superbad-brand-voice` + `superbad-visual-identity` skills. Runs before Phase 5 build of this spec.

### 12.1 Catalogue seed content

- Category taxonomy (ads management, creative, photography, video, social, content, etc. — real shape TBD)
- Unit choices per category
- Seeded item set (~20–40 items covering common retainer + project scope)
- Retainer tier naming and `tier_rank` ordering
- Starter templates (`quote_templates` rows) for common retainer shapes

### 12.2 Copy slots

- Section headings for the 5 scroll-snap sections (default: *What you told us* / *What we'll do* / *Price* / *Terms* / *Accept* — mini-session can refine)
- Terms tickbox label + placement
- Accept button copy
- Fine-print section copy around the Payment Element
- PDF cover line rotation pool (if rotation chosen over Claude-per-quote)
- PDF scope-summary prompt tuning
- Empty-state placeholders (intro paragraph, no catalogue, no context)
- Loading-state copy for the 2–4s draft generation wait
- Low-confidence warning wording on the intro paragraph review hint
- "Drew from rank N" provenance hint copy

### 12.3 Email templates

- Send email tone calibration (prompt adjustments to `draft-send-email.ts`)
- Reminder email (3-day) prompt and guardrails
- Settle email — Stripe-billed variant
- Settle email — manual-billed variant
- Expiry email
- Supersede email ("this replaces the quote I sent on {date}")
- Withdrawal email (if Andy wants one — possibly none)
- Cancel-intercept email (pre-term retainer Let's chat)
- Upgrade-intent email (post-term retention)
- Downgrade-intent email (post-term retention)
- Pause-ending heads-up email (SaaS)
- "First invoice lands {date}" email (manual-billed settle)
- Footer convention across all emails
- Sign-off convention (first-name only vs initial vs none)
- Button copy on link CTAs ("Read your quote →", "Open →", etc.)

### 12.4 Page copy (owned by the cancel flow section)

- Superseded URL card copy
- Withdrawn URL card copy
- Expired URL card copy
- Pre-term retainer cancel page header + "Let's chat" intercept copy
- Pre-term SaaS cancel page header
- Post-term retention page header
- "Here's what you'd be losing" bulleted-item presentation rules
- Pause-confirmation screen copy
- Paid-exit confirmation screen copy (remainder variant + buyout variant)

### 12.5 Terms page copy

- Full honour-based commitment terms (content + exit options + legal hygiene)
- Plain-English framing throughout
- Short solicitor review before launch (not blocking)

### 12.6 Voice slot: PDF cover line

- Decide between per-quote Claude generation (drift-checked) or rotation from a hand-written pool
- If rotation: author the pool (~20 lines minimum)
- If Claude: tune `draft-pdf-cover-line.ts`

---

## 13. Open questions

Items deferred to Phase 5 build with a note on what forces the resolution.

1. **Retainer-fit recommendation from Intro Funnel — is it auto-loaded into the Claude draft prompt or surfaced as a manual "pull from cockpit" action?** Current lock assumes auto-loaded. If performance or coupling concerns emerge during build, flip to manual. Low-risk decision either way.

2. **Should `subscription_ended_gracefully` ever fire when post-term cancels always route through the retention page?** Possibly never fires; if so, remove it from the enum before merging. Confirm in build.

3. **Quote number format.** Current shape: `SB-2026-0042` (prefix + year + zero-padded counter). Globally unique counter or per-year counter? Defaulting to per-year to keep numbers short; flag for Build if a compliance reason emerges.

4. **PDF cover line — Claude-per-quote vs rotation pool.** Deferred to content mini-session.

5. **Payment Intent → Subscription ordering race.** The current pattern creates a Payment Intent, then on success creates the Subscription. If the Subscription creation fails immediately after a successful charge, we have a paid-but-no-subscription state. Mitigation: handler retries Subscription creation 3× then escalates to cockpit with an explicit manual-recovery flag. Acceptable for v1; revisit if it occurs.

6. **Catalogue override audit granularity.** Snapshot-on-add captures the full catalogue state at draft time. Question: do we also log every mid-draft override edit to the activity log, or only the final snapshot at send? Current lock: only final snapshot at send (draft edits are ephemeral until send commits them). Revisit if audit needs grow.

7. **Retention page upgrade/downgrade — is the "option cards pull from the catalogue live, or from a snapshot"?** Current lock: live. If the catalogue changes mid-subscription, the client sees the current catalogue on the retention page. Acceptable because the retention page is a prompt for human conversation, not a commitment surface.

8. **Mid-retainer scope additions (not a new quote, just "can you add X this month?").** Not in v1. Andy handles bilaterally. Flagged as future feature.

---

## 14. Risks

### 14.1 Hard-to-reverse money events

Every Stripe charge triggered by this spec is an adversarial-blast-radius action: Payment Intent on accept, Payment Intent on paid-exit, Subscription creation, one-off `add_invoice_items`, pause / resume, cancel. A bug in any handler can:
- Double-charge a client (mitigated by idempotency keys on every Payment Intent creation)
- Forget to cancel a subscription after a successful cancel charge (mitigated by retry + cockpit escalation)
- Send a quote to the wrong client (mitigated by `canSendTo()` gate)
- Accept a superseded quote's payment (mitigated by status check at accept time)

The `scheduled_tasks` worker is also a trust boundary — any handler that mutates Stripe state needs bulletproof idempotency because the worker can re-run a task after a crash.

**Mitigation:** every Stripe-mutating handler is gated by an `idempotency_key` passed to Stripe and stored in `scheduled_tasks.payload_json`. Every webhook is gated by `webhook_events` row idempotency per FOUNDATIONS §8. Double-run in all cases is a no-op.

### 14.2 Supersede chain length

Unbounded in schema. In practice expected chains of 1–3. A pathological case of 50+ versions on one deal would not break anything but would make activity log reads noisy. Not worth bounding in v1.

### 14.3 Payment Element mount timing during cinematic reveal

The Framer Motion `layoutId` transform + Stripe Elements mount lifecycle is the hardest animation in the spec. The mount-on-tickbox strategy reduces cold-start but introduces a small edge case: if the client ticks, un-ticks, and re-ticks rapidly, we could mount-unmount-mount the Payment Element. Stripe supports this but it's not optimised. Mitigation: debounce the mount by 200ms on tick so rapid-toggle doesn't cause thrash.

### 14.4 Customer-facing audio risk

Explicitly withdrawn from Q15 / Q19. Any future reintroduction must pass a new S&D brainstorm gate.

### 14.5 Legal exposure on the cancel flow

Q21 gives clients three pre-term exit options. The lock is that none of the options is a dead-end — *"Let's chat"* is conversation-driven, *"pay remainder"* and *"50% buyout"* are genuine paid exits. This is defensible as long as:
- The terms copy clearly discloses all three options before the tickbox
- Both paid options actually complete promptly on successful charge
- The *"Let's chat"* page remains persistently accessible (client can always return and pick a different option)

Short solicitor review of terms copy before launch. Not a blocker.

### 14.6 Scheduled-tasks worker failure

Single-worker architecture means a worker crash blocks all scheduled work until restart. Mitigation:
- Worker-heartbeat red banner in admin cockpit if `last_tick_at > now() - 5 min`
- Stale-row reclaim on restart
- Coolify auto-restarts on process exit
- Alert to Andy (via whatever cockpit real-time layer exists) on heartbeat cold
- If volume grows: migrate to BullMQ + Redis with a 1-day adapter swap — `task_type` enum and handler-map pattern are portable

### 14.7 GST compliance via non-Stripe flow

Manual-billed invoices are generated by Branded Invoicing, not by Stripe. Branded Invoicing must render valid ATO tax invoices (itemised GST, ABN, "Tax invoice" title) — Quote Builder's GST-inclusive storage pattern relies on Branded Invoicing doing the ex-GST derivation correctly. Flag for Branded Invoicing spec.

### 14.8 Cross-spec flag debt

Quote Builder emits cross-spec flags at a higher rate than any prior Phase 3 spec — 18 new `activity_log.kind` values, 5 new `deals` columns, a new `companies` column, a new `deals.won_outcome` value, a new shared scheduled-tasks primitive, plus implementation obligations on 5 other future specs. If those specs are written in isolation without reading this handoff, the flags will be missed. **Handoff discipline is critical.**

---

## 15. Reality check

### 15.1 What could go wrong

- **Stripe integration surface area is large.** Payment Intents + Subscriptions + Billing Portal config + webhooks + `add_invoice_items` + one-off paid exits + pause/resume — this spec touches more Stripe surfaces than any other Lite feature. A single mis-ordered webhook handler or missing idempotency key can cause real harm. Phase 5 session(s) that build this must have dedicated webhook testing with Stripe CLI forwarding.
- **The scheduled-tasks worker is new infrastructure.** First Lite feature to mount a second Coolify process. First feature with a worker-heartbeat concept. First feature whose reliability depends on a long-running process outside the Next.js request cycle. Build must verify:
  - Worker restart behaviour (Coolify config)
  - Heartbeat banner wiring in cockpit
  - Stale-row reclaim under simulated crash
  - Idempotency of every handler under repeated dispatch
- **The Payment Element cinematic reveal is the hardest motion moment in the spec.** Framer `layoutId` shared between a button and a Stripe Elements container is not a pattern Stripe's docs cover. Prototype this in a spike session *before* committing to the full flow. Fallback plan if the transform is fragile: degrade to a modal (Option B from Q15) behind a feature flag — worse experience but shippable.
- **Claude prompts multiply.** Seven Opus-tier prompts + one Haiku prompt means eight places where drift-check can fail, eight places where Claude cost matters, eight places where retries are possible. Build session must budget for prompt-tuning time, not just "call the API and render the result". Content mini-session will help but not eliminate this.

### 15.2 The hardest part

Not any single decision — it's the **combination** of Stripe + scheduled-tasks + cinematic motion + Claude-drafted content + cross-spec flags + cancel-flow UX in one feature. Quote Builder is the most load-bearing spec in Phase 3 by a meaningful margin. Phase 5 session planning for this feature should assume **three build sessions minimum**, possibly four:

1. **Session A — Data + Stripe.** Tables, state machine, Payment Intent + Subscription creation, webhook handlers, Billing Portal config. No UI. No Claude. Verify via Stripe CLI + Drizzle queries only.
2. **Session B — Scheduled-tasks primitive.** Worker process, handler map, stale reclaim, heartbeat, all 5 Quote Builder handlers. Unit tests for each handler.
3. **Session C — Draft editor + send flow.** Two-pane editor, all Claude prompts wired, template load path, send modal, email dispatch. Static preview pane (no scroll-snap yet).
4. **Session D — Client web page + confirmation + cancel flow.** Scroll-snap, Payment Element cinematic reveal, confirmation screens, the full `/lite/portal/subscription` flow, supersede / withdraw / expired card states.

Session A and B are technically independent and could run in parallel if two Phase 5 sessions are available. Sessions C and D depend on A and B.

### 15.3 Is this actually doable?

Yes. Each individual piece is known — Stripe Payment Intents, `node-cron` workers, scroll-snap, Framer Motion, Puppeteer PDFs, Claude prompts with structured outputs. None of the pieces are novel. The risk is aggregate complexity, not any one piece.

The spec is long because it has to be — Quote Builder is where every Phase 2 primitive gets exercised for the first time under real stakes. Keeping it crisp matters less than getting every decision load-bearingly correct. That said, the spec is longer than any prior Phase 3 spec, and Phase 4 build planning should plan session chunks accordingly.

### 15.4 What this spec unblocks

- **Pipeline's Quoted → Won transition** end-to-end for both billing modes
- **The `scheduled_tasks` primitive** for every future spec that needs scheduling
- **Stripe webhook idempotency** as a tested pattern ready for Branded Invoicing and SaaS Subscription Billing to reuse
- **The dynamic-amount Payment Intent** pattern (inherited from Intro Funnel, re-validated here for long-tail use)
- **The supersede pattern** as a template for any future spec that needs immutable-after-send documents (Branded Invoicing is the obvious next consumer)
- **The cinematic Payment Element reveal** as a proven Tier-2 motion pattern
- **The custom cancel flow** as a proven Lite-UX-layer enforcement pattern for commitment-based products

---

**End of spec. 21 decisions locked. Awaiting Phase 4 build plan to sequence the implementation sessions.**

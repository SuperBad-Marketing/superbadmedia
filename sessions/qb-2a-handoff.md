# QB-2a — Quote Builder draft editor (left pane + actions) (handoff)

**Closed:** 2026-04-14
**Wave:** 6 (Quote Builder — split from QB-2 at session kickoff)
**Brief:** `sessions/qb-2a-brief.md` · `BUILD_PLAN.md` Wave 6 QB-2.

## Context — the split

QB-2 was tagged "large" in the build plan and carries four concerns (editor
left pane, live preview motion, Templates CRUD, Catalogue CRUD). Rather
than compress all four into one context, the session split into:

- **QB-2a (this session):** draft editor left pane + server actions +
  static preview placeholder.
- **QB-2b (next session):** live preview motion (300ms debounce, houseSpring
  crossfade, mobile/desktop framing per spec §4.1 motion) + Templates CRUD
  (`/lite/admin/settings/quote-templates`) + Catalogue CRUD
  (`/lite/admin/settings/catalogue`).

## What shipped

- **`lib/quote-builder/content-shape.ts`** — canonical `QuoteContent` shape
  (version 1) stored in `quotes.content_json`. Types: `QuoteContent`,
  `QuoteLineItem`, `QuoteLineItemSnapshot`, `QuoteTotals`. Helpers:
  `emptyQuoteContent(expiryDays)`, `computeTotals(content)`,
  `inferStructure(content)`. Canonical total rule: `retainer_monthly +
  one_off` — one month's retainer plus any one-off stack, matching §3
  "first invoice" framing.
- **`lib/quote-builder/draft.ts`** — draft lifecycle:
  - `createDraftQuote({ deal_id, company_id, user_id })` — idempotent per
    deal (returns existing open draft if present), allocates quote number
    via `allocateQuoteNumber()`, generates a 24-byte URL-safe token,
    seeds content from `emptyQuoteContent()` using
    `settings.get("quote.default_expiry_days")`.
  - `findOpenDraftForDeal(dealId)` — returns the existing `draft` row or
    `null`.
  - `updateDraftQuote({ quote_id, content, user_id })` — status-guard
    (throws `QuoteNotDraftError` on non-draft), recomputes totals +
    structure from content, stamps `last_edited_by_user_id`.
- **`app/lite/admin/deals/[id]/quotes/new/page.tsx`** — admin-gated
  Server Component, creates or reuses the open draft, redirects to the
  edit route. No UI.
- **`app/lite/admin/deals/[id]/quotes/[quote_id]/edit/page.tsx`** —
  admin-gated Server Component. Loads deal ⨝ company ⨝ primary contact +
  active catalogue items, hydrates `QuoteEditor`.
- **`app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions.ts`** —
  `updateDraftQuoteAction({ deal_id, quote_id, content })` Server Action.
  Admin re-check, routes through `updateDraftQuote()`, revalidates the
  edit path, maps `QuoteNotDraftError` to a friendly message.
- **`components/lite/quote-builder/quote-editor.tsx`** — client two-pane
  layout (40/60 `lg:grid-cols-[2fr_3fr]`). Left pane renders all five
  sections (§1 prose + redraft-stub, §2 line items + catalogue picker +
  scope prose, §3 read-only derived totals, §4 terms overrides,
  §5 read-only client preview) + sidebar controls (term length, expiry
  days, Save draft button). Save button fires the Server Action, toast
  on result.
- **`components/lite/quote-builder/catalogue-picker.tsx`** — BaseUI
  Popover with search + category filter + retainer/one-off kind picker.
  Click a row → snapshot catalogue into a new line item (per §5.2
  snapshot-on-add).
- **`components/lite/quote-builder/preview-pane.tsx`** — static
  read-only approximation of the client quote page (warm-cream bg,
  brand-red Accept CTA, §1–§5 sections). QB-2b swaps this for the
  300ms-debounced live preview + houseSpring motion + scroll-snap.
- **13 new tests** — 9 pure helper tests (`qb2a-content-shape`) + 4
  integration tests (`qb2a-draft`) for create + idempotency + update-
  recompute + non-draft rejection. **542/542 tests green** (was
  529/529 at QB-1 close), typecheck clean, G4 clean.

## Files touched

New:
- `lib/quote-builder/content-shape.ts`
- `lib/quote-builder/draft.ts`
- `app/lite/admin/deals/[id]/quotes/new/page.tsx`
- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/page.tsx`
- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions.ts`
- `components/lite/quote-builder/quote-editor.tsx`
- `components/lite/quote-builder/catalogue-picker.tsx`
- `components/lite/quote-builder/preview-pane.tsx`
- `tests/qb2a-content-shape.test.ts`
- `tests/qb2a-draft.test.ts`
- `sessions/qb-2a-brief.md`

Edited: none (zero changes to existing files — pure additive session).

## Verification (G0–G12)

- **G0** kickoff: `sessions/qb-1-handoff.md` + `sessions/sp-9-handoff.md` +
  `docs/specs/quote-builder.md` §§ 3.1, 4.1, 5.1–5.3 + `START_HERE.md`
  §Phase-5 read at session start.
- **G1** preflight: verified `quotes`, `catalogue_items`, `quote_templates`,
  `sequences` land via QB-1 migration 0016; `allocateQuoteNumber`,
  `assertQuoteTransition`, `companies.gst_applicable` + `abn` all present;
  `settings.get("quote.default_expiry_days")` seeded (14) by QB-1.
- **G2** scope: touched only files on the QB-2a brief whitelist.
- **G4** settings-literal grep: only tunable referenced is
  `quote.default_expiry_days`, routed through `settings.get()` (server)
  and passed into the client editor as a prop. Term-length options
  (`[3,6,9,12]`) are UI-schema enum choices (format, not autonomy);
  `min={1} max={120}` on the expiry `<input>` are UI bounds.
- **G6** rollback: **git-revertable, no schema change, no migration, no
  settings writes.** Draft rows created by testing can be cleared with
  `DELETE FROM quotes WHERE status='draft'` (no downstream refs until
  QB-3+ lands PDF cache or Stripe IDs).
- **G7** artefact verification: every file listed above confirmed on disk
  via the session's own Write tool calls.
- **G8** typecheck + tests: `npx tsc --noEmit` zero errors; `npm test`
  542/542 green.
- **G11** handoff: this file.

## Key decisions locked

- **Content shape lives in a dedicated file** (`lib/quote-builder/
  content-shape.ts`), not inlined in a route. This is the shape every
  downstream surface reads — client preview pane (QB-2b), PDF renderer
  (QB-3), client web page (QB-4), supersede fork (QB-7) — so it earns
  its own home with a version stamp. v1 today; v2 migrations shift
  shape without touching callers.
- **Idempotent `createDraftQuote`.** "Open a quote on this deal" is a
  Zombie button — Andy might click it twice, bounce the tab, revisit a
  week later. The helper returns the existing `draft` row instead of
  stacking. Prevents orphaned drafts littering the pipeline.
- **`total_cents_inc_gst = retainer_monthly + one_off`** (single month
  + one-off stack, not full term × monthly). Matches §3 "first invoice"
  framing the client sees on the web quote. Full-term-value is a
  derived display concern for the client page; the canonical stored
  total is the first-invoice number Stripe will bill.
- **Static preview today, motion preview in QB-2b.** `PreviewPane`
  ships as a read-only approximation — enough to show the editor works
  end-to-end without committing to 300ms debounce + houseSpring
  crossfade + scroll-snap simulation in a compressed context. QB-2b
  swaps it out under an unchanged prop contract.
- **Server Action colocated at the route folder** (not in `lib/`).
  Matches the existing pipeline pattern
  (`app/lite/admin/pipeline/actions.ts`,
  `app/lite/admin/companies/[id]/actions.ts`). Pure helpers live in
  `lib/quote-builder/draft.ts` and are action-agnostic — test target
  surface is the pure helper, not the action.

## Not done (by design, tracked)

- **Live preview motion** — QB-2b (spec §4.1 motion block).
- **Templates CRUD** (`/lite/admin/settings/quote-templates`) — QB-2b.
- **Catalogue CRUD** (`/lite/admin/settings/catalogue`) — QB-2b.
- **"Open quote" entry point from the pipeline drawer** — drawer doesn't
  exist yet; Client Management spec owns it. Route today is reachable
  only by direct URL or from a later deal-drawer build session.
- **Claude draft-from-context pre-fill** (§3.1 step 2) — "Redraft" button
  in §1 is a disabled stub; wires when `draft-quote-from-context.ts`
  prompt mini-session lands.
- **Send modal + supersede + withdraw** — QB-3 (send + PDF), QB-7
  (supersede/withdraw).
- **Catalogue content mini-session** (§12.1) — still owed from QB-1.
  Editor works against whatever the catalogue contains; empty catalogue
  surfaces a "Settings (QB-2b)" hint in the picker.
- **Cross-spec flag receipts** — not a QB-2a concern.

## Open threads for next session (QB-2b)

- **QB-2b scope confirmed by split:** live preview pane (300ms debounce
  on content changes; houseSpring crossfade on the affected preview
  block only; mobile/desktop frame width animation; scroll-snap
  simulation inside the preview frame) + Templates CRUD route tree +
  Catalogue CRUD route tree. Medium-context session — each of the
  three is self-contained.
- **Drop-in point for motion preview:** swap
  `components/lite/quote-builder/preview-pane.tsx`. Props contract
  (`content`, `totals`, `structure`, `quoteNumber`, `companyName`,
  `device`) is stable. Editor's `content` state already drives re-renders;
  QB-2b adds debounce + Framer Motion `layoutId`/`AnimatePresence`
  around preview blocks.
- **Templates CRUD contract** (§4.5): same left-pane structure as the
  draft editor. Consider extracting sections 1–4 of `quote-editor.tsx`
  into a shared `QuoteBodyFields` sub-component before writing the
  templates editor, so both surfaces render the same fields.
- **Catalogue CRUD contract** (§4.6): CRUD on `catalogue_items`. Pricing
  audit trail ("per-item history") is a soft requirement — add a
  sibling `catalogue_item_price_history` table if/when §5 demands it;
  not owed in QB-2b unless spec says so.
- **QB-1's open PATCHES_OWED (`sp7_if_stripe_metadata_contract`,
  `sp7_qb_stripe_metadata_contract`) stay open** — both gate on QB-5,
  not QB-2b.
- **Manual browser verification for SP-5 + SP-6 + SP-9** still owed
  (carried over from SP-9); not regressed by QB-2a.

## Rollback

Git-revertable. No schema change. No migration. No settings writes.

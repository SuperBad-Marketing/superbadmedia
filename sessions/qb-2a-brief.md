# QB-2a — Quote Builder draft editor (left pane + actions) (brief)

**Wave:** 6 (Quote Builder). **Split from QB-2** at session kickoff: QB-2 is
tagged "large" context in BUILD_PLAN and carries four concerns. QB-2a ships
the draft editor left pane + server actions; QB-2b (next) ships live preview
motion + Templates CRUD + Catalogue CRUD.

## Scope (in)

1. **Content JSON shape** — `lib/quote-builder/content-shape.ts`: `QuoteContent`
   type (version 1), `emptyQuoteContent()`, `computeTotals()`, `inferStructure()`.
2. **Draft lifecycle helpers** — `lib/quote-builder/draft.ts`:
   `createDraftQuote({ deal_id, user_id })` (allocates quote number via
   `allocateQuoteNumber()`, writes `quotes` row with empty content + 0 total +
   token), `updateDraftQuote({ quote_id, content, user_id })` (status-guard:
   only `draft` rows editable; recomputes totals + structure from content).
3. **Routes:**
   - `/lite/admin/deals/[id]/quotes/new` — Server Component, admin-gate,
     creates the draft, redirects to edit route. Idempotency: if an open
     draft already exists on the deal, redirect into it instead of stacking.
   - `/lite/admin/deals/[id]/quotes/[quote_id]/edit` — Server Component,
     admin-gate, loads deal + quote + catalogue, renders client editor.
4. **Server Action** at the edit route:
   - `updateDraftQuoteAction({ quote_id, content })` — admin-gated, routes
     through `updateDraftQuote()`, revalidates the edit path.
5. **Client editor** `components/lite/quote-builder/quote-editor.tsx`:
   - Two-pane split (40/60). Left pane: context header + 4 editable sections
     (§1 prose, §2 line items + prose, §3 derived totals read-only, §4 terms
     overrides) + sidebar (term length, expiry, save draft).
   - Section 2 uses inline **catalogue picker** (search + category filter +
     click-to-add) — snapshots the catalogue row into the line item.
   - Right pane: minimal static preview (enough to show structure renders).
     Full motion + scroll-snap preview lands in QB-2b.
   - Autosaves nothing; explicit "Save draft" → Server Action → toast.
6. **Unit tests** for the pure helpers: totals math, structure inference,
   empty-content defaults. Integration test for `createDraftQuote()` +
   `updateDraftQuote()` against the real migrated schema.

## Scope (out, deferred)

- **Live preview motion** (300ms debounce, houseSpring crossfade, mobile
  toggle) — QB-2b.
- **Templates CRUD** (`/lite/admin/settings/quote-templates`) — QB-2b.
- **Catalogue CRUD** (`/lite/admin/settings/catalogue`) — QB-2b.
- **Claude draft-from-context pre-fill** (§3.1 Q17) — later wave (needs
  `draft-quote-from-context` prompt mini-session).
- **Send modal** (§4.2) — QB-3 (lands Puppeteer + send email).
- **Edit-after-send / supersede** — QB-7.
- **Intro paragraph redraft button** — stub only (disabled); wires up when
  the prompt mini-session lands.

## Preconditions verified

- `quotes`, `catalogue_items`, `quote_templates`, `sequences` tables + FKs
  present from QB-1 migration 0016.
- `allocateQuoteNumber()` + `assertQuoteTransition()` available.
- `companies.gst_applicable`/`abn` present.
- Admin gate via `auth()` + `session.user.role === "admin"` (see
  `app/lite/admin/companies/[id]/page.tsx`).
- `randomUUID()` from `node:crypto` is the repo id convention.
- No new npm deps needed.

## Settings keys consumed

- `quote.default_expiry_days` (14) — default for sidebar expiry picker.

No new settings keys added in QB-2a.

## Rollback

Git-revertable. No schema change. No migration. No settings writes.
Draft rows created during testing can be deleted via `DELETE FROM quotes
WHERE status='draft'` if needed (no downstream refs until QB-3+).

## Verification gates

G0 kickoff (this brief + qb-1-handoff + sp-9-handoff + spec §4.1 read),
G1 preflight (tables + helpers confirmed), G2 scope (files on whitelist
only), G4 settings-literal grep (no new tunables embedded),
G6 rollback (above), G7 artefact verify, G8 typecheck + `npm test` green,
G11 handoff.

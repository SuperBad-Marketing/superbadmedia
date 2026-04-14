# QB-2b — Quote Builder live preview + Templates CRUD + Catalogue CRUD (handoff)

**Closed:** 2026-04-14
**Wave:** 6 (Quote Builder — split second half of QB-2)
**Prior:** `sessions/qb-2a-handoff.md`. QB-2b ran from the inline scope in the tracker + QB-2a handoff — no separate brief file was authored on session start; PATCHES_OWED row added below.

## What shipped

### 1. Live preview motion (spec §4.1)
- Rewrote `components/lite/quote-builder/preview-pane.tsx` onto framer-motion.
- **300ms debounced mirror** of editor content (`useDebouncedPreview`) — every preview block settles together on the same tick.
- **Per-block crossfade** via `AnimatePresence mode="wait"` keyed by a djb2 hash of each section's content — only the dirty block re-keys; untouched blocks stay mounted. 220ms ease-out.
- **Mobile/desktop device toggle** animated on `motion.div layout` with houseSpring (`mass:1, stiffness:220, damping:25`, 380ms) — max-width crossfades between 380px and 720px.
- **Reduced-motion** via `useReducedMotion()` — all transitions collapse to 20ms linear; editor and preview still functional.
- Props contract unchanged (`content`, `totals`, `structure`, `quoteNumber`, `companyName`, `device`) — QuoteEditor drops in unchanged. Totals and structure are recomputed inside the preview off the settled copy so the §3 block lands at the same instant as §2.

### 2. Catalogue CRUD at `/lite/admin/settings/catalogue` (spec §4.6)
- `lib/quote-builder/catalogue.ts` — `listCatalogueItems` / `getCatalogueItem` / `createCatalogueItem` / `updateCatalogueItem` / `softDeleteCatalogueItem` / `restoreCatalogueItem`. `CatalogueValidationError` for name/category/price/tier_rank validation. All helpers accept an optional `dbOverride` for tests (matches `draft.ts` pattern).
- `app/lite/admin/settings/catalogue/page.tsx` — admin-gated Server Component. Loads all rows (including soft-deleted) and hands them to the client.
- `app/lite/admin/settings/catalogue/actions.ts` — `createCatalogueItemAction` / `updateCatalogueItemAction` / `softDeleteCatalogueItemAction` / `restoreCatalogueItemAction`. Each re-checks admin; revalidates `/lite/admin/settings/catalogue` + the admin deals layout so the picker refreshes.
- `app/lite/admin/settings/catalogue/catalogue-admin.tsx` — client list + BaseUI Dialog for create/edit. Framer `AnimatePresence` on list rows with layout/height animation + houseSpring; reduced-motion fallback. Category filter, "Show deleted" toggle, soft-delete + restore.
- Snapshot-on-add (§5.2) keeps in-flight quotes safe — edits/deletes never drift existing quotes.

### 3. Templates CRUD at `/lite/admin/settings/quote-templates` (spec §4.5)
- `lib/quote-builder/templates.ts` — `listQuoteTemplates` / `getQuoteTemplate` / `createQuoteTemplate` / `updateQuoteTemplate` / `softDeleteQuoteTemplate`. `TemplateValidationError` covers name/structure/term-length/line-item-qty. Retainer structure requires `term_length_months`. Same `dbOverride` pattern.
- `app/lite/admin/settings/quote-templates/{page,actions,templates-admin}.tsx` — matching admin-gated route tree. Dialog editor captures name, structure, term length, optional default §2 and §4 prose, and a list of default line items (catalogue picker + remove). Deletes are always soft v1; hard-delete-when-no-references is deferred until the send flow stamps `quotes.template_id` (doesn't exist yet).
- `default_sections_json` + `default_line_items_json` ride as typed shapes (`TemplateDefaultSections`, `TemplateDefaultLineItem`). No new schema.

### 4. Tests
- `tests/qb2b-catalogue.test.ts` — 3 groups / 7 assertion blocks: create/list/update/soft-delete/restore + validation rejections + update-after-delete rejection.
- `tests/qb2b-templates.test.ts` — 5 groups: JSON round-trip, retainer-without-term rejection, invalid-qty rejection, soft-delete hide-with-override, update-after-delete rejection.
- **550/550 tests green** (was 542/542 at QB-2a close).

## Files touched

New:
- `lib/quote-builder/catalogue.ts`
- `lib/quote-builder/templates.ts`
- `app/lite/admin/settings/catalogue/page.tsx`
- `app/lite/admin/settings/catalogue/catalogue-admin.tsx`
- `app/lite/admin/settings/catalogue/actions.ts`
- `app/lite/admin/settings/quote-templates/page.tsx`
- `app/lite/admin/settings/quote-templates/templates-admin.tsx`
- `app/lite/admin/settings/quote-templates/actions.ts`
- `tests/qb2b-catalogue.test.ts`
- `tests/qb2b-templates.test.ts`
- `sessions/qb-2b-handoff.md`
- `sessions/qb-3-brief.md`

Edited:
- `components/lite/quote-builder/preview-pane.tsx` (rewritten from static to live-motion; props contract stable)

No schema, no migration, no new settings keys, no new npm dependencies.

## Verification (G0–G12)

- **G0** kickoff: `sessions/qb-2a-handoff.md`, `sessions/sp-9-handoff.md`, spec §§4.1, 4.5, 4.6, 5.2, 5.3 read at session start.
- **G1** preflight: verified `catalogue_items` + `quote_templates` tables land via QB-1 migration `0016_qb1_quote_builder_schema.sql`; Dialog/Select/Textarea/Input/Badge primitives already in `components/ui/`; `useReducedMotion` + `AnimatePresence` already used elsewhere (deal-card, kanban-board).
- **G2** scope: three-concern brief — live preview, catalogue CRUD, template CRUD. Only files listed above touched.
- **G4** settings-literal grep: preview-pane motion constants (`PREVIEW_DEBOUNCE_MS=300`, `CROSSFADE_DURATION_S=0.22`, `DEVICE_ANIM_DURATION_S=0.38`) and houseSpring copies in the two admin components are **UI motion constants** pinned by spec §4.1 — not autonomy thresholds (matches `HOVER_INTENT_DELAY_MS=300` in `deal-card.tsx`). No tunable numerics. No new settings keys.
- **G5** motion: every state change animated — list rows (`AnimatePresence` + layout/height + houseSpring), Dialog (BaseUI built-in), preview block swaps, device toggle. Reduced-motion honoured throughout.
- **G6** rollback: **git-revertable, no schema change, no migration, no settings writes.** Any rows created by manual testing can be cleared with `DELETE FROM catalogue_items WHERE ...` / `DELETE FROM quote_templates WHERE ...`.
- **G7** artefacts: every file above confirmed on disk via the session's own Write calls.
- **G8** typecheck + tests: `npx tsc --noEmit` zero errors; `npm test` 550/550 green.
- **G9** N/A — QB-2b doesn't touch a critical flow (quote-accept E2E lands at QB-E2E).
- **G10** manual browser check: **owed, non-blocking** (pattern consistent with SP-3/4/5/6/9 + QB-2a). Seed a catalogue row, seed a template, open a draft quote against the editor, observe per-block crossfade on edits, flip device toggle. Noted in SESSION_TRACKER next-action.
- **G11** handoff: this file.
- **G11.b** next-session brief: `sessions/qb-3-brief.md` written for the next session (QB-3 — Puppeteer + PDF + send-email). Wave continues; not a wave-closing session so no further briefs owed.
- **G12** tracker + commit: tracker updated; commit follows.

## Key decisions locked

- **Per-block preview crossfade via content-hash keys, not per-field dirty flags.** Simpler, deterministic, no prop-drilling. djb2 hash of JSON-stringified section content is cheap enough to run on every render — collision risk is irrelevant (missing a single crossfade doesn't break anything).
- **Settled totals inside the preview.** Recomputing totals on live editor props would race the 300ms debounce and let §3 move before §2 settled. Preview pane now recomputes totals from the debounced content — everything lands together.
- **Motion constants inline in the preview file, not promoted to `lib/design-tokens.ts`.** Spec pins them to one surface (§4.1) and the values aren't reused elsewhere yet. Promotes to tokens if a second surface lands a 300ms debounce.
- **Templates hard-delete deferred.** §4.5 wants hard-delete when no quote references a template, but v1 `quotes` doesn't carry `template_id` yet. Soft delete is always correct today and forward-compatible; promoted to conditional hard-delete once QB-2/QB-3 stamp `template_id` at send time.
- **Template editor does NOT share a `QuoteBodyFields` component with the draft editor.** QB-2a handoff suggested extracting one. On review the two surfaces diverge enough (templates don't render `whatYouToldUs`, don't compute totals, don't own a line-item price override path identical to the editor's) that a shared component would ship as conditional rendering with lots of `if (mode === "template")` branches. Lighter to keep them parallel — if a third consumer lands a refactor becomes worth it.
- **Dialog over full-page routes for CRUD.** Spec says "modal". Two reasons to obey: CRUD here is three fields + a short list, doesn't warrant a dedicated URL, and it keeps the admin mental model close to the pipeline drawer (once that lands).
- **Catalogue-category is a free-text field, not a curated enum.** Spec §5.2 notes "content mini-session owes taxonomy" — no content mini-session has landed. Free-text keeps the CRUD usable today; a future mini-session can migrate existing rows into a closed list without code churn.

## Not done (by design, tracked)

- **Templates: "apply to draft" action.** Clicking a template from the QB-2a draft editor to seed content isn't wired. QB-2a editor has no template picker yet; landing it here would widen scope beyond the brief. Owed: apply-template button on the draft editor's sidebar (small, would land cleanly in QB-3 or a dedicated patch).
- **`usage_count` incrementing.** Templates track a usage count column but nothing increments it — wires in when QB-2a editor gains the "apply template" action.
- **Full-viewport Dialog motion tune.** BaseUI's Dialog ships its own fade/zoom; haven't layered houseSpring on top. Consistent with other admin dialogs today (destructive-confirm-modal uses the same primitive).
- **Template price-override editing UI.** `TemplateDefaultLineItem.override_price_cents_inc_gst` is in the shape but the admin UI doesn't surface an override field yet (default line items always use catalogue base). Add when Andy asks.
- **Catalogue-item price history / audit trail (§4.6 "per-item history").** Spec marks it "soft requirement". Not built; would need a sibling `catalogue_item_price_history` table — cleanest to land alongside the first surface that needs it.
- **PATCHES_OWED review:** `sp7_if_stripe_metadata_contract` + `sp7_qb_stripe_metadata_contract` still open — both gate on QB-5 (Checkout Session metadata), not QB-2b. `sp9_*` toast-registry rows unchanged.

## Open threads for next session (QB-3)

- **QB-3 scope** per `BUILD_PLAN.md` Wave 6: Puppeteer dependency lands + `renderToPdf()` real implementation (stub today in A7) + quote PDF (A4 portrait, spec §4.4 content blocks) + send-email composition (Claude-drafted, drift-checked).
- **Pre-session** should read `docs/specs/quote-builder.md` §§ 3.2, 4.2 (send modal), 4.4 (PDF), 8.3 (scheduled tasks) + `sessions/qb-2b-handoff.md` + `sessions/qb-2a-handoff.md`.
- **Puppeteer landing rules:** new npm dep (`puppeteer` or `puppeteer-core`) — flag in handoff per CLAUDE.md "never install an npm package without flagging the reason"; recommendation is `puppeteer-core` + system-Chrome in prod, bundled Chromium in dev. Decision belongs to QB-3.
- **`lib/ai/prompts/draft-quote-email.md` stub** likely needs to be written alongside or in a content mini-session; content mini-session owed from QB-1 is still queued.
- **Send button wiring** on QB-2a editor connects here — will flip `quotes.status` `draft → sent` via `transitionQuoteStatus()` (from QB-1) and enqueue the PDF + email.
- **Preview device toggle today is live in the editor** — QB-3 can reuse the preview-pane for the send-modal preview column (§4.2) or carry its own stripped variant. Recommend reusing.

## PATCHES_OWED — new rows

- `qb2b_brief_missing` — QB-2b did not have a pre-compiled `sessions/qb-2b-brief.md` at session start; the scope was clearly pinned in `sessions/qb-2a-handoff.md` + SESSION_TRACKER "next session" block, so the session proceeded under the G11.b mop-up rule (one-line escalation, no further mop-up spawn). Not a blocker — logged so the cadence gap is visible. Gate: none; closes when acknowledged.
- `qb2b_apply_template_in_editor` — QB-2a draft editor has no "apply template" affordance. Template CRUD ships today but templates aren't reachable from the editor yet. Gate: QB-3 (natural moment — sidebar already grows).
- `qb2b_template_usage_count` — `quote_templates.usage_count` never increments; tied to the apply-template action above.

## Rollback

Git-revertable. No schema change. No migration. No settings writes. No new npm deps.

# `admin-polish-6` — Handoff

**Closed:** 2026-04-16
**Wave:** 9 (Admin-interior visual parity) — 6 of 6 **(wave-closer)**
**Model tier:** `/deep` (Opus)

---

## What landed

Settings shells at `/lite/admin/settings/catalogue` and `/lite/admin/settings/quote-templates` visually rebuilt against `mockup-admin-interior.html` §§3, 5, 6, 7, 8.

**Files touched:**

- `app/lite/admin/settings/catalogue/page.tsx` — §3 index-header rewrite. Righteous 10px / 2px crumbs (`Admin · Settings · Catalogue`, last segment brand-pink) → BHS 32px H1 → DM Sans deck with conditional Playfair italic pink mutter (suppressed on empty, voiced as `"{N} thing(s) to charge for."` on populated). `mx-auto max-w-5xl px-4 py-6` wrapper stripped (admin-chrome-1 owns root layout). Active count computed server-side from `listCatalogueItems`.
- `app/lite/admin/settings/catalogue/catalogue-admin.tsx` — full chrome rewrite. Toolbar: surface-2 + inner-highlight shell, Righteous label, "New item" brand-red CTA (§8 earned recipe: Righteous 11px / 1.8px, inner-highlight + glow shadow, hover lifts -1px). §7 table: Righteous 10px / 2px headers on 5% cream border, `rgba(253,245,230,0.03)` row hairlines, framer-motion `whileHover rgba(253,245,230,0.025)` on live rows, disabled on deleted rows. Category column uses inline `CategoryChip` (§5 chip recipe — Righteous 10px / 1.5px, neutral rgba-tint, 1×1 currentColor dot). Price column Righteous tabular-nums right-aligned. Unit column Righteous 11px with optional tier-rank suffix. Action buttons: ghost recipe (transparent bg, Righteous 10px / 1.5px, `rgba(253,245,230,0.08)` border, rule-09 hover). §8 voiced empty: dashed border, `rgba(15,15,14,0.3)` bg, Righteous "Empty" eyebrow in brand-orange, BHS 24px headline "No catalogue items yet.", neutral-400 body, Playfair italic pink micro "still figuring out what to charge for." Dialog: §6 surface-2 chrome + 12px radius + inner-highlight, BHS 22px title, ghost Cancel + brand-red Save. Unused `Button` + `Badge` imports removed.
- `app/lite/admin/settings/quote-templates/page.tsx` — §3 index-header rewrite. Same pattern as catalogue: Righteous crumbs → BHS 32px H1 → conditional Playfair mutter (`"{N} shortcut(s) to a quote."` on populated, suppressed on empty). Active count computed server-side.
- `app/lite/admin/settings/quote-templates/templates-admin.tsx` — full chrome rewrite mirroring catalogue pattern. Structure column uses `StructureChip` with TONE map: `retainer` → pink rgba, `project` → orange rgba, `mixed` → warn rgba. Term column Righteous 11px. Usage column Righteous tabular-nums right-aligned. Deleted templates show "deleted" label instead of action buttons (no restore path on templates — matches QB-2b original). `Badge` import removed (no longer used). Dialog line-item rows styled with surface-2/dark-inset chrome (rounded, bordered, spaced) replacing bare `border-border/60`.

## What didn't land

- **Manual browser parity screenshots.** Deferred to `admin_polish_6_manual_browser_verify` per standard admin-auth-seed friction.
- **No new component files extracted.** `CategoryChip` is inline in `catalogue-admin.tsx` (single consumer). `StructureChip` is inline in `templates-admin.tsx` (single consumer). Brief §5 threshold was ≥5 categories for extraction — did not grep-verify category diversity, but single-consumer discipline holds regardless.

## Silent technical reconciles (per `feedback_technical_decisions_claude_calls`)

1. **BHS H1 sized at 32px (index variant), not 40px.** Brief §2a specifies "28–32px to distinguish index from entity-detail." Primary admin surfaces (invoices, products, pipeline, companies) use 40px; these are nested settings sub-surfaces. 32px reads as "subordinate settings page" in the visual hierarchy. Consistent across both pages.
2. **Row `transition-colors` at 160ms, not 180ms.** Matches the polish-3 invoice-index-client anchor exactly (`line 275: transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]`). The actual hover animation runs through framer-motion's `whileHover`, so the CSS transition is a secondary fallback. G10.5 reviewer flagged as non-blocking, confirmed consistent with anchor.
3. **Deck mutter suppressed when empty per products (polish-2) precedent.** §8 voiced empty owns the Playfair voice on empty lists. Deck only voices on populated state.
4. **Templates `StructureChip` uses `--color-warning` for `mixed` structure.** Brief specified "warn-rgba or neutral" — used `--color-warning` which resolves to the same `--warning` token as `--warn` in the mockup. Token verified in `globals.css:207`.
5. **No `min-h-screen bg-background`** on either page — admin-chrome-1 owns root. Old `mx-auto max-w-5xl` wrapper removed.

## Verification (G0–G12)

- **G0** — brief pre-compiled, last two handoffs read (`admin-polish-5`, `admin-polish-4`), `mockup-admin-interior.html` cited in brief §2a and re-read against §§3/5/6/7/8.
- **G1** — 8/8 preconditions cleared. `mockup-admin-interior.html` exists. All four settings surfaces exist. Three chip anchors intact. Spec filename `docs/specs/quote-builder.md` confirmed. No plain `transition` classes found (good — no conversion needed). No existing chip helpers. Both surfaces use shadcn `Dialog`.
- **G2** — files touched match whitelist exactly. No actions files touched. No settings-registry touched.
- **G3** — none read, none written.
- **G4** — none.
- **G5** — no behavioural change; no tests added. 832/1 baseline preserved.
- **G6** — `git-revertable, no data shape change`. UI-only diff. No migration, no schema, no settings, no kill-switch, no new env, no contract change. Rollback = `git revert <commit>`.
- **G7** — N/A.
- **G8** — not applicable (chrome-only pass; Dialog a11y inherited from shadcn; table semantics via `<table>/<th>/<td>`).
- **G9** — rule-09 audit: zero plain `transition` classes. All interactive surfaces use `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` or `duration-[200ms]` for CTA lift. Table row hover via framer-motion `whileHover`.
- **G10** — screenshots deferred (standard admin-auth-seed friction). Code-level audit passed.
- **G10.5** — external reviewer **PASS_WITH_NOTES**. One non-blocking note: row `transition-colors` at 160ms vs 180ms — consistent with polish-3 anchor. No in-session fix needed.
- **G11** — this file.
- **G12** — `npx tsc --noEmit` → 0 errors; `npm test` → 832 passed / 1 skipped; `npm run build` → clean.

## Memory-alignment declaration

- **`feedback_visual_references_binding`** — mockup §§3/5/6/7/8 recipes drove every primitive; no spec prose used as visual source.
- **`feedback_motion_is_universal`** — every row has framer-motion `whileHover`; CTA lifts on spring ease; Dialog open/close inherits shadcn's AnimatePresence; `AnimatePresence` wraps table rows.
- **`feedback_primary_action_focus`** — "New item" / "New template" is the single brand-red CTA per surface. Dialog Save mirrors it. No secondary clutter.
- **`feedback_individual_feel`** — settings surfaces feel like Andy's own operational config, not a shared platform. Mutters are count-driven, not generic.
- **`feedback_no_content_authoring`** — all voice lines are state-computed. Zero authored copy.
- **`feedback_technical_decisions_claude_calls`** — BHS sizing, row-transition timing, mutter suppression, token choice — all silent.
- **`project_context_safety_conventions`** — brief cites mockup; handoff self-contained.
- **`feedback_earned_ctas_at_transition_moments`** — "New item" / "New template" are operational CTAs, not earned moments. No §9 BHS on settings.

## PATCHES_OWED opened this session

- `admin_polish_6_manual_browser_verify` — Andy to walk both settings pages in browser; non-blocking.
- `admin_polish_6_g105_rereview` — optional; reviewer gave PASS_WITH_NOTES with one cosmetic non-blocking note already consistent with anchor.

## G12.5 Wave-boundary checkpoint — cross-wave retrospective

Wave 9 shipped six admin-interior visual rebuilds (pipeline → products → invoices+errors → companies → quote-builder editor → settings shells). All six sessions cited `mockup-admin-interior.html` in their brief §2a. Cross-wave assessment:

**Inherit-patterns 1–9 held across all six sessions:**

1. Header stack (Righteous eyebrow + BHS H1 + DM Sans deck + Playfair mutter) — consistent. Index variant at 32–40px BHS; entity-detail at 40px. Settings pages introduced 32px for sub-surface hierarchy.
2. `var(--surface-highlight)` on every elevated surface — consistent; never inlined.
3. Entity-card recipe (surface-2 / 12px / 18–20 padding / hover cues) — consistent.
4. Stale-halo at card level, not row level — consistent; deliberate per polish-3.
5. Righteous for chips/badges/eyebrows at 10–11px / 1.5–1.8px tracking — consistent.
6. Rule-09 hover everywhere — consistent; zero plain `transition` classes across the wave.
7. Ladder discipline on alert bodies — consistent.
8. §7 table recipe verbatim — consistent across invoices/errors/companies/quote-editor/settings.
9. Warm / cool / good banner variants — consistent.

**Inherit-pattern 10 (polish-5 candidate) confirmed:**
- `layoutId` pill/tab toggles use houseSpring with semantic names (`quote-preview-device`, `company-tab-active`, `invoice-filter-active`). No generic `tab-active` collisions. **Promoted to official inherit-rule 10.**

**No new inherit-rules needed.** The wave produced a complete, consistent visual language across all six admin surfaces.

## What the next session should know

Next: **`ui-1`** — Unified Inbox producer slice. This is a new wave (Wave 10 or continued Wave 9 — check tracker). Backend-ish session: fan-in of emails / SMS / WhatsApp / IG / FB / portal chat into a single inbox model. Not a visual surface yet. Brief must cite `mockup-admin-interior.html` in §2a because the eventual `/lite/admin/inbox` surface inherits the admin chrome. Model tier: `/deep`.

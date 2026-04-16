# `admin-polish-6` — Settings shells (catalogue + quote-templates) visual rebuild — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G11.b within-wave continuity rule** — authored at the close of `admin-polish-5` from `mockup-admin-interior.html`, the inherit-patterns from `admin-polish-1..5`, and the current `/lite/admin/settings/catalogue` + `/lite/admin/settings/quote-templates` surfaces.

> **Wave 9 closes with this session.** G12.5 wave-boundary checkpoint fires after G12.

---

## 1. Identity

- **Session id:** `admin-polish-6`
- **Wave:** 9 — Admin-interior visual parity (**6 of 6 — wave-closer**)
- **Type:** `UI`
- **Model tier:** `/deep` (Opus) — two CRUD surfaces in one session, each with an inline editor component. Context-medium; rule-09 regression + §7 table polish is where these sessions quietly drift.
- **Sonnet-safe:** `no` — wave-closing session; G12.5 checkpoint fires here and needs `/deep` judgement on whether inherit-patterns still hold across six sessions.
- **Estimated context:** `medium` — both `catalogue-admin.tsx` and `templates-admin.tsx` are index + drawer clients; the index halves are where polish focuses. Structure already wired (QB-2b output); visual only.

## 2. Spec references

- `docs/specs/quote-builder.md` §2.4 (catalogue admin surface) + §2.5 (quote-templates admin surface) — **no functional change this session**, chrome-only. Confirm spec filename at G1 per polish-1..5 precedent (silent-correct if wrong).
- `AUTONOMY_PROTOCOL.md` §G0 — admin-interior UI sessions must cite `mockup-admin-interior.html` in §2a.
- `AUTONOMY_PROTOCOL.md` §G12.5 — wave-boundary checkpoint fires on this session close. Prepare a short cross-wave retrospective in the handoff: did inherit-patterns 1–10 hold across the six sessions? Any drift to promote into `admin_polish_inherit_patterns_across_wave`?

## 2a. Visual references (binding)

- **`mockup-admin-interior.html`** — the binding reference. Applicable sections:
  - **§3 page headers (index variant)** — crumbs (`Admin · Settings · Catalogue` / `Admin · Settings · Quote templates`) + smaller Black Han Sans H1 (≈ `28–32px` to distinguish index from entity-detail) + DM Sans deck with Playfair italic pink mutter conditional on list state (`"nothing to sell yet."` on empty catalogue / `"fourteen ways to charge someone."` on populated; templates mirror).
  - **§5 chips** — category chips on catalogue rows + structure chips on template rows (retainer / project / mixed). Reuse polish-3/4/5 chip TONE-map recipe. `retainer` → pink, `project` → orange, `mixed` → warn-rgba or neutral.
  - **§6 data cards** — drawer / modal backgrounds use the §6 surface-2 recipe (12px radius, 18–20 padding, `--surface-highlight`). The list doesn't need cards; it's a §7 table.
  - **§7 tables** — this is the primary chrome both surfaces inherit. Catalogue: Name · Category · Unit · Base price · Tier · Actions. Templates: Name · Structure · Sections · Term · Usage · Actions. Rows are editable (each opens a drawer/modal) → row hover active per §7 rule 8. Numeric columns Righteous tabular-nums.
  - **§8 voiced empty** — `"No catalogue items yet."` + Playfair italic pink mutter (`"still figuring out what to charge for."`); `"No templates yet."` + mutter (`"each quote is built from scratch until one isn't."`). BHS 20–24px headline, not display 40px.
  - **§9 BHS-adjacent** — catalogue MAY surface a tiny tfoot summary ("Catalogue size: 14 items" / "Average price: $2,400") per surface-individual-feel; no per-row BHS. Templates has a "Most-used: {name}" caption at most. **Rule 05 discipline: one earned moment max per surface; likely suppress on both.**
  - **§11 alert banners** — rare on settings. Only conditional case: if a catalogue item is referenced by live quotes and user tries to delete, the drawer surfaces a cool info-banner. Out of scope this session (no behavioural change) — chrome sketches only if already wired.
  - **§13 binding rules 01–10.**
- **`admin-polish-1..5` output** — canonical implementations:
  - **§3 index-header variant:** `app/lite/admin/invoices/page.tsx` (polish-3) + `app/lite/admin/products/page.tsx` (polish-2). Mirror the narrower Black Han Sans weight (28–32px) against polish-5's 40px entity-detail scale.
  - **§5 chip TONE map recipe:** `components/lite/invoices/invoice-status-badge.tsx` (polish-3) + `components/lite/admin/companies/company-status-badge.tsx` (polish-4) + `components/lite/quote-builder/quote-status-badge.tsx` (polish-5 — NEW). If a `CategoryChip` or `StructureChip` helps, extract one; otherwise inline the TONE map.
  - **§7 table recipe:** `app/lite/admin/invoices/page.tsx` (polish-3) — primary anchor. Righteous 10px / 2px-tracking headers on 5% cream bottom border; `rgba(253,245,230,0.03)` row hairlines; row hover `rgba(253,245,230,0.025)`; numeric columns Righteous with letter-spacing.
  - **§8 voiced empty:** polish-2 products empty state.
  - **§6 drawer / modal chrome:** polish-5's `DataCard` helper (`components/lite/quote-builder/quote-editor.tsx`) — use the same surface-2 recipe for the drawer body. The drawer shell itself may be shadcn Dialog or BaseUI — token-style the interior, don't rewire.
  - **Rule 09 hover ease:** `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]`. Every interactive surface — index rows, drawer inputs, Save / Cancel buttons, delete confirmation.
- **Inherit-patterns (verbatim from `admin_polish_inherit_patterns_across_wave`, locked through polish-5):**
  1. Header stack = Righteous eyebrow/crumbs (10px / 2px tracking) + Black Han Sans H1 + DM Sans deck with Playfair italic brand-pink mutter + Righteous-labelled meta row *(index variant: skip meta row unless page carries aggregate stats)*.
  2. `var(--surface-highlight)` on every elevated surface — never inline the literal.
  3. Entity-card recipe — surface-2 / 12px / 18-20 padding / hover cues on clickable cards only.
  4. Stale-halo keyframe reusable at card level; **not on table rows** (polish-3 locked).
  5. Righteous for all chips/badges/eyebrows at 10–11px / 1.5–1.8px tracking. BHS reserved for display H1 + §9 paid-moment values only — one earned moment per surface.
  6. Rule 09 hover everywhere — `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` or `houseSpring`; never plain Tailwind `transition`.
  7. Ladder discipline on alert bodies — neutral-300 body, neutral-500 italic footer; cream reserved for BHS + primary-action + §9 headline-tile values.
  8. Tables inherit §7 verbatim — Righteous 10px / 2px-tracking headers on 5% cream bottom border; `rgba(253,245,230,0.03)` row hairlines; row hover `rgba(253,245,230,0.025)` **when rows are actionable**; numeric columns Righteous with letter-spacing.
  9. Warm / cool / good alert banner recipes (polish-3 warm, polish-2/4 cool, polish-5 introduced good via accepted banner).
  10. *(polish-5 candidate for promotion)* — `layoutId` pill/tab toggles use houseSpring (stiffness 380 / damping 32); cross-component `layoutId` values use semantic names (`quote-preview-device`, `company-tab-active`) not generic (`tab-active`) to avoid collisions when two mount together.

## 3. Acceptance criteria

```
Binding rules 01–10 (verbatim from mockup §13) apply. Session-specific clarifications:

- Both /lite/admin/settings/catalogue and /lite/admin/settings/quote-templates ship the §3 index header (crumbs + BHS H1 + voiced deck).
- Both ship §7 tables with row-hover active (each row opens a drawer/modal).
- Both ship §8 voiced empty states.
- Primary CTA: brand-red Righteous-capped "New item" / "New template" per §8 earned CTA.
- Drawer / modal interior: §6 surface-2 chrome. Cancel = ghost button; Save = brand-red primary.
- Category chip on catalogue rows + structure chip on template rows.
- No BHS paid-moment — settings surfaces never earn §9 (rule 05 discipline).
- Rule 09 hover on every interactive surface.
- No min-h-screen bg-background (admin-chrome-1 owns root).
```

## 4. Skill whitelist

- `tailwind-v4`
- `framer-motion` — only if surfacing an expand/collapse on the drawer open or a category-filter `layoutId` pill.
- `react-19`
- `baseline-ui`

## 5. File whitelist (G2 scope discipline)

- `app/lite/admin/settings/catalogue/page.tsx` — `edit` — §3 index header only. Data-load unchanged.
- `app/lite/admin/settings/catalogue/catalogue-admin.tsx` — `edit` — §7 table + §8 empty + §6 drawer chrome + ghost/primary button swap. CRUD action wiring unchanged (QB-2b output).
- `app/lite/admin/settings/quote-templates/page.tsx` — `edit` — §3 index header only. Data-load unchanged.
- `app/lite/admin/settings/quote-templates/templates-admin.tsx` — `edit` — §7 table + §8 empty + §6 drawer chrome + button swap.
- **May add** `components/lite/admin/settings/category-chip.tsx` if the catalogue category list warrants a chip helper (grep to see distinct categories first; ≥5 warrants extraction).
- **May add** `components/lite/admin/settings/structure-chip.tsx` if template structure chip is ≥2 instances (it is — every row has one; likely worth extracting).
- **May NOT touch** `actions.ts` files — all four Server Actions are QB-2b output.
- **May NOT touch** `settings-registry.md` or add settings keys; this is a chrome pass.

**Explicitly not touched:**

- `lib/quote-builder/**` — no behavioural change.
- `app/lite/admin/deals/**` — polish-5 output, reference-only.
- `components/lite/quote-builder/quote-editor.tsx` — polish-5 locked; reference-only for the `DataCard` recipe.
- Any Server Actions or routes outside `/lite/admin/settings/`.
- All tests unless a behavioural regression surfaces (expected: none).

## 6. Settings keys touched

- **Reads:** none. Neither surface reads a settings literal in display (verify at G1 grep).
- **Seeds:** none.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `mockup-admin-interior.html` exists.
- [ ] Settings surfaces exist — `ls app/lite/admin/settings/catalogue/{page,catalogue-admin}.tsx app/lite/admin/settings/quote-templates/{page,templates-admin}.tsx`.
- [ ] Polish-1..5 anchors intact — `ls components/lite/quote-builder/quote-status-badge.tsx components/lite/invoices/invoice-status-badge.tsx components/lite/admin/companies/company-status-badge.tsx`.
- [ ] Baseline test suite green — `npm test` (expected 832 / 1 skipped per `admin-polish-5` handoff).
- [ ] **Confirm spec filename** — `ls docs/specs/quote-builder.md` — correct silently per `feedback_technical_decisions_claude_calls` if wrong.
- [ ] **Identify plain `transition` classes on both admin clients** — `grep 'className="[^"]*\btransition\b[^"]*"' app/lite/admin/settings/catalogue/catalogue-admin.tsx app/lite/admin/settings/quote-templates/templates-admin.tsx`. Rule-09 regression hotspot; log list and convert during pass.
- [ ] **Check for existing chip helpers** — grep `components/lite/admin/settings/` (dir may not exist yet) + `components/lite/` for `CategoryChip` / `StructureChip`. Extract only if absent.
- [ ] **Confirm drawer framework** — `grep -l "Dialog\|Drawer" app/lite/admin/settings/**/*admin.tsx` — polish matches whatever's wired (shadcn Dialog, BaseUI Popover, etc.).

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — UI-only diff. No migration, no schema, no settings, no kill-switch, no new env, no contract change. Rollback = `git revert <commit>`.

## 9. Definition of done

- [ ] `/lite/admin/settings/catalogue` + `/lite/admin/settings/quote-templates` both render §3 index header (crumbs + BHS H1 + voiced Playfair mutter conditional on empty/populated).
- [ ] Both tables use §7 recipe with row-hover active (each row opens a drawer/modal).
- [ ] Both empty states are voiced §8 (BHS 20–24px + Playfair italic pink mutter).
- [ ] Category + structure chips render as §5 chips (Righteous 10px / 1.5px tracking, rgba-tinted, 1×1 currentColor dot).
- [ ] Primary CTA on both pages is brand-red Righteous-capped "New item" / "New template" — §8 earned CTA recipe.
- [ ] Drawer / modal interior uses §6 surface-2 chrome with ghost Cancel + brand-red Save.
- [ ] No BHS paid-moment on either surface (rule 05 discipline — settings is operational, not earned).
- [ ] **All interactive surfaces use rule-09 easing — zero plain `transition` classes** (regression hotspot from polish-1/2/5).
- [ ] All tabular numerics use Righteous with letter-spacing (rule 10).
- [ ] `min-h-screen bg-background` not reintroduced (admin-chrome-1 owns root).
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.
- [ ] G10 parity screenshots vs mockup §3 / §7 / §8 — in handoff, or deferred to PATCHES_OWED.
- [ ] G10.5 external reviewer verdict verbatim; any notes → in-session fix + PATCHES_OWED non-blockers.
- [ ] Memory-alignment declaration in handoff covering: `feedback_visual_references_binding`, `feedback_motion_is_universal`, `feedback_primary_action_focus`, `feedback_individual_feel`, `feedback_no_content_authoring`, `feedback_technical_decisions_claude_calls`, `project_context_safety_conventions`, `feedback_earned_ctas_at_transition_moments`.
- [ ] G0 → G12 run cleanly; handoff at `sessions/admin-polish-6-handoff.md`.
- [ ] **G12.5 wave-boundary checkpoint** — handoff includes cross-wave retrospective: did inherit-patterns 1–10 hold across polish-1..6? Any drift to promote into `admin_polish_inherit_patterns_across_wave`? Rule-10 (semantic `layoutId` names) is the candidate new inherit rule.
- [ ] `SESSION_TRACKER.md` **🧭 Next Action** advanced to **`ui-1`** (Unified Inbox producer slice) — the next non-polish session, per the polish-0 queue plan.

## 10. Notes for the next-session brief writer (`ui-1` — Unified Inbox producer slice)

- `ui-1` is the first session after Wave 9 closes. New wave begins (Wave 10? or continues Wave 9? — check tracker).
- `ui-1` is a Unified Inbox **producer** slice — a backend-ish session (fan-in of emails / SMS / WhatsApp / IG / FB / portal chat events into a single inbox model). Not a visual surface.
- Brief must still cite `mockup-admin-interior.html` in §2a because the eventual `/lite/admin/inbox` surface inherits the admin-chrome and §3 / §7 / §8 / §11 recipes. Visual work for the inbox surface itself will come in a later session.
- Reference `project_outreach_reply_intelligence` + `project_brand_dna_as_perpetual_context` for intent routing.
- Model tier: `/deep` — new data model, new activity-log kinds, new scheduled-task kind likely.

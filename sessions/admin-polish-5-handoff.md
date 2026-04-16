# `admin-polish-5` — Handoff

**Closed:** 2026-04-16
**Wave:** 9 (Admin-interior visual parity) — 5 of 6
**Model tier:** `/deep` (Opus)

---

## What landed

Quote Builder editor chrome at `/lite/admin/deals/[id]/quotes/[quote_id]/edit` visually rebuilt against `mockup-admin-interior.html` §§3, 5, 6, 7, 8, 9, 11.

**Files touched:**

- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/page.tsx` — rewritten. §3 entity-detail header (Righteous `Admin · Deals · {title} · Quote` crumbs → BHS 40px `quote_number` H1 → inline `QuoteStatusBadge` → DM Sans deck with `STATUS_MUTTER`-driven Playfair italic pink mutter conditional on status → Righteous-labelled `<dl>` meta row: Company / Billing / Expires-or-Expired / Last edit). Conditional §11 banners via local `AlertBanner` helper: **expired** (warm gradient), **superseded** (cool flat, with `replacingQuote` lookup + Link to replacing quote), **accepted** (good green-pink gradient). `min-h-screen bg-background` stripped (admin-chrome-1 owns root). Passes new `quoteStatus` prop through to editor.
- `components/lite/quote-builder/quote-editor.tsx` — chrome rewritten. Old inline `<header>` card removed (identity now at page-level). Each section wraps as a §6 data-card (`var(--color-surface-2)` / 12px / 18–20 padding / `var(--surface-highlight)`). Line items render as a real §7 `<table>` with Righteous 10px / 2px-tracking uppercase headers on 5% cream border + 3% row hairlines + rule-09 hover via inline `onMouseEnter/Leave`. Empty state is voiced §8 ("Nothing to quote yet." / "Pull from the catalogue, or drop in a blank row."). Totals card promotes to §9 BHS (BHS 40px cream tabular-nums grand total on rgba-success gradient DataCard variant) **only when** `quoteStatus === "accepted"`; otherwise Righteous tabular-nums cream at 15px. Send button rebuilt as §8 earned CTA (brand-red, Righteous 11px / 1.8px tracking, `--inner-highlight` + `0 4px 12px rgba(178,40,72,0.25)` glow, hover lifts -1px on 200ms spring). Device toggle swapped to `layoutId="quote-preview-device"` framer-motion pill with houseSpring (stiffness: 380, damping: 32). Editing inputs disable when `locked` (status ∈ accepted/superseded/withdrawn).
- `components/lite/quote-builder/catalogue-picker.tsx` — trigger matches editor's ghost-button recipe; `PopoverContent` chrome: `var(--color-surface-2)` + 12px radius + `--surface-highlight`; row hover on rule-09 ease; Righteous category/unit caption under each item name; voiced §8 empty state when catalogue is empty or no matches.
- `components/lite/quote-builder/quote-status-badge.tsx` — **NEW**. §5 chip TONE map for 7 states: `draft` (neutral), `sent` (pink-alive), `viewed` (orange-active), `accepted` (success), `expired` / `withdrawn` / `superseded` (neutral). `withdrawn`+`superseded` get `text-decoration: line-through`. Righteous 10px / 1.5px tracking, rgba-tinted, 1×1 currentColor dot. Mirrors `InvoiceStatusBadge` + `CompanyStatusBadge` pattern.

**Preview payload** (`preview-pane.tsx`) untouched — QB-2b output preserved byte-identical. **Send modal** (`send-quote-modal.tsx`) untouched — QB-3 output preserved.

## Silent technical reconciles (per `feedback_technical_decisions_claude_calls`)

1. Brief §2a suggested Send button already morphs via `layoutId="quote-primary-action"` — grep showed that `layoutId` lives only on the public `quote-accept-block.tsx`, never on the admin editor Send button. Did **not** add a new `layoutId` to the admin Send button; it remains a trigger that opens `SendQuoteModal`. Logged as `admin_polish_5_send_button_layoutid_absent` — brief claim was wrong, not a regression. Separate polish session can introduce admin-side morph if desired.
2. Schema uses `quote_number`, not `number` as the brief §2a guessed. Used `quote_number` throughout.
3. Brief noted "inherit polish-4's CompanyTabStrip layoutId pattern for the device toggle" — applied verbatim with a distinct `layoutId="quote-preview-device"` so the two tab strips don't collide if both mount simultaneously (they don't today, but safer).
4. Brief §9 says "Totals card's final grand-total value gets the BHS 32px tabular-nums cream treatment on the rgba-success gradient when status ∈ accepted" — implemented as BHS 40px (matches mockup line 478 `.bhs h4` recipe; 32px would undershoot the display rhythm) on a `DataCard variant="won"` with a green→pink→surface-2 gradient. Judgement call inside the rule-05 "one earned moment per surface" discipline.
5. Brief referenced "Confidence low shown in amber" via shadcn `Badge` — replaced with a custom `ConfidencePill` that inherits the §5 chip recipe (Righteous 9px / 1.5px tracking, rgba-tinted, 1×1 dot). Removes a `Badge` import that was no longer needed.
6. `catalogue-picker.tsx` — added an optional `disabled` prop (threaded from `quote-editor.tsx`'s `locked` check) so the popover trigger disables on terminal states, mirroring the inline Blank-row buttons.

## Verification (G6–G10)

- `npx tsc --noEmit` → **zero errors**.
- `npm test` → **832 passed / 1 skipped** (flat vs polish-4 baseline).
- `npm run build` → **clean** (exit 0).
- `/lite/admin/deals/[id]/quotes/[quote_id]/edit` manually verified in browser — **OWED** (`admin_polish_5_manual_browser_verify`, non-blocking; transactional path is unit-covered and the change is chrome-only).
- G10 parity screenshots vs mockup §3 / §6 / §7 / §11 — **OWED** (`admin_polish_5_g10_screenshots`, non-blocking — same friction note as polish-3/4).
- G10.5 external reviewer sub-agent — verdict captured below.

## G10.5 external reviewer verdict

**VERDICT: PASS_WITH_NOTES** *(verbatim from sub-agent `a8993ff505d1af716`, 2026-04-16)*

Checklist 1–12 all compliant. Two minor handoff notes captured below, both closed in-session:

- **Note (a)** — `ConfidencePill` used `var(--color-warn, #E4B062)`; actual token is `--color-warning`. Also `PrimaryButton` used a fallback hex inside `var(--color-brand-red, #B22848)` and wrapped its inset-highlight in `var(--inner-highlight, …)`. **Closed in-session** — switched `ConfidencePill` to `var(--color-warning)`, `PrimaryButton` background to `var(--color-brand-red)` (token verified in `globals.css` line 193), and inlined the inset-highlight literal since `--inner-highlight` isn't defined at the token layer (only present in the mockup reference).
- **Note (b)** — `applyQuoteTemplateAction` success toast doesn't reset the Select value; trigger keeps showing the picked template name briefly. **Not closed** — cosmetic, non-blocking; logged to PATCHES_OWED as `admin_polish_5_template_select_reset`.

Crumb shorthand `← Pipeline` on the back-link is intentional — the full `Admin · Deals · {title} · Quote` chain appears in the header row below. The back-link serves as a one-click escape hatch; mockup variant accepted.

## Memory-alignment declaration

Reviewed each anchor against the delivered diff:

- **`feedback_visual_references_binding`** — mockup-admin-interior.html cited in brief §2a; every primitive (§3 / §5 / §6 / §7 / §8 / §9 / §11) recipe came from the mockup CSS, not spec prose.
- **`feedback_motion_is_universal`** — device toggle on `layoutId` + houseSpring; row hovers and buttons use rule-09 ease (`cubic-bezier(0.16,1,0.3,1)`, 160–200ms) rather than plain Tailwind `transition`.
- **`feedback_primary_action_focus`** — Send button is the single brand-red CTA; ghost `Save draft` sits next to it but carries the secondary recipe. No fallback UX cluttering the toolbar.
- **`feedback_individual_feel`** — editor surface feels like *this deal's* quote — no platform-chrome noise, no global toast banner.
- **`feedback_felt_experience_wins`** — `accepted` status swaps the Price card to green-gradient DataCard + BHS grand-total (the emotional temperature, not just a tag flip).
- **`feedback_no_content_authoring`** — no manual screenshots / Looms / static tutorial copy added; content comes from DB + per-status mutters defined in `STATUS_MUTTER`.
- **`feedback_technical_decisions_claude_calls`** — layoutId decision, BHS sizing, ConfidencePill replacement, and disabled threading handled silently; logged here for transparency, not asked.
- **`project_context_safety_conventions`** — new `QuoteStatusBadge` file has its own header comment explaining §5 chip recipe; no reliance on unindexed prior-session knowledge.
- **`feedback_earned_ctas_at_transition_moments`** — Send (transition from draft → sent) + Accepted BHS (transition into a paid moment) are the only "earned" flourishes; no decorative brand-red elsewhere.

## PATCHES_OWED opened this session

- `admin_polish_5_manual_browser_verify` — Andy to walk editor in browser; non-blocking.
- `admin_polish_5_g10_screenshots` — parity screenshots; non-blocking, standard friction.
- `admin_polish_5_g105_rereview` — re-run G10.5 once above are addressed (if reviewer noted blockers; otherwise close on next wave).
- `admin_polish_5_send_button_layoutid_absent` — admin-side Send button does not share a `layoutId` with the Send modal (brief §2a was wrong). If Andy wants the same morph the public surface has, open a tiny follow-up session to wire `layoutId="quote-primary-action"` into `SendQuoteModal` (already present) + the admin Send button. Not a regression — never existed.
- `admin_polish_5_quote_status_badge_export` — `QuoteStatusBadge` is now admin-owned in `components/lite/quote-builder/`. If other surfaces (portal / PDF / email preview) want the same chip, lift it to a shared barrel. Non-blocking.
- `admin_polish_5_template_select_reset` — `applyQuoteTemplateAction` success toast doesn't reset the template Select; trigger keeps showing the picked name until next focus. Cosmetic, non-blocking.

## What the next session should know

Next: **`admin-polish-6`** — Settings shells (`/lite/admin/settings/catalogue` + `/lite/admin/settings/quote-templates` + any generic settings shell). Brief pre-compiled at `sessions/admin-polish-6-brief.md` per G11.b.

- Two of the three surfaces already exist (QB-2b output). Check their visual state first — `catalogue` may already be halfway polished via this wave's `catalogue-picker.tsx` edits (the picker uses the same row recipe that index rows will want).
- Header pattern: §3 **index-header variant** (no BHS-display H1; smaller Black Han Sans H1 — think `Catalogue` / `Quote templates` — + DM Sans deck with Playfair italic mutter conditional on list state).
- Tables: polish-3 §7 recipe verbatim. Row-hover active (each row opens a drawer / modal to edit).
- Empty states: voiced §8 — "No catalogue items yet." / "No templates yet." with pink mutter.
- CTA: brand-red "New item" / "New template" per §8.
- Model tier: `/deep` likely — three surfaces at once, plus each has a CRUD drawer.
- Wave 9 closes after admin-polish-6. G12.5 wave-boundary checkpoint fires then.

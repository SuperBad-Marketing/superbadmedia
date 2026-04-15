# `admin-polish-2` — Handoff

**Wave:** 9 — Admin-interior visual parity (2 of 6)
**Model tier:** `/deep` (Opus)
**Closed:** 2026-04-16
**Type:** UI · visual rebuild against `mockup-admin-interior.html`

---

## What landed

- **`app/lite/admin/products/page.tsx`** full rewrite — header stack per inherit-pattern 1 (Righteous eyebrow `Admin · Products` 10px / 2px tracking → Black Han Sans H1 `Products` 40px / -0.4px → DM Sans deck with conditional Playfair brand-pink mutter voiced on product state: `"the machine's humming."` when `activeCount > 0` else `"still heating up."`; mutter suppressed on empty state per rule 07 so the empty block can own the Playfair instead → neutral meta row `{count} product(s) · SaaS catalogue · incl. archived?`). "New product" CTA = brand-red primary with `--surface-highlight` + red glow (`0 6px 20px -10px rgba(178,40,72,0.6)`), Righteous 11px / 1.8px tracking, rule-09 compliant `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` hover. Archived toggle is a Righteous 10px / 1.8px link with house-spring hover ease. Product tiles = §6 `.data-card` recipe (surface-2 / 12px / 18/20 padding / `--surface-highlight` / pink-18% hover border / `-translate-y-px` lift): DM Sans 16 / 500 / cream name, neutral-500 description line, StatusChip (§5 palette: active = success rgba + `--color-success`; draft = pink rgba + `--color-brand-pink`; archived = neutral rgba + neutral-500), 3-col MetricCell grid (Subscribers / MRR / Tiers — Righteous 14px tabular-nums values, 9px 1.5px tracking labels per rule 02), tier-rank progress dots (pink 45% on 6px pill; dashed "No tiers yet" muted affordance when `tierCount === 0`). Voiced empty (rule 08) — Black Han Sans `No products yet.` + Playfair mutter `"the popcorn machine's cold."` + brand-red "New product" CTA with rule-09 hover ease.
- **`app/lite/admin/products/[id]/page.tsx`** full rewrite — entity-detail header stack (Righteous eyebrow `Admin · Products · {row.name}` → BHS H1 + `StatusPillClient` + DM Sans deck with status-keyed mutter via `muttersByStatus()`: `"the machine's running."` (active) / `"benched, not deleted."` (archived) / `"still heating up."` (draft); optional neutral-500 description below deck; Righteous-labelled `dl` meta row for slug (mono), Created (date), Stripe (mono link to `dashboard.stripe.com/test/products/{id}` with house-spring hover ease). Archived status = §11 cool alert recipe (`rgba(15,15,14,0.45)` bg + `rgba(253,245,230,0.05)` border, `role="status"`, Righteous 10px / 1.5px eyebrow `Archived · product state`, neutral-300 body copy, neutral-500 italic footer — polish-1 cream-vs-ladder precedent respected). HeadlineStrip rendered `scoped` when `saas_headlines_enabled`. Dimensions section — Righteous 11px / 1.8px section header, mini data-cards (DM Sans cream display_name + mono 11px neutral-500 dimension_key), dashed muted voiced-empty `Nothing metered. Nothing gated.` Tiers section — 3-col cards on lg using §6 recipe: tier name + Righteous `Rank N` subhead; price block = Righteous 10px `AUD` prefix + BHS 28px `tabular-nums` integer with neutral-300 fractional tail (via `formatMoneyParts()`) + DM Sans `/ mo inc. GST` suffix; Righteous 10px / 1.5px Setup line; Limits sub-block with Righteous tabular `∞` or `N` per dimension; Feature-flag chips = Righteous 10px / 1.5px pill pair (on = success rgba + `--color-success`; off = neutral rgba + neutral-500 + `line-through`); Stripe Prices foot block with Righteous 10px / 1.5px eyebrow + `PriceRow` rows (monthly / annual monthly / annual upfront) with mono ids or em-dashes.
- **`app/lite/admin/products/[id]/clients/status-pill-client.tsx`** rewritten as Righteous chip — `TONE` map (active / draft / archived) over rgba backgrounds + brand-coloured `color`; framer-motion `layout` + `houseSpring` preserved for status transitions; 10px Righteous / 1.5px tracking; 1×1 `currentColor` dot at opacity 0.85. Single client component, drop-in for detail page.
- **`app/lite/admin/products/[id]/clients/archive-button-client.tsx`** chrome polished — trigger button = ghost recipe (neutral-600/60 border, transparent bg, Righteous 11px / 1.5px tracking, rule-09 `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` hover, cream on hover via `rgba(253,245,230,0.04)` fill). Modal backdrop `rgba(15,15,14,0.8)` with 0.15s opacity fade; modal panel = surface-2 + `--surface-highlight` + drop shadow, BHS 22px title, neutral-300 body, brand-red rgba error alert on submit fail. Cancel button = Righteous muted ghost with rule-09 ease; Confirm = brand-red primary with `--surface-highlight` + red ring (`0 0 0 1px rgba(178,40,72,0.35)`), rule-09 ease, disabled at 50% during `useTransition` pending.
- **`components/lite/saas-admin/headline-strip.tsx`** audit rebuild — `Tile` now: surface-2 + `--surface-highlight`, rounded-[12px], Righteous 10px / 1.5px tracking label (tone-coloured: `--color-brand-orange` for warn, `--color-warning` for watch, neutral-500 otherwise), BHS 28px tabular-nums value (colored via `deltaToneColor()` for MRR delta tile — `--color-success` for positive, `--color-brand-pink` for negative). Warn tone = §11 warm alert recipe (`linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))` + `1px solid rgba(178,40,72,0.25)`); watch tone = warning rgba. Rule 10 (Righteous on all tabular numerics) now clean — no DM Sans on numbers anywhere. Section retains fade-in on mount per `houseSpring` + `feedback_motion_is_universal`.

## What didn't land

- **`/lite/admin/products/[id]/clients/page.tsx` rebuild (brief §5 table + §8 voiced empty).** Route does not exist — `clients/` is a component directory holding the two client-component helpers above. Dropped from this session's scope at Andy's direction ("polish sessions don't grow new routes") after 60-second verification grep confirmed no subscribers-per-product admin surface exists anywhere in `app/lite/admin/**`. Candidate future session `subscribers_per_product_admin_surface` logged to PATCHES_OWED; brief reroute `admin_polish_2_brief_clients_route_miss` logged alongside.
- **`min-h-screen bg-background` sweep from `admin-chrome-1` deferred nit.** `app/lite/admin/products/**` pages don't use that pattern (they're under `AdminShellWithNav` already), so there was nothing to sweep on this session's scope. The nit persists on other admin pages outside this brief's whitelist and should be cleared wherever it shows up.
- **Manual browser parity screenshots.** Deferred to PATCHES_OWED `admin_polish_2_manual_browser_verify` — same admin-auth-seed friction as prior polish sessions.

## Key decisions (silent calls per `feedback_technical_decisions_claude_calls`)

- **HeadlineStrip tile value tone is loud-on-MRR-delta only, not on every metric.** Rule 05 (BHS proliferation) — if every tile had coloured values it would read as alarm, not signal. Colour lives on the metric where the sign actually means something (positive vs. negative MRR movement); everything else = brand-cream. Past-due and near-cap carry their weight through warn/watch tone on the tile chrome, not a second colour on the number.
- **StatusPill on detail page = Righteous chip, not BHS.** Same rule-02 discipline as polish-1's `WonBadge` swap. 10px chip in BHS would be illegible and proliferate the BHS moment.
- **Detail page mutter is status-keyed, not stale-count-keyed.** Pipeline's stale-count mutter worked because the deck is operator-facing ("momentum's your job"); products detail is surface-state-facing, so the mutter voices the product's own state. Rule 07 one-mutter-per-surface honoured — description line below is not another Playfair moment.
- **Empty-state voice wins the index mutter.** When `products.length === 0`, the header deck mutter is suppressed and the `EmptyProducts` block owns the one Playfair line (`"the popcorn machine's cold."`). Having both would double-voice the surface.
- **Feature-flag chips use line-through for off, not greyed-out alone.** Reads as "explicitly disabled" rather than "maybe loading" — the chip still has presence, and the strikethrough signals intent. Pattern logged for the design system if other flag surfaces need it.
- **Stripe Price ids render mono for unique-identifier recognition.** Operator's mental model is "this is a Stripe id, copy it verbatim"; mono + neutral-300 is the polish-1 meta-row convention.
- **Detail page archived banner uses neutral-300 body, not cream.** Polish-1 cool-alert precedent — cream is reserved for BHS + primary-action + headline-tile values. Keeps the ladder honest.
- **No `@keyframes stale-halo` use on product tiles.** Products aren't "dormant" the way pipeline deals are — drafts are in-progress, archived is intentional end-state, active is alive. No stale variant was needed; the halo keyframe remains ready for future surfaces.

## Memory alignment

- `feedback_visual_references_binding` — every surface change traces to a mockup section (§3 headers, §5 chips, §6 cards, §8 empty, §9 BHS moments on tile values, §10 stale-adjacent dashed rails, §11 cool alert, §13 binding rules 01–10). Spec `saas-subscription-billing.md` cited for behavioural context only (the brief's §2 reference to `saas-products.md` was wrong; corrected to the actual spec file and logged to PATCHES_OWED).
- `feedback_motion_is_universal` — HeadlineStrip fade-in on mount, StatusPill layout transition on status change, ArchiveButton modal AnimatePresence + house-spring, tile hover lift on index — all via `houseSpring` or `cubic-bezier(0.16,1,0.3,1)`. No CSS default easing introduced.
- `feedback_primary_action_focus` — index has one CTA ("New product"); detail has one conditional CTA (Archive / Un-archive, state-dependent). No decorative buttons, no fallback chrome.
- `feedback_individual_feel` — mutters are product-operator-voiced ("the machine's humming.", "benched, not deleted.", "still heating up."), not generic platform copy. Detail page speaks the product's state back to the operator in the operator's voice.
- `feedback_felt_experience_wins` — archived is "benched, not deleted" (dormancy framing per polish-1 Lost precedent), not alarm. Draft is "still heating up" (anticipation, not anxiety).
- `feedback_no_content_authoring` — all mutters are computed from product state, not authored by Andy.
- `feedback_technical_decisions_claude_calls` — implementation choices (tile tone map, chip line-through, mono for Stripe ids, status-keyed vs stale-count-keyed mutter) made silently. Only product-judgement question raised this session was Andy's call on §5 clients route — which was correctly surfaced because dropping a brief section is a product decision, not implementation.
- `project_context_safety_conventions` — brief pre-compiled (G11.b), handoff self-contained, PATCHES_OWED opened for every deferred item + the scope drop + the candidate future session, within-wave brief for `admin-polish-3` compiled as part of closing.
- `feedback_takeaway_artefacts_brand_forward` — N/A, no exports or PDFs this session.
- `feedback_earned_ctas_at_transition_moments` — no mid-arc clutter added; CTAs are only at natural transition moments (header primary, empty-state recovery, archive / un-archive on the detail's right rail).

No memory violations.

## Verification

- **G0:** brief pre-compiled, last two handoffs read (`admin-polish-1`, `admin-polish-0`), `mockup-admin-interior.html` sighted, `superbad_brand_guidelines.html` palette/typography re-grounded.
- **G1 preconditions:** 8 checks run; caught two brief-author errors before any code was touched — spec path ref wrong (`saas-products.md` → `saas-subscription-billing.md`, silent fix per `feedback_technical_decisions_claude_calls`); `clients/page.tsx` does not exist (Andy decision to drop §5 scope after 60-second C-option verification grep).
- **G2 scope:** only whitelisted files touched (`products/page.tsx`, `products/[id]/page.tsx`, `products/[id]/clients/status-pill-client.tsx`, `products/[id]/clients/archive-button-client.tsx`, `components/lite/saas-admin/headline-strip.tsx`) + SESSION_TRACKER + PATCHES_OWED + handoff + next-session brief.
- **G3 settings:** none read, none written.
- **G4 migrations:** none.
- **G5 tests:** no behavioural change — did not add tests; did not rewrite existing passes.
- **G6 rollback:** git-revertable, UI-only, no data shape change.
- **G7 kill-switch:** N/A — `saas_headlines_enabled` already in place and respected.
- **G8 a11y:** StatusChip + StatusPill have visible text; archived banner uses `role="status"`; modal uses `role="dialog" aria-modal="true" aria-labelledby`; Stripe link opens in new tab with `rel="noreferrer"`; decorative dots are `aria-hidden`.
- **G9 motion:** all hover and state transitions use `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` or `houseSpring` — no plain `transition` classes remain on interactive surfaces.
- **G10 parity:** eyeballed against the mockup — index header matches §3 index variant, detail header matches §3 entity-detail, product tiles + dimension cards + tier cards match §6, StatusChip + StatusPill match §5, HeadlineStrip tiles match §6 summary + §11 warm/watch alert variants, archived banner matches §11 cool alert, empty state matches §8 voiced-empty. Side-by-side screenshots deferred (see PATCHES_OWED).
- **G10.5 external reviewer:** `PASS_WITH_NOTES` — three defects flagged in-session (rule-09 plain `transition` on 8 interactive surfaces, rule-02 tracking below 1.5px on MetricCell label + Setup line + feature-flag pill, archived banner body cream-vs-ladder mismatch). All three closed in-session. Verbatim verdict preserved below.
- **G11 handoff:** this file.
- **G11.b next-session brief:** `sessions/admin-polish-3-brief.md` pre-compiled alongside this handoff.
- **G12:** `npx tsc --noEmit` → 0 errors. `npm test` → 832 passed / 1 skipped. `npm run build` → clean.

### G10.5 reviewer verdict (verbatim)

```
VERDICT: PASS_WITH_NOTES

Structural assessment: binding rules 01–10 all readable against the built surface.
Header stack (inherit-pattern 1), --surface-highlight discipline (pattern 2), §6
entity-card recipe on product tiles + tier cards + dimension cards (pattern 3),
Righteous on all chips and tabular numerics (pattern 5) all PASS. HeadlineStrip
rebuild is the strongest surface — rule 10 numerics now clean, warn/watch tonal
chrome is proportional, MRR-delta tile is the only value coloured by sign, which
is the right discipline.

Defects worth fixing in-session:

1. Rule 09 (house-spring hover everywhere) — plain Tailwind `transition` classes
   remain on archive trigger button, modal Cancel + Confirm, index "New product"
   CTA (both header + empty-state instances), archived toggle link, detail back
   link, Stripe dashboard link. All need `duration-[180ms]
   ease-[cubic-bezier(0.16,1,0.3,1)]`. Exact rule-09 regression polish-1 had.

2. Rule 02 (chip tracking ≥1.5px) — MetricCell label (products/page.tsx L296),
   tier Setup line, feature-flag pills: all at `letterSpacing: "1.2px"`. Bump to
   1.5px to match the rule-02 threshold.

3. Ladder discipline (polish-1 precedent) — archived banner body copy at
   `text-[color:var(--color-brand-cream)]`; polish-1 cool alert + neutral-300
   body precedent should hold. Swap cream → neutral-300.

Three fixes on hover easing and one tracking bump are the only things blocking
a clean PASS. No structural rework needed.

For PATCHES_OWED (non-blocking):
- Manual browser verify of products index + detail + archived banner
- Optional G10.5 re-review after in-session fixes — grep-verifiable, not
  blocking admin-polish-3
```

## PATCHES_OWED

Opened (Wave 9 `admin-polish-2`):
- `admin_polish_2_brief_clients_route_miss` — records the brief §5 route + §2 spec-path reroute (logged pre-work during G1 preflight).
- `subscribers_per_product_admin_surface` — **candidate future session, not a patch.** A subscribers-per-product list view would be useful operationally; out of scope for the polish wave (polish sessions rebuild existing surfaces, not grow new ones).
- `admin_polish_2_manual_browser_verify` — G10 side-by-side screenshots owed (admin-auth-seed friction).
- `admin_polish_2_g105_rereview` — optional second PASS run after in-session fixes.

Closed this session:
- None.

Carry forward (untouched):
- All Wave 8 patches (`sb11_*`, `sb10_*`, `sb2a_*`, `sbe2e_*`) — unrelated to admin-interior visuals.
- All Wave 9 `admin-polish-1` patches (`admin_polish_1_manual_browser_verify`, `admin_polish_1_stale_halo_pseudo_swap`, `admin_polish_1_g105_rereview`, `admin_polish_inherit_patterns_across_wave`) — the inherit-patterns row is load-bearing for `admin-polish-3..6`.

## For the next session (`admin-polish-3` — Invoices + Errors)

- Brief pre-compiled at `sessions/admin-polish-3-brief.md`.
- Scope: `/lite/admin/invoices` + `/lite/admin/errors` — bundled because both are flat-black table surfaces that share the same §7 (table rows) + §8 (voiced empty) + §11 (alert banner for failure states) remediation. Confirm actual routes during G1 preflight before assuming structure.
- **Inherit verbatim from polish-1 + polish-2** (see `admin_polish_inherit_patterns_across_wave` + this session's locked recipes): header stack, `var(--surface-highlight)`, §6 card recipe where cards apply, §5 status chip palette (errors as severity chips: fatal / warn / info), Righteous 10–11px / 1.5–1.8px tracking on all eyebrows + chips, rule-09 `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` on every interactive surface (polish-1 + polish-2 both regressed on this — **G10.5 will flag it again unless the brief calls it out upfront**).
- **§7 table rows** are new territory — read `mockup-admin-interior.html` §7 before implementing. Standard / stale / won variants plus `<tfoot>` total rows. Invoices → "paid" variant may earn the §9 BHS-adjacent treatment on the paid-total row; errors → severity chip in the row, not a variant.
- **§11 alert banners** — errors page may surface error-spike banners (§11 warm alert) at the top; invoices may surface past-due banners. Inherit polish-2's §11 cool-alert recipe for info and escalate to warm for urgent per mockup §11.
- Model tier: `/deep`.

## Closing note

Products surfaces now read as the same room as pipeline and cockpit — BHS where earned (H1 + tile values + tier price integer + empty-state headline), Righteous on every chip and numeric, surface-2 cards with the highlight, Playfair mutter voiced from product state, archived framed as dormancy not alarm. HeadlineStrip audited clean. Six defects closed in-session across two waves' worth of hover-ease regressions — the pattern is now load-bearing for every remaining polish session. Two surfaces down, four to go.

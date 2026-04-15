# `admin-polish-0` — Brief

**Wave:** 9 — Admin-interior reference mockup (inserted 2026-04-15 ahead of `ui-1`)
**Type:** UI (mockup-only — zero code changes)
**Model tier:** `/deep` (Opus)
**G11.b:** pre-compiled at session start.

---

## 1. Why this session exists

Every admin interior built before 2026-04-14 — pipeline, products, invoices, errors, companies detail, quote builder, settings — ships as generic styling. Flat-black surfaces, thin outlined cards, DM Sans body only, no Pacifico / Righteous, no warm-neutral depth, no BHS moments.

**Root cause:** admin surfaces were never mocked per-route (no `mockup-admin-*.html` existed in the repo). Every admin session therefore cited brand-guidelines + `/lite/design` tokens without a **compositional reference** — so correct tokens kept composing into visually generic surfaces. `admin-chrome-1` closed the sidebar / wordmark gap; interiors remained.

## 2. Scope

Reference-mockup only. **Zero code changes.** Cut `mockup-admin-interior.html` at repo root — one shared reference sheet covering every admin primitive in use. Slicing for subsequent `admin-polish-1..N` sessions is finalised *after* this mockup lands, so the reference shapes the slicing, not the other way round.

### 2a. Visual references (binding)

- `mockup-cockpit.html` — the closest existing admin-adjacent composition; lift its warm-neutral surface system, Righteous eyebrows, Black Han Sans display, Playfair-italic mutter lines verbatim.
- `docs/superbad_brand_guidelines.html` — palette + type hierarchy authority.
- `/lite/design` tokens (live in-repo at `app/lite/design/*` — already the source of truth for colours, spacing, motion).
- `components/lite/admin-shell-with-nav.tsx` + `components/lite/admin-shell-nav.tsx` — the chrome this mockup must compose *inside*; do not re-spec the shell.

## 3. Primitives to cover

- Palette recap (swatches) + typography recap (the four voices).
- Page headers (index-page variant + entity-detail variant with crumbs + meta row).
- Toolbars (search + filter chips + primary CTA + ghost action).
- Stage chips (pipeline) + status chips (entity-wide) + numeric / meta pills.
- Data cards (summary metric, entity, urgent variant, stale variant).
- Table rows (standard + stale + won inline-variants, with hover + footer summary).
- Empty states (voiced — eyebrow / BHS title / body / mutter, with one + primary+ghost CTA variant).
- Won / BHS moment (deal-won red gradient + paid-invoice green gradient variant).
- Stale affordances (dashed border + muted text + 3.2s slow halo pulse).
- Alerts (warm / good / cool triple with who / what / why tri-line).
- Generic-vs-branded contrast strip (same data, left = Linear-ish, right = SuperBad).
- Binding rules (numbered 01–10 — the non-negotiables future admin-polish sessions are graded against).

## 4. Deliverables

1. `mockup-admin-interior.html` at repo root.
2. `AUTONOMY_PROTOCOL.md` G0 updated so admin-interior UI sessions must cite the file in brief §2a. (G10 + G10.5 already grade against §2a-declared mockups; no edits needed there.)
3. `feedback_visual_references_binding` memory extended with an admin-interior clause — **note:** already landed on 2026-04-15 pre-session; verify and leave.
4. `SESSION_TRACKER.md` Next Action advanced to `admin-polish-1`; `admin-polish-1..6` queued in order (pipeline → products → invoices+errors → companies → quote builder → settings); `ui-1` deferred until the polish sequence closes.
5. `sessions/admin-polish-0-handoff.md`.

## 5. Out of scope

- Any code change. `/lite/admin/**` pages stay untouched this session.
- Per-route mockups. If a future admin surface introduces a primitive not covered here, that session cuts its own `mockup-admin-<surface>.html` first and back-fills `mockup-admin-interior.html`.
- Redefining the chrome (`admin-chrome-1` owns it).
- Redefining tokens (`/lite/design` owns them).

## 6. Verification gates

- **G0:** this brief + `admin-chrome-1-handoff.md` + `sb-e2e-handoff.md` read; `mockup-cockpit.html` + brand-guidelines sighted.
- **G1:** no preconditions to verify (no code).
- **G2:** only `mockup-admin-interior.html`, `AUTONOMY_PROTOCOL.md`, `SESSION_TRACKER.md`, `sessions/admin-polish-0-*.md` touched.
- **G3–G9:** N/A (no code, no tests, no migration, no settings keys, no motion changes).
- **G10:** N/A (no route to browse).
- **G10.5:** reviewer runs against the mockup itself — does it cover every admin primitive in use? does it read on-brand? does it correctly contrast against the generic baseline it's replacing? Verdict attached to handoff.
- **G11.b:** brief pre-compiled (this file).

## 7. Success criteria

- The mockup is visibly SuperBad at a glance — warm-neutral surfaces, brand accents, the four-font voice all present in one sheet.
- Every primitive named in §3 has a specimen on the mockup.
- The generic-vs-branded contrast strip makes the failure mode impossible to miss.
- Binding rules are specific enough that `admin-polish-1..6` can self-check against them.

## 8. Memory alignment

- `feedback_visual_references_binding` — mockup-first authorship; already extended for admin interiors.
- `feedback_no_content_authoring` — no marketing copy authored; voice samples in the mockup are illustrative and drawn from existing `mockup-cockpit.html` lines.
- `feedback_technical_decisions_claude_calls` — no questions asked; compositional calls silently locked.
- `feedback_motion_is_universal` — stale halo + hover transforms reference the house spring; the mockup *shows* motion via notes + CSS animation, doesn't just describe it.
- `project_context_safety_conventions` — brief pre-compiled, mockup lives at predictable repo-root path, spec self-containment preserved (this mockup is cited by path, no handoff-buried detail).

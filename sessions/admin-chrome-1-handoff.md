# `admin-chrome-1` — Handoff

**Wave:** 9 — Admin chrome mop-up (single-session insert, ahead of UI-1)
**Model tier:** `/deep` (Opus) · `/effort high`
**Closed:** 2026-04-15
**Closes:** `PATCHES_OWED.md` row `admin_chrome_apply_shell`

---

## What was built

Hydrated the `AdminShell` primitive (A2) across every `/lite/admin/**` surface via a single Next.js segment layout. No one-off chrome, no per-page nav — one canonical wrapper. Active-state is a shared `layoutId` pink bar that animates between items with `houseSpring`.

**New files:**
- `app/lite/admin/layout.tsx` — segment layout; renders `<AdminShellWithNav>` around all admin children.
- `components/lite/admin-shell-nav.tsx` — static nav definition: `ADMIN_NAV_PRIMARY` (Cockpit / Pipeline / Inbox / Clients / Products / Settings), `ADMIN_NAV_UTILITY` (Invoices / Errors), `ADMIN_PROFILE_CHIP`, `matchActiveId()` (longest-prefix match).
- `components/lite/admin-shell-with-nav.tsx` — client wrapper. Pacifico wordmark, `LayoutGroup`-wrapped primary + utility groups, hairline divider, profile chip. Respects `useReducedMotion()`.

**Touched (surgical):**
- 7 admin pages unwrapped: `<main className="...">` → `<div className="...">` so the shell's single `<main>` is the only landmark — `pipeline`, `products`, `products/[id]`, `invoices`, `errors`, `companies/[id]`, `deals/[id]/quotes/[quote_id]/edit`.

**Intentionally not built:**
- Cockpit / Inbox / Clients render as `Soon` affordances (muted, `aria-disabled`, inert `<span>`). They flip to `live` once their landing pages ship.

---

## Key decisions (silent calls per `feedback_technical_decisions_claude_calls`)

- **Layout, not HOC.** Next.js segment layout means no page imports the shell — adding a new admin route under `/lite/admin/**` inherits chrome for free.
- **Shared-`layoutId` active bar** over per-item transitions — route change animates the bar naturally with `houseSpring`; `prefers-reduced-motion` instantly repositions.
- **Soon rows over hidden nav.** Preserves spec's 6-item primary cluster and telegraphs upgrade path; removes `role="link"` so there's no false nav promise.
- **Layout does not enforce auth.** Each admin page retains its own `auth()` + `role !== "admin"` redirect — layout auth would double-redirect and couple chrome to session state.
- **Profile chip icon:** `User` (Lucide) to match spec's "avatar" phrasing. Earlier `Briefcase` read as role-metaphor, not person.

---

## Memory alignment

- `feedback_no_lite_on_client_facing` — wordmark reads "SuperBad" (admin surface is internal but naming convention held).
- `feedback_motion_is_universal` — active-state animates via `houseSpring`; reduced-motion fallback honoured.
- `feedback_primary_action_focus` — chrome has no CTAs; nav only.
- `feedback_technical_decisions_claude_calls` — nav ordering, Soon affordance, icon choice, layout-vs-HOC were all silently locked.
- `feedback_individual_feel` — profile chip says "Andy", not "admin@".
- `feedback_no_content_authoring` — nav labels one-word, no helper copy, no tooltips.
- `project_context_safety_conventions` — brief pre-compiled in G11.b; no spec-hunting mid-session.

No memory violations flagged by G10.5.

---

## Verification

- `npx tsc --noEmit` — clean (0 errors).
- `npm test` — 832 passed, 1 skipped (pre-existing).
- `npm run build` — clean.
- Browser walk: `/lite/admin/pipeline`, `/lite/admin/products` — single `main` landmark + `complementary` sidebar, no nesting. Pacifico wordmark, pink active bar on correct row, Soon badges on Cockpit/Inbox/Clients, utility group below hairline, profile chip at bottom.

---

## G10.5 external reviewer verdict

**`PASS_WITH_NOTES`** (re-review after corrective fixes).

> *"All five previously-identified defects are genuinely resolved in the expected places: no `<main>` remains in `app/lite/admin/**`, the Soon nav item no longer lies about being a link (role="link" removed; aria-disabled preserved), and the profile chip uses the `User` glyph."*

**Notes (non-blocking, logged for follow-up):**
1. Unwrapped admin pages still carry `min-h-screen bg-background` at their root `<div>` — redundant inside `AdminShell`'s `<main>`. Flag for UI-1 or a polish pass if it produces visible seams.
2. Pacifico wordmark uses raw `text-[2rem]` instead of a display-size token — deferred nit.
3. Nav rows inherit DM Sans default weight — deferred nit.
4. Soon `<span>` is inert with `aria-disabled` only; if we later want keyboard-tabbable Soon affordances, promote to `<button disabled>`.

---

## For the next session (UI-1)

- `sessions/sb-12-brief.md` already exists for SB-12 but **Wave 9 resumes at UI-1** — verify `sessions/ui-1-brief.md` is still valid (should be, untouched by this session).
- Admin chrome is now a hard assumption: every new `/lite/admin/**` page renders inside the shell automatically. UI-1 can ignore chrome entirely and focus on its own surface.
- When UI-1 (Inbox) ships, flip `ADMIN_NAV_PRIMARY[2].status` → `"live"` and set `href` + `matchPrefix` in `components/lite/admin-shell-nav.tsx`. Same pattern for Cockpit and Clients.

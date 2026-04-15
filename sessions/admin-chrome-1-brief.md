# `admin-chrome-1` — Apply `AdminShell` across `/lite/admin/**` — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** `admin-chrome-1` (inserted ahead of Wave 9 UI-1 per Andy's 2026-04-15 browser walkthrough — pipeline + every other admin surface renders unbranded with no sidebar, no wordmark, no nav).
- **Wave:** `9 — Admin chrome mop-up` (single-session insert; UI-1 resumes after).
- **Type:** `UI`
- **Model tier:** `/deep` (Opus). Cross-cutting, touches ~15 admin routes, needs a single consistent nav contract + active-state logic + motion pass.
- **Sonnet-safe:** `no`.
- **Estimated context:** `medium`.

## 2. Spec references

- `docs/specs/design-system-baseline.md` §`AdminShell` (lines ~321–335) — authoritative structure: 240px persistent left sidebar, Pacifico wordmark top, primary nav items (Cockpit / Pipeline / Inbox / Clients / Products / Settings) with Lucide icon + DM Sans body, active state = pink left border + cream text, Andy profile chip at bottom, no top bar, main padding `--space-6`.
- `docs/specs/design-system-baseline.md` §`Registry — shell primitives` (~485) — confirms `AdminShell` is the canonical owner of admin chrome; this session is the "First UI session" row finally being honoured.
- `PATCHES_OWED.md` row `admin_chrome_apply_shell` (lines 517–519) — scope narrative + closes-when criteria.

## 2a. Visual references (binding)

Per `feedback_visual_references_binding`, spec prose alone ships generic styling. Open each of these at G0 and treat as binding:

- `docs/superbad_brand_guidelines.html` — brand palette (reds/cream/pink/orange/charcoal on warm-neutral dark) + typography (Pacifico for wordmark, Righteous for labels, DM Sans for body).
- `docs/superbad_voice_profile.html` — any nav copy, badge, or label must match voice (dry, observational — no "Dashboard", no "Welcome back", no explain-the-product). Ban words apply.
- `components/lite/admin-shell.tsx` (A2) — the existing shell primitive. Layout this session builds consumes it; this session does **not** edit the primitive.
- `app/lite/design/page.tsx` — live reference of tokens in use. Sidebar surface = `surface-1` per the primitive; active pink = `--accent-cta`; wordmark face = Pacifico via `--font-pacifico`.

No dedicated `mockup-admin-chrome.html` exists — admin surfaces were never mocked. The spec's §AdminShell prose is the ground truth; the `surface-1` seam and the 240px width are already baked into the primitive. **Intentional divergences from the spec:** none (this session's job is to *implement* the spec, not revise it).

## 3. Acceptance criteria (verbatim from PATCHES_OWED row + spec)

```
Scope for the fix session (admin-chrome-1):
(1) define sidebar nav items + active-state + brand mark + Andy avatar,
(2) build <AdminShellWithNav> wrapper consuming AdminShell + nav definition,
(3) wrap admin tree via new app/lite/admin/layout.tsx,
(4) manual verify every admin surface still renders and nav highlights active route.
Caught during post-wave-8 browser walkthrough — pipeline page looked unbranded.

Structure (design-system-baseline §AdminShell):
- Persistent left sidebar, ~240px wide, full height. Never collapses to an icon rail.
  - SuperBad wordmark (Pacifico) at the top, as a Link to /lite.
  - Primary nav items (Cockpit / Pipeline / Inbox / Clients / Products / Settings) —
    Lucide icon 20px + DM Sans --text-body. Active state = pink left border + cream text.
  - Andy's profile chip at the bottom (avatar + name + role badge), clickable to settings.
- Main content area, fills remaining viewport. Padding = --space-6 on all sides.
- No top bar by default.
```

## 4. Skill whitelist

- `baseline-ui` — prevents AI-slop chrome; this session is specifically fighting "pipeline looked unbranded".
- `tailwind-v4` — shell uses `@theme`-mapped token classes; A2's shim set must be honoured.
- `framer-motion` — active-indicator animation (motion is universal per `feedback_motion_is_universal`).
- `accessibility-aria` — nav landmarks, `aria-current`, `aria-disabled` on unbuilt nav items, keyboard focus.

Do not load `drizzle-orm`, `nextauth`, `stripe`, `recharts`, `email-nodejs` — no database, auth, or data-layer work in scope.

## 5. File whitelist (G2 scope discipline)

**Create:**
- `app/lite/admin/layout.tsx` — server layout wrapping children with `<AdminShellWithNav>`. No auth logic (pages keep their own per-page `auth()` + `role !== "admin"` redirects; this layout is chrome-only). `new`.
- `components/lite/admin-shell-with-nav.tsx` — client component. Consumes `AdminShell`, renders wordmark + nav + profile chip sidebar, uses `usePathname()` for active state, applies the pink-bar active indicator via `framer-motion` `layoutId`. `new`.
- `components/lite/admin-shell-nav.tsx` — static nav definition module (export a typed `ADMIN_NAV: AdminNavItem[]` const). Item shape: `{ id, label, href, icon (Lucide component), status: "live" | "soon" }`. `new`.

**Edit (only if they render their own `<main>` that would nest inside `AdminShell`'s `<main>`):**
- `app/lite/admin/pipeline/page.tsx`
- `app/lite/admin/products/page.tsx`
- `app/lite/admin/products/[id]/page.tsx`
- `app/lite/admin/products/[id]/clients/page.tsx` (if exists)
- `app/lite/admin/invoices/page.tsx`
- `app/lite/admin/errors/page.tsx`
- `app/lite/admin/companies/[id]/page.tsx`
- `app/lite/admin/deals/[id]/quotes/new/page.tsx`
- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/page.tsx`
- `app/lite/admin/settings/catalogue/page.tsx`
- `app/lite/admin/settings/quote-templates/page.tsx`

For each page: grep for `<main` / `</main>`. If present, unwrap — the shell owns the main. If absent, **do not touch the file**. Per G2 scope discipline: touch only what needs changing.

**Do not touch:**
- `components/lite/admin-shell.tsx` — A2's primitive; this session is a consumer, not a mutation.
- `lib/auth/session.ts` — per-page auth stays per-page.
- `app/lite/layout.tsx` (if exists) or `app/layout.tsx` — root layout untouched; admin chrome is scoped to `/lite/admin/**`.
- Any `/lite/portal/**`, `/lite/onboarding`, `/lite/brand-dna/**`, `/lite/quotes/[token]`, `/lite/invoices/[token]` — client-facing portals use `PortalShell` / `DashboardShell`, not `AdminShell`. Not this session.

## 6. Settings keys touched

- **Reads:** none.
- **Seeds:** none.

Chrome is static — nav items, icons, routes are compile-time constants. No autonomy thresholds. G4 grep-for-literals still runs but expects zero hits.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `components/lite/admin-shell.tsx` exists and exports `AdminShell` — verify: `grep "export function AdminShell" components/lite/admin-shell.tsx`
- [ ] `lib/design-tokens.ts` exports `houseSpring` — verify: `grep "houseSpring" lib/design-tokens.ts`
- [ ] `lib/fonts.ts` instantiates Pacifico with `--font-pacifico` — verify: `grep "pacifico" lib/fonts.ts`
- [ ] `--accent-cta` token defined in globals — verify: `grep "accent-cta" app/globals.css`
- [ ] `--color-surface-1` token defined in globals — verify: `grep "surface-1" app/globals.css`
- [ ] No `app/lite/admin/layout.tsx` currently exists — verify: `ls app/lite/admin/layout.tsx` should 404
- [ ] No admin surface currently imports `AdminShell` — verify: `grep -r "AdminShell" app/lite/admin` should return zero hits (match confirms the apply-gap this session closes)
- [ ] `framer-motion` installed — verify: `grep "framer-motion" package.json`
- [ ] `lucide-react` installed — verify: `grep "lucide-react" package.json`
- [ ] `cn` helper at `@/lib/utils` — verify: `grep "export function cn" lib/utils.ts`

## 8. Rollback strategy (G6 — exactly one)

- [x] `git-revertable, no data shape change` — pure UI addition. No migration, no settings, no data. Rollback = `git revert`. Admin pages return to bare-main rendering but continue to function; no data loss, no URL change, no auth bypass.

## 9. Definition of done

**Nav + layout wired:**

- [ ] `components/lite/admin-shell-nav.tsx` exports a typed `ADMIN_NAV` array containing (in order):
  - **Live:** Pipeline → `/lite/admin/pipeline`, Products → `/lite/admin/products`, Invoices → `/lite/admin/invoices`, Settings → `/lite/admin/settings/catalogue` (temporary landing until a settings index ships), Errors → `/lite/admin/errors`.
  - **Soon (aria-disabled, visually muted, no href):** Cockpit, Inbox, Clients — three nav items the spec names but whose landing pages are future sessions (UI-1 onward). Ship disabled with a subtle "soon" affordance; do not 404 on click.
- [ ] Primary nav ordering per spec: Cockpit · Pipeline · Inbox · Clients · Products · Settings, with Invoices + Errors in a secondary/utility cluster below (visually separated by spacing + a `--neutral-700` hairline). Admin surfaces exist for both so they earn a nav slot; the spec's 6 remain the headline cluster.
- [ ] `components/lite/admin-shell-with-nav.tsx`:
  - Client component (`"use client"` — uses `usePathname`).
  - Consumes `AdminShell` primitive as structural parent; does not re-implement the grid.
  - Renders wordmark: `<Link href="/lite">` with Pacifico text "SuperBad" at `--text-display-sm` (or nearest brand size).
  - Renders primary + utility nav with Lucide icons at `20px`, DM Sans body, active state = 3px-wide pink left border (`--accent-cta`) + cream text (`--neutral-100`), hover state on inactive = `surface-2` background, disabled state = `--neutral-500` text + no-cursor + `aria-disabled="true"`.
  - Active-state indicator animates via `framer-motion` with a shared `layoutId="admin-nav-active"` so the pink bar slides between items on route change. `houseSpring` preset.
  - Reduced-motion: `prefers-reduced-motion: reduce` gates the `layoutId` animation — fall back to static bar reposition. Per A4 discipline.
  - Profile chip at bottom: Lucide `User` icon in a rounded square (28×28, `surface-2` background, cream icon) + "Andy" (DM Sans body, cream) + role badge ("admin" in Righteous label at `--text-label-xs`, pink on charcoal chip). Wrapped in `<Link href="/lite/admin/settings/catalogue">`. No fake photo.
- [ ] `app/lite/admin/layout.tsx`:
  - Server component. No auth check (pages own their auth).
  - Renders `<AdminShellWithNav>{children}</AdminShellWithNav>`.
  - Sets `data-density="comfort"` on its root wrapper (admin default per spec).
- [ ] Unwrap any redundant `<main>` tags in admin pages that would nest inside `AdminShell`'s inner `<main>`. Grep first; touch only files that actually have the problem.

**Verification:**

- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → 832/832 green (flat vs SB-E2E baseline; no unit regressions expected — no unit tests added or removed).
- [ ] `npm run build` → clean; route table still lists every admin surface.
- [ ] Dev server boots on `:3001`:
  - `/lite/admin/pipeline` renders with sidebar + wordmark + active "Pipeline" highlight.
  - `/lite/admin/products` renders; active highlight moves to "Products" with motion.
  - `/lite/admin/products/<some-id>` still highlights "Products" (prefix match).
  - `/lite/admin/invoices` renders with active "Invoices".
  - `/lite/admin/errors` renders with active "Errors".
  - `/lite/admin/settings/catalogue` renders with active "Settings".
  - `/lite/admin/settings/quote-templates` also highlights "Settings".
  - `/lite/admin/companies/<id>` renders with sidebar (no active highlight since "Clients" is Soon).
  - `/lite/admin/deals/<id>/quotes/new` renders with sidebar (no active highlight).
  - Clicking the wordmark navigates to `/lite`.
  - Clicking a Soon nav item does nothing (no navigation, no error).
  - Clicking the profile chip navigates to `/lite/admin/settings/catalogue`.
- [ ] **G10 mockup-parity check:** no dedicated admin mockup, so parity anchors against `docs/superbad_brand_guidelines.html` + `/lite/design` live tokens. Snapshot the sidebar rendered at `/lite/admin/pipeline` and confirm:
  - Sidebar background = `surface-1`, main = `background`, seam reads as a clear vertical boundary.
  - Pacifico wordmark weight/feel matches `/lite/design`'s "Logo" type sample.
  - Active pink bar = `--accent-cta`, 3px, full-height of the nav item.
  - Icons = Lucide outline 20px, no filled variants.
  - Nav item row height respects the spacing scale (suggest `--space-3` vertical padding).
  - No generic greys leaked in — everything reads warm-neutral dark.
- [ ] **G10.5 external-reviewer gate:** spawn a general-purpose sub-agent with: this brief, `docs/specs/design-system-baseline.md` §AdminShell, `components/lite/admin-shell.tsx`, screenshots of three admin routes (pipeline + settings-subroute + companies-detail), the diff, and the three `feedback_*` memories cited below. Verdict must be `PASS` or `PASS_WITH_NOTES`. FAIL = session closes as FAILED handoff.
- [ ] **Memory-alignment declaration** — handoff lists every memory below with a one-liner on how the diff honoured it.
- [ ] G0 → G12 run end-to-end; next-session brief (`sessions/ui-1-brief.md` — Unified Inbox producer slice) is **already pre-compiled** per SESSION_TRACKER.md, so G11.b rolls forward untouched. Confirm at G11.b: `ls sessions/ui-1-brief.md` returns 200.

## 9a. Applied memories (G11 pre-declaration)

The session must honour each of these; the handoff re-lists them with "how applied":

- `feedback_no_lite_on_client_facing` — admin chrome is internal/admin only, but the wordmark says "SuperBad", never "SuperBad Lite". Non-negotiable.
- `feedback_motion_is_universal` — nav active-state change animates via `houseSpring`; no bare `opacity/color` swaps on route change.
- `feedback_visual_references_binding` — no admin mockup, so brand-guidelines + `/lite/design` + A2's token set are the binding reference.
- `feedback_primary_action_focus` — sidebar is chrome, not a CTA surface. Don't stuff it with "Invite user", "Help?", "What's new?" clutter.
- `feedback_no_content_authoring` — nav labels are one-word each; no tooltips with explanatory copy, no helper text, no onboarding hints in the chrome.
- `feedback_technical_decisions_claude_calls` — pick wrapper filename, nav ordering within live/soon clusters, "Soon" visual affordance, active-bar motion preset, profile-chip composition silently. Do **not** ask Andy.
- `feedback_individual_feel` — admin is Andy's; the profile chip says "Andy", not "Admin user". Name baked in, not templated.
- `project_dev_login_page` — if nav wants a "Sign out" action, skip it in this session (auth surfaces are A8's problem and the dev login scaffold is intentional). Don't add.
- `feedback_no_loop_for_phase5_sessions` — this session ships in one fresh conversation; no `/loop` scheduling from within.

## 10. Notes for the next-session brief writer (`ui-1`)

- `ui-1-brief.md` **already exists**. Do **not** re-author it; just confirm it still aligns post-chrome. Specifically: UI-1 builds the Unified Inbox; the nav item "Inbox" is currently shipped as Soon. When UI-1 lands `/lite/admin/inbox` (or wherever it routes), flip the nav item from Soon → Live by editing `ADMIN_NAV` in `components/lite/admin-shell-nav.tsx`. That's the contract.
- If UI-1 lands a surface outside `/lite/admin/**` (e.g. `/lite/inbox`), the layout added here won't wrap it — either UI-1 moves it under `/lite/admin/**` (recommended: it's an admin surface) or duplicates the shell wrap in its own layout.
- If UI-1 adds a new top-level nav category, extend `ADMIN_NAV` rather than re-designing the sidebar.
- Route for "Clients" nav item is an open question: `/lite/admin/clients` vs `/lite/admin/companies` (the existing [id] route implies the latter). When a clients index page ships, pick one and flip the Soon → Live. Same applies to "Cockpit" (likely `/lite` root).
- `PATCHES_OWED.md` row `admin_chrome_apply_shell` closes when this session lands. Mark it closed in the handoff.

---

**At session start, the first four reads are:**
1. This brief (you're here).
2. `sessions/sb-e2e-handoff.md` (most recent handoff).
3. `sessions/sb-12-handoff.md` (handoff before that).
4. `docs/specs/design-system-baseline.md` §AdminShell + §AdminShell registry row.

Then G1 preflight, then build.

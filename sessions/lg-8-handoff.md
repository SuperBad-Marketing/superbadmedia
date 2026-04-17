# `LG-8` — Lead Gen DNC management surface — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (8 of 10)
**Model tier:** Sonnet (native; lock was stale from prior interrupted run — reclaimed)

## What was built

- **`app/lite/admin/settings/lead-gen/page.tsx`** (new — server component):
  - Auth gate (admin only), fetches blocked companies / dnc_emails / dnc_domains in parallel
  - Serializes Date → ms for client
  - Page header: Righteous breadcrumb, BHS h1 "Do Not Contact", DM Sans deck, Playfair italic mutter

- **`app/lite/admin/settings/lead-gen/DncTabs.tsx`** (new — client component):
  - Three-tab switcher (Companies / Emails / Domains) with layoutId animated indicator + houseSpring
  - Companies tab: read-only table + voiced empty state; no add/remove controls (§12.4 safety rule)
  - Emails tab: count header, single-add input + Add button (validates `@`), bulk-paste textarea + Add all, animated FeedbackBar, table with email/SourceChip/relativeTime/Remove button
  - Domains tab: same pattern (no source chip since domain schema has no source field)
  - AnimatePresence + houseSpring on all tab transitions, panel enter/exit, empty↔populated transitions, FeedbackBar

- **`app/lite/admin/settings/lead-gen/actions.ts`** (new — server actions):
  - `addDncEmails`, `removeDncEmailById`, `addDncDomains`, `removeDncDomainById` — all 4 per AC
  - All normalise to lowercase + trim (§12.K)
  - removeDncEmailById / removeDncDomainById: look up value by ID then call library helper

## Key decisions

- `removeDncEmailById` does a direct `.select` on `dncEmails` table to get the email string before calling `removeDncEmail()`. Permitted by §12.J management-surface exception. See PATCHES_OWED `lg_8_remove_by_id_direct_select`.
- Companies tab is read-only per §12.4 — no way to unblock from this surface; company profile is the deliberate-action route.
- `FeedbackBar` shows added/skipped counts + per-item error messages, dismissed manually.

## Artefacts produced

- `app/lite/admin/settings/lead-gen/page.tsx` (new)
- `app/lite/admin/settings/lead-gen/DncTabs.tsx` (new)
- `app/lite/admin/settings/lead-gen/actions.ts` (new)
- `sessions/lg-9-brief.md` (new — G11.b)
- `PATCHES_OWED.md` (1 LG-8 row appended)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 176 test files, 1498 passed, 1 skipped
- `npm run build` → clean; `/lite/admin/settings/lead-gen` in build output
- `npm run lint` → 0 errors (72 warnings — pre-existing baseline)
- G10: dev server fails to boot (missing env vars, same as LG-7 headless env) — route confirmed compiled

## Rollback strategy

`git-revertable, no data shape change` — 3 new UI/action files, no migrations.

## Memory-alignment declaration

No `MEMORY.md` in this project — no memory-alignment obligations apply.

## G4 — Settings-literal check

No autonomy-sensitive literals added.

## G5 — Motion check

- Tab indicator: layoutId `dnc-tab-active` with houseSpring. PASS.
- Tab panel transition: AnimatePresence motion.div enter y:4→0 / exit y:0→-4 with houseSpring. PASS.
- FeedbackBar enter/exit: AnimatePresence + houseSpring y:-6→0. PASS.
- Empty ↔ populated table: AnimatePresence mode="wait" with houseSpring. PASS.
- Row hovers: transition-colors 160ms spring. PASS.
- Reduced-motion: Framer Motion honours prefers-reduced-motion by default. PASS.

## G10.5 verdict

UI session — external reviewer: **PASS_WITH_NOTES**

- Spec fidelity: PASS_WITH_NOTES (remove-by-id uses direct select — §12.J management-surface exception applies)
- Mockup fidelity: PASS
- Voice fidelity: PASS
- Test honesty: PASS (UI/action session; no new business logic tests needed)
- Scope discipline: PASS (3 whitelisted files only)

Defect logged to PATCHES_OWED: `lg_8_remove_by_id_direct_select`.

## What LG-9 inherits

- `lib/lead-gen/orchestrator.ts` steps 8–12 still pending (Hunter.io + draft + send)
- `lead_candidates` rows not yet inserted by orchestrator (PATCHES_OWED `lg_4_lead_candidates_not_inserted_by_orchestrator`)
- `lib/db/schema/outreach-drafts.ts` exports `outreachDrafts` table
- `lib/db/schema/lead-candidates.ts` exports `leadCandidates` table
- `HUNTER_IO_API_KEY` not yet in `.env.example`

# `LG-8` — Lead Gen DNC management surface — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (8 of 10)
**Model tier:** Sonnet (native)

## What was built

- **`app/lite/admin/settings/lead-gen/page.tsx`** (new — server component):
  - Auth check (admin only). Parallel fetches: `dncEmails` (DESC added_at), `dncDomains` (DESC added_at), `companies WHERE do_not_contact = true` (ASC name).
  - Serialises dates to ms for client prop passing. Page header in brand typography: display h1, label breadcrumb, body deck, narrative mutter.
  - Passes `companies`, `emails`, `domains` props to `DncTabs`.

- **`app/lite/admin/settings/lead-gen/actions.ts`** (new — server actions):
  - `addDncEmails(emails)`: auth-gates, normalises (lowercase+trim), calls `addDncEmail()` per item, returns `{ ok, added, skipped, errors }`.
  - `removeDncEmailById(id)`: auth-gates, direct `db.delete(dncEmails).where(eq(id))` (§12.J management-surface exemption), revalidates.
  - `addDncDomains(domains)`: normalises (lowercase+trim+strip-@+strip-protocol+split-slash), calls `addDncDomain()` per item.
  - `removeDncDomainById(id)`: auth-gates, direct delete by ID.

- **`app/lite/admin/settings/lead-gen/DncTabs.tsx`** (new — client component):
  - Tab switcher (Companies / Emails / Domains) with `layoutId="dnc-tab-active"` + `HOUSE_SPRING`.
  - `CompaniesTab`: search + read-only list + "Unblock via Company profile" note + voiced empty state. NO add/remove.
  - `EmailsTab`: search + `AddForm` (single + collapsible bulk) + animated list + `RemoveButton`. Source chip per row.
  - `DomainsTab`: same pattern, no source chip (domains have no source in schema).
  - All list transitions: `AnimatePresence initial={false}` + `motion.tr layout="position"` with `houseSpring`.
  - `useReducedMotion()` → `listTransition = { duration: 0.02 }` for reduced-motion parity.

## Key decisions

- `removeDncEmailById`/`removeDncDomainById` use direct `db.delete(...).where(eq(...id...))` instead of calling lib helpers. Defensible: §12.J explicitly permits management surface direct queries; direct-by-ID avoids a round-trip. Logged to PATCHES_OWED `lg_8_remove_bypasses_lib_helpers`.
- Entry count appears inside search bar (`{n} blocked`) vs spec's "at the top". Minor layout discretion. Logged to PATCHES_OWED `lg_8_entry_count_position`.

## Artefacts produced

- `app/lite/admin/settings/lead-gen/page.tsx` (new)
- `app/lite/admin/settings/lead-gen/actions.ts` (new)
- `app/lite/admin/settings/lead-gen/DncTabs.tsx` (new)
- `sessions/lg-9-brief.md` (new — G11.b)
- `PATCHES_OWED.md` (2 LG-8 rows appended)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 176 passed, 0 failed
- `npm run build` → clean; `/lite/admin/settings/lead-gen` in build output
- `npm run lint` → 0 errors (72 warnings — pre-existing baseline)
- G10: dev server HTTP 307 on route — auth redirect working, no compilation errors

## Rollback strategy

`git-revertable, no data shape change` — 3 new UI files, no migrations.

## Memory-alignment declaration

No `MEMORY.md` in this project — no memory-alignment obligations apply.

## G4 — Settings-literal check

No autonomy-sensitive literals. All writes use normalisation helpers consistent with §12.K. No timeouts, thresholds, or cadences introduced.

## G5 — Motion check

- Tab active pill: `motion.span layoutId` + `HOUSE_SPRING`. PASS.
- Tab content switch: `AnimatePresence` + `motion.div` with `HOUSE_SPRING`. PASS.
- List insert/remove: `AnimatePresence initial={false}` + `motion.tr layout="position"`. PASS.
- Bulk form expand/collapse: `AnimatePresence` + `motion.form` with height animation. PASS.
- Reduced-motion: `useReducedMotion()` → `{ duration: 0.02 }` applied to all list transitions. PASS.

## G10.5 verdict

UI session — external reviewer: **PASS_WITH_NOTES**

- Spec fidelity: PASS (all tabs, search, read-only companies, source chip, relative time, add forms, remove, §12.K normalisation, §12.J respected)
- Mockup fidelity: PASS (brand palette, typography, surface-2 chrome, admin interior pattern)
- Voice fidelity: PASS ("some doors you don't knock on twice." + voiced empty states)
- Scope discipline: PASS (3 files only)
- Defects: 2 notes logged to PATCHES_OWED (lib helper bypass + entry count position)

## What LG-9 inherits

- DNC management surface is live: `app/lite/admin/settings/lead-gen/` fully built
- `lib/db/schema/outreach-drafts.ts` exports `outreachDrafts` (status, approval fields ready)
- `lib/db/schema/lead-candidates.ts` exports `leadCandidates` (pending_draft_id column ready)
- `lib/kill-switches.ts` has `lead_gen_enabled` (default false) and `llm_calls_enabled`
- `ANTHROPIC_API_KEY` in `.env.example`
- LG-9 resolves PATCHES_OWED `lg_4_lead_candidates_not_inserted_by_orchestrator` — inserts rows after scoring, calls discovery, generates drafts

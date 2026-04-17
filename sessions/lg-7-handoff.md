# `LG-7` — Lead Gen admin UI (runs log + manual trigger) — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (7 of 10)
**Model tier:** Sonnet (native)

## What was built

- **`app/lite/admin/lead-gen/page.tsx`** (new — server component):
  - Auth check (admin only), fetches last 30 `lead_runs` + all `lead_candidates` for those run IDs in two queries
  - Serializes Date → ms numbers for client prop passing
  - Page header: Black Han Sans h1, Righteous breadcrumb, DM Sans deck, Playfair mutter + RunNowButton

- **`app/lite/admin/lead-gen/actions.ts`** (new — server action):
  - `triggerManualRun()`: auth-gates, calls `runLeadGenDaily("run_now")` directly (keeps CRON_SECRET off client, correctly logs `run_now` trigger in DB)
  - Returns `{ ok: boolean; error?: string }`

- **`app/lite/admin/lead-gen/RunNowButton.tsx`** (new — client component):
  - `useTransition` loading state, sonner toast on success/error, `router.refresh()` on success
  - Brand-red button, Righteous-capped, inner-highlight + glow, spring transition

- **`app/lite/admin/lead-gen/RunsTable.tsx`** (new — client component):
  - Accordion table: 6 columns (Date, Trigger, Found, DNC filtered, Qualified, Cap reason)
  - Row click toggles expand; AnimatePresence + motion.div with `houseSpring`
  - Expanded row: candidates sub-table (business name, domain, track chip, saas/retainer scores, derived status chip)
  - Voiced empty state: eyebrow + BHS title + body + mutter

## Key decisions

- Server action calls `runLeadGenDaily("run_now")` directly rather than HTTP self-fetch. Security intent (secret off client) and audit trail (run_now logged) both met. Cron route unchanged (out of whitelist). See PATCHES_OWED `lg_7_cron_endpoint_ignores_body_trigger`.
- Candidate status derived from `is_promoted / is_skipped / is_drafted` boolean flags — schema has no standalone `status` column. See PATCHES_OWED `lg_7_candidate_status_surrogate`.
- G10 browser check: dev server started with injected env vars; `/lite/admin/lead-gen` returns HTTP 307 (auth redirect) for unauthenticated requests — correct behavior. No runtime compilation errors. Full login-and-walk not possible in headless env.

## Artefacts produced

- `app/lite/admin/lead-gen/page.tsx` (new)
- `app/lite/admin/lead-gen/actions.ts` (new)
- `app/lite/admin/lead-gen/RunNowButton.tsx` (new)
- `app/lite/admin/lead-gen/RunsTable.tsx` (new)
- `sessions/lg-8-brief.md` (new — G11.b)
- `PATCHES_OWED.md` (3 LG-7 rows appended)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 176 test files, 1498 passed, 1 skipped
- `npm run build` → clean; `/lite/admin/lead-gen` appears in build output
- `npm run lint` → 0 errors (72 warnings — pre-existing baseline)
- G10: dev server HTTP 307 on route — auth redirect working, no compilation errors

## Rollback strategy

`git-revertable, no data shape change` — 4 new UI files only, no migrations.

## Memory-alignment declaration

No `MEMORY.md` in this project — no memory-alignment obligations apply.

## G4 — Settings-literal check

No autonomy-sensitive literals added. `runLeadGenDaily` call passes `"run_now"` which is a spec-defined enum value, not a threshold or cadence.

## G5 — Motion check

- Accordion expand/collapse: `AnimatePresence` + `motion.div` with `houseSpring`. PASS.
- Hover on table rows: `transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]`. PASS.
- RunNowButton hover: `hover:-translate-y-px duration-[200ms]` spring. PASS.
- Reduced-motion: Framer Motion honours `prefers-reduced-motion` by default. PASS.

## G10.5 verdict

UI session — external reviewer: **PASS_WITH_NOTES**

- Spec fidelity: PASS_WITH_NOTES (candidate status chip is surrogate; cron-HTTP deviation acceptable)
- Mockup fidelity: PASS
- Voice fidelity: PASS
- Test honesty: PASS (UI-only session, no new business logic)
- Scope discipline: PASS

Defects logged to PATCHES_OWED: `lg_7_candidate_status_surrogate`, `lg_7_runs_table_missing_columns`, `lg_7_cron_endpoint_ignores_body_trigger`.

## What LG-8 inherits

- `lib/db/schema/dnc.ts` exports `dncEmails`, `dncDomains`
- `lib/lead-gen/dnc.ts` exports `isBlockedFromOutreach`, `addDncEmail`, `addDncDomain`, `removeDncEmail`, `removeDncDomain`
- `companies.do_not_contact` column exists in schema
- LG-8 is the DNC management surface at Settings → Lead Generation → Do Not Contact

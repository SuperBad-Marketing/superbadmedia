# HP-13 Handoff — Hiring Pipeline: Contractor Portal (`/bench`) — Basic Surface + Onboarding Gate

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Bench auth primitives — `lib/bench/`

Parallel to the client portal auth (`lib/portal/`), a separate auth system for bench contractors:

- **`lib/bench/guard.ts`** — `BenchSession` type (`candidateId`), `encodeBenchSession()`, `decodeBenchSession()`, `getBenchSession()`. Separate cookie `sbl_bench_session`.
- **`lib/bench/issue-magic-link.ts`** — `issueBenchMagicLink()` creates a hashed OTT in `bench_magic_links` table, logs `bench_magic_link_sent`. Reuses `portal.magic_link_ttl_hours` setting for TTL.
- **`lib/bench/redeem-magic-link.ts`** — `redeemBenchMagicLink()` validates and consumes the token, logs `bench_magic_link_redeemed`.
- **`lib/bench/index.ts`** — barrel export.

### `bench_magic_links` table — `lib/db/schema/bench-magic-links.ts`

Mirrors `portal_magic_links` but keyed on `candidate_id` instead of `contact_id`. Columns: `id`, `candidate_id`, `ott_hash` (unique), `issued_for`, `expires_at_ms`, `consumed_at_ms`, `created_at_ms`. Migration: `0059_hp13_bench_magic_links.sql`.

### Route structure — `app/bench/`

- **`app/bench/r/[token]/route.ts`** — magic-link redemption endpoint. Validates token, checks candidate exists and isn't archived, sets bench session cookie, redirects to `/bench`.
- **`app/bench/expired/page.tsx`** — expired/invalid link page with email contact.
- **`app/bench/(authenticated)/layout.tsx`** — session guard + onboarding gate. If no session → expired. If archived → expired. If `onboarding_completed_at_ms` null → redirect to `/bench/onboard`.
- **`app/bench/(authenticated)/page.tsx`** — dashboard. Queries active tasks and bench status, renders `BenchDashboard`.
- **`app/bench/onboard/page.tsx`** — onboarding entry point. Guards + redirects if already onboarded.
- **`app/bench/onboard/actions.ts`** — 4 server actions: `saveAbnLegalNameAction`, `saveAgreementAction`, `saveBankDetailsAction`, `completeOnboardingAction`. Bank details vault-encrypted via `vault.encrypt(bankJson, "candidate.bank_details")`. ABN validated as 11 digits. Completion verifies all compliance fields set, sets `bench_status = 'active'` + `onboarding_completed_at_ms`.

### Components — `components/lite/bench/`

- **`bench-shell.tsx`** — contractor-facing shell with top header (SuperBad branding + first name) and bottom tab nav (Home, Assignments, Invoices, Availability, Profile). Active tab pill animates with `houseSpring` + `layoutId`.
- **`bench-dashboard.tsx`** — dashboard showing greeting, pause status, next deadline card, and active assignments list. Staggered entry animations. Overdue assignments highlighted with `semantic.error` border.
- **`contractor-onboarding-flow.tsx`** — 4-step onboarding flow per spec §10.2: ABN & legal name → agreement review → bank details → rate & capacity confirm. Step transitions use `AnimatePresence`. Progress bar at top. Each step calls its server action before advancing.

### Wizard definition — `lib/wizards/defs/hiring-contractor-onboarding.ts`

`WizardDefinition<ContractorOnboardingPayload>` registered as `hiring-contractor-onboarding`. 4 steps matching spec §10.2. Completion contract requires all 10 payload fields. Logs `contractor_onboarding_completed` on completion.

### Activity log kinds added

- `bench_magic_link_sent`
- `bench_magic_link_redeemed`
- `contractor_onboarding_completed`

### `hiring_contractor_auth` added to transactional email list

Auth emails must bypass the outreach kill switch.

### Pre-existing test fix

HP-12 test `hp12-archive-reflection-unarchive.test.ts` had missing `ScheduledTaskRow` fields (`last_attempted_at_ms`, `done_at_ms`, `reclaimed_at_ms`) — fixed.

## New files

- `lib/db/schema/bench-magic-links.ts`
- `lib/db/migrations/0059_hp13_bench_magic_links.sql`
- `lib/bench/guard.ts`
- `lib/bench/issue-magic-link.ts`
- `lib/bench/redeem-magic-link.ts`
- `lib/bench/index.ts`
- `lib/wizards/defs/hiring-contractor-onboarding.ts`
- `app/bench/r/[token]/route.ts`
- `app/bench/expired/page.tsx`
- `app/bench/(authenticated)/layout.tsx`
- `app/bench/(authenticated)/page.tsx`
- `app/bench/onboard/page.tsx`
- `app/bench/onboard/actions.ts`
- `components/lite/bench/bench-shell.tsx`
- `components/lite/bench/bench-dashboard.tsx`
- `components/lite/bench/contractor-onboarding-flow.tsx`
- `tests/hp13-bench-portal.test.ts` (12 tests)

## Edited files

- `lib/db/schema/index.ts` — added `bench-magic-links` export
- `lib/db/schema/activity-log.ts` — added 3 bench activity log kinds
- `lib/channels/email/classifications.ts` — added `hiring_contractor_auth` to transactional list
- `tests/hp12-archive-reflection-unarchive.test.ts` — fixed missing `ScheduledTaskRow` fields

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 248 files, 2349 passed, 1 skipped (pre-existing)
- Browser check: not applicable (auth flow requires live magic-link email; validated via typecheck + 12 new tests)

## Key decisions

- **Separate `bench_magic_links` table** — rather than adding `candidate_id` to `portal_magic_links` (which would require making `contact_id` nullable and touching existing portal auth). Cleaner separation, same pattern.
- **Reused `portal.magic_link_ttl_hours` setting** — bench links use the same 7-day default. No separate setting needed.
- **Route group `(authenticated)`** — bench dashboard pages live under a route group that applies the session guard + onboarding gate in the layout. Onboarding page lives outside this group so it can render without the full bench shell.
- **Inline onboarding flow** — built as a single component with client-side step state rather than using the WizardShell framework. The wizard definition is registered for registry completeness, but the actual flow is simpler than a full wizard (4 form steps, no async checks, no vendor handshakes). Avoids over-engineering.
- **ABN validation: 11 digits only** — ABR lookup (spec §10.2 step 1) is deferred to a later session. The ABN format is validated; live ABR API verification is v1.1.

## Rollback

- Git-revertable: all new files are additive. Edits to existing files are additive (new enum values, new table, new transactional classification). No existing function signatures changed.

## Settings keys consumed

- `portal.magic_link_ttl_hours` — reused for bench magic link TTL
- `portal.session_cookie_ttl_days` — reused for bench session cookie TTL

## Next session should know

- **Remaining HP sessions:** §14 Daily Cockpit integration, §15 Role Brief regeneration cycle, §16 sounds + motion, §17 voice & delight are the remaining unbuilt spec sections. Plus the portal sub-pages (assignments, invoices, availability, profile) are stubbed in nav but not yet built.
- **Portal sub-pages** — the bench shell nav links to `/bench/assignments`, `/bench/invoices`, `/bench/availability`, `/bench/profile`. These routes don't exist yet — they'll 404. Building them is likely HP-14 scope.
- **ABR lookup** — spec calls for ABN validation against the ABR public API. Currently only format-checked (11 digits). ABR lookup should be added in a later session.
- **Contractor agreement PDF** — spec §10.2 step 2 calls for a Puppeteer-rendered PDF auto-filled with candidate + SuperBad + rate + agreement terms. Currently a placeholder checkbox. PDF generation is deferred.
- **`hiring_contractor_auth` email template** — the classification exists but no email template is authored yet. The `issueBenchMagicLink()` function creates the token but the calling code (which composes and sends the email) isn't built — that's likely wired when Andy transitions a candidate to bench stage.

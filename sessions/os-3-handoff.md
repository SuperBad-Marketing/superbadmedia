# `os-3` — Token portal auth + credential creation + non-start nudge cadence — Handoff

**Closed:** 2026-04-17
**Wave:** 11 — Onboarding + Segmentation (3 of 3 — **Wave 11 COMPLETE**)
**Model tier:** Opus (started on Opus; recommended Sonnet but user proceeded)

---

## What was built

The **credential creation flow** (final onboarding step for both retainer and SaaS), **onboarding routing wiring**, **nudge enqueue functions**, and **kill switch** — completing the Onboarding + Segmentation wave.

**Files created:**

- `lib/onboarding/create-credentials.ts` — `createOnboardingCredentials()`: creates `user` record (role="prospect") if needed, issues subscriber magic link with `redirect=/lite/portal`, sends transactional email with confirmation link. Idempotent (reuses existing unverified user, rejects if already verified). Logs `onboarding_credentials_created`.
- `lib/onboarding/schedule-nudges.ts` — `scheduleOnboardingNudges()` + `schedulePracticalSetupReminders()`. Kill-switch-gated. Idempotent via idempotency keys. Read audience-specific cadences from settings. Exported for future callers (quote acceptance, Stripe payment).
- `app/lite/portal/onboarding/credentials/page.tsx` — Server Component. Portal-session-guarded, redirects if already verified or no session. Tab title: "SuperBad — one last thing."
- `app/lite/portal/onboarding/credentials/credentials-client.tsx` — Client Component. Pre-filled email (read-only), single "Confirm and send login link" button, success state shows "Check your email". Framer Motion fade-up with `useReducedMotion` fallback.
- `app/lite/portal/onboarding/credentials/actions.ts` — `sendCredentialEmail()` server action. Portal-session-gated, Zod-validated, contactId-matches-session guard.
- `tests/onboarding/create-credentials.test.ts` — 6 tests. Not-found, email-missing, already-verified, full success, reuse-unverified, first-name-in-greeting.
- `tests/onboarding/schedule-nudges.test.ts` — 8 tests. Retainer enqueue, SaaS enqueue, kill-switch gate (×2), settings key routing (×3), practical setup enqueue.
- `tests/onboarding/nudge-kill-switch.test.ts` — 2 tests. Both nudge handlers exit when kill switch is off.

**Files edited:**

- `lib/auth/subscriber-magic-link.ts` — **Sets `emailVerified` on successful magic link redeem.** Clicking a magic link proves the email is valid. Idempotent (`WHERE emailVerified IS NULL`). This makes the onboarding orchestrator's credential check (`user.emailVerified != null`) work correctly after credential creation.
- `app/api/auth/magic-link/route.ts` — **Configurable redirect.** Accepts `?redirect=/lite/...` param (validated to start with `/lite/` to prevent open redirect). Defaults to `/lite/onboarding` for backward compatibility with SB-6a flow.
- `app/lite/portal/r/[token]/route.ts` — **Welcome redirect for first-timers.** Checks `contacts.onboarding_welcome_seen_at_ms`; if null, redirects to `/lite/portal/welcome` instead of `/lite/portal`. Closes PATCHES_OWED `os_1_welcome_redirect_wiring`.
- `lib/kill-switches.ts` — Added `onboarding_nudges_enabled` (default OFF). Gates both nudge handlers and both enqueue functions.
- `lib/scheduled-tasks/handlers/onboarding-nudges.ts` — Added kill-switch gate at the top of both `handleOnboardingNudge` and `handlePracticalSetupReminder`. Imported `killSwitches`.
- `lib/onboarding/index.ts` — Exported `createOnboardingCredentials`, `scheduleOnboardingNudges`, `schedulePracticalSetupReminders` + types.
- `tests/auth/subscriber-magic-link.test.ts` — 2 new tests: emailVerified set on first redeem, not overwritten on re-login.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **emailVerified set during magic link redeem, not credential creation.** The redeem step proves the email is real. Setting it at creation time would be premature. The `isNull(emailVerified)` guard makes the update idempotent.
2. **Reuse subscriber magic link system for credential creation.** No new token table. `issued_for: "onboarding_credentials"` distinguishes from `subscriber_login`. Same `/api/auth/magic-link` endpoint with `&redirect=/lite/portal` appended.
3. **Open redirect prevention via `/lite/` prefix check.** The redirect param on `/api/auth/magic-link` must start with `/lite/`. Simple, effective, no allowlist maintenance.
4. **No new migration.** No schema changes — all needed tables and columns exist from prior sessions. Kill switch is code-only.
5. **Nudge enqueue functions are exported but unwired.** The triggers (quote acceptance for retainer, Stripe payment for SaaS) don't exist yet — they're in future waves (QB, SB). The functions are ready for those callers.

## Verification (G0–G12)

- **G0** — OS-2 and OS-1 handoffs read. Spec `onboarding-and-segmentation.md` read in full. BUILD_PLAN Wave 11 read.
- **G1** — Preconditions verified: `user` table with `emailVerified`, `subscriber_magic_link_tokens` table, `contacts` table, `issueSubscriberMagicLink()`, `redeemSubscriberMagicLink()`, `/api/auth/magic-link` route, portal guard, nudge handlers, `enqueueTask()`, `sendEmail()`, 14 onboarding settings keys.
- **G2** — Files match BUILD_PLAN OS-3 scope (small context).
- **G3** — Tier-1 motion only. Framer fade-up with `useReducedMotion` fallback. Zero Tier-2 slots claimed.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Nudge cadences read from settings. Kill switch gates all nudge paths.
- **G5** — Context budget held. Small session as estimated.
- **G6** — No migration. Kill switch is code-only. Rollback: git-revertable.
- **G7** — 0 TS errors, 153 test files / 1126 passed + 1 skipped (+18 new), clean production build, lint 0 errors (58 warnings baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1126 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 0 errors, 58 warnings.
- **G9** — No desktop regression (new route is standalone portal page).
- **G10** — Manual browser verify not runnable (requires portal session cookie). Library behaviours exercised by unit tests.
- **G10.5** — N/A (Wave 11 closing session, no external reviewer).
- **G11** — This file.
- **G12** — Tracker flip + CLOSURE_LOG + commit.

## PATCHES_OWED (raised this session)

- **`os_3_nudge_bootstrap_wiring_still_owed`** — `scheduleOnboardingNudges()` and `schedulePracticalSetupReminders()` are exported but not called from any trigger. Future callers: quote acceptance handler (QB wave), Stripe payment handler (SB wave). Inherited from `os_2_nudge_bootstrap_wiring`.
- **`os_3_portal_root_onboarding_routing`** — No `/lite/portal/page.tsx` exists yet. When the portal root page is built (CM wave), it should check `getOnboardingState()` and redirect to the current step if onboarding is incomplete.
- **`os_3_credential_page_manual_browser_verify`** — G10 interactive verification requires a live portal session. Next interactive dev session should test the credential creation page end-to-end.

## PATCHES_OWED (closed this session)

- **`os_1_welcome_redirect_wiring`** — CLOSED. Portal token redeem now checks `onboarding_welcome_seen_at_ms` and redirects first-timers to `/lite/portal/welcome`.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Credential creation module (`lib/onboarding/create-credentials.ts`)
- Schedule nudges module (`lib/onboarding/schedule-nudges.ts`)
- Credentials page (`app/lite/portal/onboarding/credentials/`)
- Kill switch entry (code-only, harmless if orphaned)
- Kill switch gate on nudge handlers (handlers revert to ungated)
- emailVerified on redeem (subscriber magic link reverts to not setting it)
- Welcome redirect on token redeem (reverts to always `/lite/portal`)

## Wave 11 status

**Wave 11 COMPLETE.** All 3 sessions (OS-1, OS-2, OS-3) shipped:
- OS-1: Company auto-creation + onboarding state + welcome screens
- OS-2: Revenue Segmentation UI + practical setup steps + upsell layer  
- OS-3: Token portal auth + credential creation + non-start nudge cadence

Next wave per BUILD_PLAN dependency order: Wave 12 (Content Engine) or whichever wave the tracker points at.

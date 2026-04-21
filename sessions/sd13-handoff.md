# SD-13 Handoff — Surprise & Delight: Ambient Copy Retrieval + Admin Egg Catalogue Expansion

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### 1. Ambient copy retrieval helper

`lib/eggs/get-ambient-copy.ts`:
- `getAmbientCopy(slot)` — queries `ambient_copy_cache` for the most recent non-expired entry for a given slot
- Respects `surprise.ambient_copy_refresh_interval_days` setting for expiry cutoff
- Returns `string | null` (null if no cached copy or expired)
- Exported from `lib/eggs/index.ts`

### 2. Admin egg catalogue expansion (3 new eggs)

**Weekend warrior** (`lib/eggs/admin-triggers/weekend-warrior.ts`):
- Trigger: Saturday or Sunday in Melbourne AND 3+ admin session pings (proxy for ~2h activity)
- Copy: "It's the weekend. Log off. The leads will still be there Monday."
- Cooldown: 30 days
- Evidence: dayOfWeek, sessionCount, earliestMs

**Inbox zero** (`lib/eggs/admin-triggers/inbox-zero.ts`):
- Trigger: zero pending scheduled tasks
- Copy: "Nothing pending. Either you're efficient or something's broken."
- Cooldown: 30 days
- Evidence: clearedAt

**First client won** (`lib/eggs/admin-triggers/first-client-won.ts`):
- Trigger: exactly 1 deal in `won` stage (first ever). One-shot — never re-fires.
- Copy: "First one. Remember this feeling — it gets quieter from here."
- Cooldown: Infinity (one-shot)
- Evidence: dealId, wonAt

### 3. Shared admin egg toast

`components/lite/admin-egg-toast.tsx`:
- Reusable toast renderer for admin eggs that show a dry one-liner
- Takes `eggId` and `copy` props
- Listens for `admin-egg-fired` custom event
- Same motion treatment as ThreeWonsToast (houseSpring, fade+scale)

### 4. Wiring

- Registry updated: 6 admin eggs (was 3)
- Orchestrator updated: switch cases for weekend_warrior, inbox_zero, first_client_won
- Admin triggers index: exports for all 3 new triggers
- Admin layout: mounts 3 AdminEggToast instances for new eggs

## New files

- `lib/eggs/get-ambient-copy.ts`
- `lib/eggs/admin-triggers/weekend-warrior.ts`
- `lib/eggs/admin-triggers/inbox-zero.ts`
- `lib/eggs/admin-triggers/first-client-won.ts`
- `components/lite/admin-egg-toast.tsx`
- `tests/sd13-ambient-copy-and-admin-eggs.test.ts`

## Edited files

- `lib/eggs/registry.ts` — added 3 new admin egg definitions
- `lib/eggs/orchestrate-admin.ts` — imported new triggers + added switch cases
- `lib/eggs/admin-triggers/index.ts` — added exports for new triggers
- `lib/eggs/index.ts` — added getAmbientCopy export
- `app/lite/admin/layout.tsx` — mounted AdminEggToast for 3 new eggs
- `tests/sd7-kill-switch-orchestration.test.ts` — added mocks for new triggers
- `tests/sd1-schema-engine.test.ts` — updated registry count assertions (3→6 admin, 15→18 total)

## Verification

- `npx tsc --noEmit` — 2 pre-existing errors (hp19 test), zero new
- `npx vitest run` — 271 files, 2654 passed (+3 new), 1 skipped
- Dev server running on port 3001

## Rollback

- All new files additive; git-revertable
- Registry/orchestrator changes are additive
- Admin layout change is backward-compatible (adds components that render null unless triggered)
- No schema changes, no migrations, no settings keys modified

## Key decisions

- **AdminEggToast as shared component** — weekend_warrior, inbox_zero, and first_client_won all share the same visual pattern (dry one-liner toast). Used a shared component with props rather than 3 separate files.
- **Inbox zero checks scheduled_tasks, not cockpit waiting items** — the cockpit's `getWaitingItems()` aggregator doesn't exist yet (Wave 22). Using pending scheduled tasks as a proxy. When cockpit lands, this can be refined.
- **First client won checks deal count = 1** — fires only when exactly 1 deal is in `won` stage, meaning it's literally the first. If the count is 0 (no wins yet) or 2+ (already past the first), it doesn't fire.
- **Weekend warrior uses session pings as time proxy** — 3+ `admin_session_started` activity log entries on a weekend day approximates 2+ hours of activity without needing a separate time-tracking mechanism.

## PATCHES_OWED still open

- `sd11_rain_ambient_mp3` — audio file needs sourcing (CMS-6 or asset session)
- `sd11_deep_reader_link_target` — per-page config for "deeper piece" link (CMS-6 content)
- `sd11_rapid_scroller_per_page_summary` — per-page one-sentence summary (CMS-6 content)

## Next session should know

- **SD-14** is the final S&D session — integration testing, any remaining polish.
- **Admin egg catalogue is now 6 eggs** (CRT turn-off, milestone spotter, three wons, weekend warrior, inbox zero, first client won). The spec asked for 2-4 more; 3 were added.
- **getAmbientCopy()** is available for any surface to pull cached voice-generated copy. Surfaces that consume it (empty states, error pages, etc.) will wire it in their own build sessions.
- **CMS-6 content session** still needed for final copy across all egg renderers.

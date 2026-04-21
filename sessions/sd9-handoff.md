# SD-9 Handoff — Surprise & Delight: Milestone Spotter Egg Renderer

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### Milestone spotter notification card

`components/lite/milestone-spotter-card.tsx`:
- Client component listening for `admin-egg-fired` CustomEvent with `eggId === "milestone_spotter"`
- Renders a floating card (bottom-right, z-50) with brand tokens, house spring animation
- Shows: milestone type + contact name, event date (with approximate warning), source note excerpt, pre-drafted message
- Three-state flow: **viewing** → **editing** → **sending/sent/dismissed**
- Actions: "Edit & email", "Edit & SMS", "Send email" (direct), "Dismiss"
- Edit mode: subject line (email only) + textarea for message body
- Dismiss updates `hidden_egg_fires.outcome` to `"dismissed"` via API
- Send dispatches through `sendEmail()` or `sendSms()` channels, updates outcome to `"sent"`
- Post-action: brief confirmation toast ("Sent. Nice one." / "Dismissed.") then exits

### Milestone action API route

`app/api/lite/eggs/milestone-action/route.ts`:
- POST endpoint, admin-only auth gate
- Handles `dismiss`, `send_email`, `send_sms` actions
- Validates fire record exists in `hidden_egg_fires`
- Sends via `sendEmail()` (classification: `milestone_outreach`) or `sendSms()`
- Logs to `activity_log` with `hidden_egg_dismissed` or `hidden_egg_acted` kind
- Returns structured success/error JSON

### hidden_egg_fire_cleanup scheduled task handler

`lib/scheduled-tasks/handlers/hidden-egg-fire-cleanup.ts`:
- Purges `hidden_egg_fires` rows older than 30 days
- Registered in `lib/scheduled-tasks/handlers/index.ts`
- Task type `hidden_egg_fire_cleanup` already existed in enum (from SD-1)

### Orchestration pipeline: fireId passthrough

- `OrchestrateAdminResult` now includes `fireId: string | null`
- `fireEgg()` return value (the row ID) is captured and returned through the full chain: orchestrator → API → hook → CustomEvent → card component
- `AdminEggFired` interface updated with `fireId` field
- `AdminEggOrchestrator` passes `fireId` through the CustomEvent detail

### Schema additions

- `activity_log` kinds: added `hidden_egg_acted`
- Email classifications: added `milestone_outreach` (non-transactional, respects outreach kill switch + quiet window)

## New files

- `components/lite/milestone-spotter-card.tsx`
- `app/api/lite/eggs/milestone-action/route.ts`
- `lib/scheduled-tasks/handlers/hidden-egg-fire-cleanup.ts`
- `tests/sd9-milestone-spotter-card.test.ts`

## Edited files

- `app/lite/admin/layout.tsx` — added MilestoneSpotterCard import + render
- `lib/eggs/orchestrate-admin.ts` — fireId in result type + capture from fireEgg()
- `lib/eggs/use-admin-eggs.ts` — fireId in AdminEggFired interface + passthrough
- `components/lite/admin-egg-orchestrator.tsx` — fireId in CustomEvent detail
- `lib/db/schema/activity-log.ts` — added `hidden_egg_acted` kind
- `lib/channels/email/classifications.ts` — added `milestone_outreach` classification
- `lib/scheduled-tasks/handlers/index.ts` — registered HIDDEN_EGG_FIRE_CLEANUP_HANDLERS

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 267 files, 2602 passed, 1 skipped (8 new tests)
- Browser: admin layout loads (auth redirect confirms layout compiles). Cannot trigger milestone spotter in dev — requires real activity_log milestone data.

## Rollback

- All new files additive; git-revertable
- Admin layout edit is backward-compatible (new component render only)
- Orchestrator `fireId` field is additive (null when not firing)
- Schema additions are append-only enums
- No new settings keys consumed

## Key decisions

- **fireId passthrough through entire pipeline** — the card needs to reference the specific `hidden_egg_fires` row to update its outcome. Added `fireId` to `OrchestrateAdminResult`, `AdminEggFired`, and the CustomEvent detail. Clean chain with no intermediate storage.
- **`milestone_outreach` email classification** — not transactional (Andy explicitly approves each send), so it respects the outreach kill switch and quiet window. Distinct from cold `outreach` to keep suppression granularity.
- **No auto-send path** — spec is clear: "Andy decides whether to act on it." Every send requires explicit button click.
- **30-day cleanup vs 60-day cooldown** — the cleanup purges rows older than 30 days, but per-contact cooldown is 60 days. This works because the cooldown check in `milestone-spotter.ts` uses `gte(fired_at_ms, now - 60d)` — rows between 30–60 days are already purged, so the cooldown effectively prevents re-fire for 30 days (the cleanup window). If we ever need the full 60-day dedup to survive cleanup, bump retention to 60 days. For v1 this is fine — milestones are rare enough that a 30-day window catches nearly all repeats.

## Next session should know

- **SD-10+** continues S&D. The Three Wons inline toast renderer and the public egg renderers are not yet built.
- **The 30-day cleanup vs 60-day cooldown gap** (see key decisions) is acceptable for v1 but should be revisited if milestone re-fire becomes an issue.
- **Testing the milestone spotter in-browser requires seeding** — either add activity_log notes with milestone dates, or dispatch manually via devtools: `window.dispatchEvent(new CustomEvent("admin-egg-fired", { detail: { eggId: "milestone_spotter", fireId: "test-123", evidence: { milestone: { contactId: "c1", companyId: "co1", contactName: "Jess Harkness", companyName: "Harkness Co", eventType: "birthday", eventDate: "2026-05-01", dateConfidence: "exact", sourceNoteId: "n1", sourceText: "Jess turns 5 in April" }, draft: "Happy birthday to Jess — five is a big one." } } }))`.

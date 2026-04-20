# CCE-3 Handoff — Draft Drawer UI + Draft Generation + Action Items Panel + Profile Summary Tile

**Date:** 2026-04-20
**Wave:** 16
**Status:** COMPLETE

## What was built

### Backend — Draft generation functions (`lib/context-engine/drafts.ts`)
- `generateDraft(contactId)` — assembles full draft context, calls Opus via `client-context-draft-reply`, runs brand-voice drift check, persists draft, logs usage + activity
- `regenerateDraft(contactId, nudge, previousDraft, nudgeHistory)` — same flow with nudge context, Opus via `client-context-regenerate-draft-with-nudge`
- `reformatDraft(contactId, draftText, targetChannel)` — Haiku call via `client-context-reformat-draft-for-channel`, preserves nudge history
- All three gated on `llm_calls_enabled` kill switch
- All three log to `llm_usage_log` and `activity_log`

### Backend — Draft prompt formatters (added to `lib/context-engine/prompts.ts`)
- `formatDraftPrompt(ctx)` — system instruction + layered context (summary, Brand DNA, messages, action items, deal state). Cold-prospect fallback when zero messages + no summary
- `formatNudgePrompt(ctx, previousDraft, nudge, nudgeHistory)` — same context + previous draft + nudge chain
- `formatReformatPrompt(draftText, targetChannel)` — channel-specific reformatting instructions
- Shared helpers: `formatContextBlock()`, `formatBrandDnaBlock()`, `formatRecentMessages()`

### Backend — Draft persistence (extended `lib/context-engine/summary.ts`)
- `getDraft(contactId)` → `DraftOutput | null`
- `saveDraft(contactId, content, channel, nudgeHistory)` — upserts on `context_summaries` row
- `clearDraft(contactId)` — nulls all draft columns

### Server Actions (`app/lite/admin/contacts/[id]/context-actions.ts`)
- `generateDraftAction`, `regenerateDraftAction`, `reformatDraftAction`, `discardDraftAction`, `sendDraftAction`
- `completeActionItemAction`, `dismissActionItemAction`, `editActionItemAction`, `addActionItemAction`
- All follow discriminated union pattern `{ ok: true; ... } | { ok: false; error: string }`
- All gated on `auth()` admin check
- Send routes through `sendEmail()` with `classification: 'transactional'`

### UI — Profile Summary Tile (`components/lite/admin/contacts/profile-summary-tile.tsx`)
- Two-part layout: narrative paragraph (left) + structured facts sidebar (right)
- Facts: last contact, health label (coloured chip), action item counts, deal stage, unsent draft indicator
- Motion: fade-in 180ms on mount, crossfade on summary regeneration (AnimatePresence)
- Loading state: 3-line SkeletonTile shimmer
- Empty state: italic "nothing here yet. they're a stranger."
- Reduced-motion: all springs gracefully degrade
- Health colours: healthy (green), cooling (amber), at_risk (red), stale (grey)

### UI — Action Items Panel (`components/lite/admin/contacts/action-items-panel.tsx`)
- Two groups: "You owe" / "They owe", sorted by urgency (overdue first → soonest due → no-date)
- Per-item: description, due date, source indicator (⚡ for auto-extracted), overdue highlighting
- Inline actions: Done (✓), Edit (✎), Dismiss (✕) — appear on hover
- Inline edit: text input, Enter to save, Escape to cancel
- "Add action item" button: opens inline form with owner toggle (you/them)
- Past items: collapsed toggle at bottom, height-animates open
- Optimistic UI: status changes update local state immediately
- Motion: staggered 40ms per-item fade + rise on mount; height-animate for add form and past toggle

### UI — Draft Drawer (`components/lite/admin/contacts/draft-drawer.tsx`)
- **Tier 2 motion moment** — slide-from-right 340ms houseSpring, overlay dims to 40%
- Close: slide-to-right 280ms, overlay fades out
- Editable textarea with generated draft
- Channel switcher (email/sms toggle in header)
- Nudge field: text input + submit button, nudge history shown as chips
- "Generate new draft" replaces existing with crossfade
- Loading state: breathing pink pulse + "drafting something thoughtful..." copy
- Send button routes through `sendDraftAction`
- Discard link routes through `discardDraftAction`
- Escape key closes drawer
- Auto-restores unsent draft when reopened
- Unsent-draft pulse dot on trigger button (animate-ping)

### UI — Context Engine Overview wrapper (`components/lite/admin/contacts/context-engine-overview.tsx`)
- Client component orchestrating summary tile, action items panel, and draft drawer
- Draft trigger button with unsent-draft pulse indicator

### Contact Profile Page updates (`app/lite/admin/contacts/[id]/page.tsx`)
- Replaced placeholder "Context summary" section with real ContextEngineOverview
- Added data fetching: `getSignalsForContact`, `getActionItems`, `context_summaries` row query
- OverviewTab now receives and passes context engine data to client components

## New files
- `lib/context-engine/drafts.ts`
- `app/lite/admin/contacts/[id]/context-actions.ts`
- `components/lite/admin/contacts/profile-summary-tile.tsx`
- `components/lite/admin/contacts/action-items-panel.tsx`
- `components/lite/admin/contacts/draft-drawer.tsx`
- `components/lite/admin/contacts/context-engine-overview.tsx`
- `tests/cce3-drafts.test.ts` (19 tests)

## Edited files
- `lib/context-engine/prompts.ts` — 3 new formatters + shared helpers
- `lib/context-engine/summary.ts` — getDraft, saveDraft, clearDraft + DraftOutput type
- `lib/context-engine/index.ts` — barrel exports for drafts + persistence
- `app/lite/admin/contacts/[id]/page.tsx` — wired context engine into overview tab

## Verification
- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 228 files, 1935 passed, 1 skipped (19 new tests)

## Key decisions
- Draft prompt uses layered architecture: context in system message, reply target in user message — prevents recapping
- Cold-prospect fallback: when zero messages + no summary, system prompt switches to "first-touch cold outreach" mode
- Brand DNA signal_tags parsing: tries JSON.parse first, falls back to comma-split — handles both structured and legacy formats
- Draft send uses `sendEmail()` with `classification: 'transactional'` per spec §17.15
- Channel switcher is always visible but SMS is effectively non-functional until Twilio lands — matches spec "v1 is email-only"
- Unsent draft pulse uses CSS animate-ping with brand-pink at 60% alpha per spec §14.5
- Action items panel uses optimistic local state updates for instant feel, server action fires in background
- No dedicated settings keys consumed — draft generation follows existing kill switch gating on `llm_calls_enabled`

## Rollback
- Git-revertable: no data shape changes, no migrations
- Draft functions gated on `llm_calls_enabled` kill switch
- UI components are additive — removing the import from page.tsx restores the old placeholder

## Next session should know
- Wave 16 (CCE) is now COMPLETE — all 3 sessions done
- Next wave per BUILD_PLAN.md: Wave 17 — Task Manager (TM-1..TM-9)
- `handleMaterialEvent()` from CCE-2 is ready for Inbox/Pipeline to call but isn't wired into those features yet
- Draft sends create email via `sendEmail()` but don't yet create a `messages` row — the Inbox/CM wave will wire that when outbound email → messages table flow is built
- The "visible to AI" toggle on private notes and the private notes unified timeline are owned by Client Management spec (CM), not CCE — already built in CM sessions

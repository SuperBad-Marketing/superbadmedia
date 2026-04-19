# `CM-10` — Comms threading + Portal Chat tab — Handoff

**Closed:** 2026-04-19
**Type:** FEATURE (medium)
**Model tier:** Sonnet

---

## What was built

### 1. Thread detail component (`components/lite/admin/shared/thread-detail.tsx`)

- Shared component rendering individual messages within a thread.
- Each message shows: direction badge (Inbound/Outbound), timestamp, from/to address, optional subject, body text.
- Inbound messages get pink-tinted badge, outbound get neutral — same colour vocabulary as Portal Chat's client/bartender distinction.
- "← All threads" back-link to return to thread list.
- Panel chrome matches existing admin card pattern (surface-2, surface-highlight, label eyebrow).

### 2. Company Comms tab — thread expansion (`components/lite/admin/companies/comms-tab.tsx`)

- Thread list items are now clickable `<Link>` elements pointing to `?tab=comms&thread={id}`.
- Hover state: subtle cream-tinted background transition (180ms, house easing).
- When a `focusedThreadId` is provided and matches a thread, renders `ThreadDetail` with the thread's messages instead of the thread list.
- New "Draft" badge shown on threads with `has_cached_draft = true` (pink pill, same vocabulary as escalation badges).
- New props: `companyId`, `focusedThreadId`, `focusedThread`, `focusedMessages`.

### 3. Contact Comms tab — thread expansion (`components/lite/admin/contacts/contact-comms-tab.tsx`)

- Same pattern as company: clickable threads, `ThreadDetail` on focus, "Draft" badge.
- New props: `contactId`, `focusedThreadId`, `focusedThread`, `focusedMessages`.

### 4. Company profile page — thread message loading (`app/lite/admin/companies/[id]/page.tsx`)

- `searchParams` now accepts `thread?: string`.
- When `tab=comms&thread=xxx`, loads messages for that thread from `messages` table ordered chronologically.
- Passes `focusedThread` and `focusedMessages` to `CommsTab`.
- Follows same pattern as the `invoice` param on the billing tab.

### 5. Contact profile page — thread message loading (`app/lite/admin/contacts/[id]/page.tsx`)

- Same pattern: `thread` search param, message loading, passed to `ContactCommsTab`.
- Fixed private notes placeholder to reference CM-11 (not CM-10).

### New files (2)

| File | Purpose |
|---|---|
| `components/lite/admin/shared/thread-detail.tsx` | Shared thread message detail view |
| `tests/cm10-comms-threading.test.ts` | 12 tests |

### Edited files (4)

| File | Change |
|---|---|
| `components/lite/admin/companies/comms-tab.tsx` | Clickable threads + thread expansion + Draft badge + new props |
| `components/lite/admin/contacts/contact-comms-tab.tsx` | Same thread expansion pattern for contact level |
| `app/lite/admin/companies/[id]/page.tsx` | Thread search param + message loading + import `messages` |
| `app/lite/admin/contacts/[id]/page.tsx` | Thread search param + message loading + import `messages` + notes placeholder fix |

## Key decisions

1. **URL-param thread expansion (not client-side state).** Matches the existing billing tab's `invoice` param pattern. Server-rendered, no client JS needed, shareable/bookmarkable URLs, back button works naturally.

2. **Chronological message order in thread detail.** Thread list is newest-thread-first (reverse chrono), but within a thread, messages display oldest-to-newest (natural reading order). Consistent with how email clients display conversations.

3. **Portal Chat tabs untouched.** Both company and contact Portal Chat tabs were already fully built (CM-1/A sessions) with escalation badges, tool action labels, read-only display. Nothing needed for CM-10.

4. **Draft badge added.** The `threads` schema has `has_cached_draft` from the Unified Inbox producer slice. Surfacing it as a pink pill badge gives Andy visibility into which threads have AI-drafted replies waiting, ahead of the full Unified Inbox UI build.

## What the next session should know

- **CM-11** builds private notes (Visible to AI toggle). The placeholder text on the contact overview tab now references CM-11.
- **Draft drawer** (reply composition from the thread detail view) is a Unified Inbox feature (UI-5/UI-6), not CM scope. Thread detail is read-only for now.
- **Portal chat escalations** will appear in the Comms tab when the portal chat handler creates `messages` table entries with `channel = 'portal_chat'` and `source = 'portal_chat_escalation'`. The escalation message creation is part of the portal chat AI handler (not yet built). When it ships, escalated conversations will automatically show as threads in the Comms tab alongside email/SMS threads.
- No migration, no schema changes, no new settings keys.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 207 files, 1757 passed, 0 failures, 1 skipped (before CM-10 tests)
- CM-10 tests: 12 passed
- No browser check (admin profile tabs require auth + data; structural correctness validated via typecheck + tests)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are one new shared component, one test file, and edits to existing tab components + profile pages. Reverting the commit restores the previous non-interactive thread list view.

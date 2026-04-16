# `ui-9` — Per-contact Conversation view (cross-thread flattened history) — Brief

> **Pre-compiled at UI-8 G12 close-out per AUTONOMY_PROTOCOL.md §G11.b.**
> Read this brief. Do **not** read all 21 specs. If any precondition in §7 is missing, stop (G1).

**Wave:** 10 (Unified Inbox 9 of 13)
**Type:** UI + light query
**Size:** medium — single new surface, one new query helper, reuses UI-8's thread-detail slot. Voice-treated empty state for fresh contacts. No new LLM calls, no new migration, no motion slot spend.
**Model tier:** `/deep` (Opus) — voice-treated + cross-thread flattening logic + channel-icon variation + motion wiring from the contact-name link position. Sonnet-safe would ship a generic "all threads" list instead of the collapsible-per-thread flattened timeline §4.2 describes.
**Spec:** `docs/specs/unified-inbox.md` §4.2 (Per-contact Conversation view), §8.2 (no automatic merging), §8.3 (the authoritative query), §16 disciplines (#60 non-clobber stays in effect — the Conversation view can't sit on top of a dirty composer and clobber it).
**Precedent:**
- `sessions/ui-1-handoff.md` — Graph sync layer. Threads + messages UI-9 reads from.
- `sessions/ui-2-handoff.md` — Inbound router. `threads.contact_id` is the join key.
- `sessions/ui-4-handoff.md` — Signal/noise classifier. Priority/keep_until drive collapsed-vs-expanded default in the flattened list.
- `sessions/ui-8-handoff.md` — **Direct precedent.** UI-9 replaces the `aria-disabled` contact-name placeholder in `thread-detail.tsx`; reuses `readThread()` / `listThreads()` / the three-column shell; inherits motion conventions (`houseSpring`, `layoutId` patterns).

UI-9 is the "give me the full relationship" cognitive mode. Andy clicks a contact's name anywhere and the thread-detail column takes over with a flat chronological view across **every** thread with that contact — collapsible per thread, channel icons distinguishing email from portal chat from task feedback. Read-only for navigation — to reply, Andy clicks into the specific thread.

---

## 1. Identity

- **Session id:** `ui-9`
- **Wave:** 10 — Unified Inbox (9 of 13)
- **Type:** UI + light query
- **Model tier:** `/deep` (Opus)
- **Sonnet-safe:** no — voice-treated cross-contact empties + per-thread collapsible semantics + layoutId animation from UI-8's contact-name link would both regress on `/quick`.
- **Estimated context:** medium — reads UI-8 handoff (direct precedent), spec §4.2 / §8.2 / §8.3, and touches the thread-detail component + one new query helper. No schema change.

## 2. Spec references (summarised — don't reread unless ambiguity arises)

- **§4.2 Per-contact Conversation view** — authoritative shape.
  - Activated by clicking the contact's name anywhere. Takes over the thread detail column.
  - Flattens all of that contact's threads chronologically into one scroll.
  - Each thread in the flattened view is collapsible (default expanded if unread, collapsed if read).
  - Channel icons distinguish email / portal chat / task feedback.
  - **Read-only for navigation** — to reply, click into a specific thread.
- **§8.2 No automatic merging** — a portal chat thread and an email thread are separate thread records. Conversation view is the relationship-level nav surface; topic-level nav stays scoped to individual threads. Manual-merge is out-of-scope for UI-9 (deferred PATCHES_OWED; separate session).
- **§8.3 Conversation view query** — authoritative SQL:
  ```sql
  SELECT m.*
  FROM messages m
  JOIN threads t ON m.thread_id = t.id
  WHERE t.contact_id = :contact_id
  ORDER BY m.sent_at ASC
  ```
  One query, cross-channel, chronological. Client Context Engine reads the same way — stay aligned so CCE-1 can reuse the helper.
- **§16 disciplines applicable to UI-9:**
  - **#60 — draft invalidation protects in-progress edits.** If Andy has an in-progress reply in UI-8's composer and then opens Conversation view, the composer should *preserve* his edit state on return, not reset. This means the Conversation view replaces the thread-detail render but doesn't unmount the composer state tree — or it unmounts and the dirty body is lifted to a parent cache.
  - **#63 — noise classifier errs conservative.** In the flattened view, noise-classified messages collapse by default; signal stays expanded. The flag is a hint, not a warning — no red.

## 3. Acceptance criteria

```
§4.2: Clicking a contact's name anywhere (thread-detail header in UI-8,
eventually from CCE / Pipeline cards) opens Conversation view in the
thread-detail column — flattened chronological list of ALL messages
across ALL of that contact's threads. Each thread in the flattened list
is collapsible. Default collapse state: expanded if the thread has unread
messages, collapsed if fully read. Channel icons per thread.

§8.2: Threads remain separate records (no auto-merge). Conversation view
is navigation-only; clicking a thread's header in the flattened view
navigates back to UI-8's thread-detail for that thread.

§8.3: The authoritative SQL runs via a new query helper
`listConversation(contactId)` that returns `{ contact, company, threads:
[{ thread, messages[] }] }` grouped by thread, with messages
chronological within and threads ordered by their latest message.

§16 #60: Opening Conversation view from a thread with a dirty composer
preserves the unsent body. Navigating back to the thread restores the
dirty body (not a re-hydrated cached draft).
```

## 4. Files in play

**Create:**
- `app/lite/inbox/_queries/list-conversation.ts` — server query helper. Runs the §8.3 SQL, groups by thread, hydrates contact + company, returns `{ contact, company, threads: [{ thread, messages[] }] }`.
- `app/lite/inbox/_components/conversation-view.tsx` — client component; renders the flattened collapsible view. Default collapse state: expanded if `thread.unread_count > 0`, collapsed if all read. Channel icon per thread header. Click-a-thread-header navigates back to `/lite/inbox?thread=<id>`.
- `tests/inbox-list-conversation-query.test.ts` — ~6 tests. Empty contact, single-thread, multi-thread, ordering (threads by last-message-at descending, messages chronological within), channel-icon data in payload, fully-read contact (all collapsed default).
- `tests/inbox-conversation-view.test.tsx` — ~4 tests. `renderToStaticMarkup` + mocked data. Empty state voice; thread header with channel icon; collapsed vs expanded default; clickable thread header links to `?thread=<id>`.

**Edit:**
- `app/lite/inbox/_components/thread-detail.tsx` — remove `aria-disabled` on contact-name link; wire it to toggle Conversation view (either via a new `?view=conversation&contactId=<id>` query param or via internal panel state — lock at G1 based on composer-state-preservation design).
- `app/lite/inbox/page.tsx` — detect conversation-view mode; render `<ConversationView>` in the thread-detail slot when active; preserve any dirty composer state.
- `app/lite/inbox/_components/inbox-shell.tsx` — may need to pass conversation-view state down; or treat as thread-detail-column-local state.

**Must not touch:**
- `lib/graph/sync.ts`, `lib/graph/draft-reply.ts`, `lib/graph/compose-draft.ts`, `lib/graph/refine-draft.ts`, `lib/graph/compose-send.ts` (all library layer done in UI-1/4/5/6/7).
- `app/lite/inbox/compose/actions.ts` (server actions stay frozen).
- Any schema file (`lib/db/schema/*`).
- `app/lite/inbox/_components/reply-composer.tsx` except to lift dirty state upward if that's how we preserve it — revisit in implementation.
- Mobile surface (`mobile-holding.tsx`) — UI-11.
- Support ticket overlay (§4.3) — UI-10.

## 5. Tests to write

- `tests/inbox-list-conversation-query.test.ts` — 6 tests. Per-file SQLite DB `tests/.test-inbox-list-conversation-query.db`. Seed contact + 2 threads + 5 messages across them; assert payload shape + ordering + ignore-soft-deleted + unknown-contact-id → null.
- `tests/inbox-conversation-view.test.tsx` — 4 tests. `renderToStaticMarkup`. Mocked payload; assert empty state voice, channel icon presence per thread, default-collapsed on all-read / default-expanded on unread, thread-header link href.

## 6. Voice surfaces

- **Empty-contact Conversation view:** "First time you've spoken. Nothing to look back on yet." (brief authors; Andy can swap.)
- **Fully-read Conversation view header:** a small micro-text "All caught up across N threads." above the list (brand-narrative italics).
- **Thread-header collapse toggle tooltip:** none; use the standard chevron affordance — every state change animates per `feedback_motion_is_universal`.

## 7. Preconditions to verify at G1

- [ ] `listThreads({ contactId })` callable with contact filter — verify in `_queries/list-threads.ts`.
- [ ] `readThread(threadId)` returns messages ordered by `created_at_ms` — UI-9 may or may not reuse depending on query shape.
- [ ] `threads.contact_id` + `messages.thread_id` indexes exist — check migrations.
- [ ] UI-8's `thread-detail.tsx` contact-name placeholder is `aria-disabled` with tooltip "coming in UI-9" — replace, don't duplicate.
- [ ] `messages.deleted_at_ms` soft-delete filter applies in the new query.
- [ ] No Wave-10 LLM prompt slug needed — UI-9 makes zero LLM calls.
- [ ] Motion conventions: `houseSpring`, `useReducedMotion` available.
- [ ] `layoutId="inbox-nav-active"` already in use in UI-8 — Conversation view reveal can claim a sibling `layoutId="inbox-conversation-panel"` if the animation needs it.

## 8. Kill switches + rollback

- No new kill switch. Conversation view is pure-read UI over existing schema.
- Rollback = `git revert` or re-disable the contact-name link with the UI-8 placeholder pattern.

## 9. Gates that apply

- G0 — read this brief + UI-8 handoff.
- G1 — verify §7 preconditions.
- G2 — files-in-play match §4 whitelist.
- G3 — Tier-1 motion only (`houseSpring`, `AnimatePresence` for collapse toggle, `layoutId` for reveal if used).
- G4 — no new structural constants expected; if per-thread collapse state lives in a Map, make the cap a local const (unlikely needed).
- G5 — context budget held; do not roll in CCE surface work.
- G6 — no schema, no migration, no kill switch.
- G7 — 0 TS errors, full suite green, clean build, lint unchanged.
- G8 — `npx tsc --noEmit` + `npm test` + `npm run build` + `npm run lint`.
- G9 — UI-8's composer state preservation must not regress. Verify: dirty composer in thread-detail, open Conversation view, close back to same thread — dirty body still there.
- G10 — manual browser verify: contact-name click opens Conversation view; empty contact shows voice empty state; multi-thread contact shows collapsed/expanded defaults per spec; clicking a thread header navigates back; composer dirty state preserved across the open/close.
- G10.5 — external `general-purpose` reviewer against this brief + §4.2 + §8.2 + §8.3 + §16 #60.
- G11 — handoff note; UI-10 brief pre-compile.
- G12 — tracker flip + CLOSURE_LOG + PATCHES_OWED append + commit.

## 10. Notes for the next-session brief writer (UI-10)

UI-10 is the Support@ ticket overlay (spec §4.3) — type chip, status pill, Close-ticket action, customer-context collapsible panel. UI-9 lands the Conversation view and must **not** conflate the two surfaces. UI-10 also inherits the attachment upload + calendar invite RSVP wiring that UI-8 stubbed out (`ui_8_attachments_and_calendar_stubs` in PATCHES_OWED). When writing UI-10's brief:

- Cite `docs/specs/unified-inbox.md` §4.3 verbatim for the ticket overlay shape.
- Confirm the `support_tickets` table lives where Phase 3.5 placed it (likely `lib/db/schema/support-tickets.ts` — verify at G1).
- Call out the `inbox_calendar_rsvp_todo` stub activity UI-8 emits — UI-10 replaces with real RSVP wiring.
- Reference the UI-9 handoff for the Conversation view surface; the ticket overlay sits **on top of** the single-thread detail, not on top of the Conversation view.
- Voice surfaces: "Resolved" pill copy, customer-context panel intro line, Close-ticket confirmation toast.

## 11. Memory-alignment checklist for the build session

- `feedback_technical_decisions_claude_calls` — lock all implementation choices silently.
- `feedback_motion_is_universal` — collapse toggle + reveal animate.
- `feedback_visual_references_binding` — use `var(--color-*)` / `var(--font-*)` tokens; no raw values.
- `feedback_individual_feel` — Conversation view is "your relationship with this person", not a generic timeline.
- `feedback_primary_action_focus` — Conversation view is read-only; no primary action to clutter.
- `feedback_no_content_authoring` — voice copy inline in components, short and in-voice.
- `project_two_perpetual_contexts` — §8.3 SQL is shared with CCE; if a CCE helper already exists, reuse.
- `project_context_safety_conventions` — client-component bundler isolation; query helpers server-only.
- `project_external_reviewer_gate` — run G10.5 before G11.

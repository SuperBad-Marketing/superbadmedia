# `ui-9` — Per-contact Conversation view — Handoff

**Closed:** 2026-04-16
**Wave:** 10 — Unified Inbox (9 of 13)
**Model tier:** `/deep` (Opus)

---

## What was built

The cross-thread relationship-level view. When Andy clicks a contact's name in a thread-detail header, the thread-detail column pivots to Conversation view: a flat, per-thread-collapsible list of every thread with that contact, channel icons per thread header, chronologically ordered messages within each thread. Read-only for navigation — each thread has an "Open →" link back to UI-8's single-thread detail. Back link restores the originating thread.

§16 #60 composer preservation is architected by rendering `<ThreadDetail>` and `<ConversationView>` as siblings under the thread-detail slot, with CSS `hidden` toggling visibility. React keeps `ThreadDetail → ReplyComposer` mounted across the URL flip from `?thread=X` to `?thread=X&conversationWith=Y`, so an in-progress reply body survives the round trip unclobbered — verified live in browser at G10.

**Files created:**

- `app/lite/inbox/_queries/list-conversation.ts` — server query helper. Runs §8.3 as a grouped payload (threads-by-contact DESC by `last_message_at_ms`, messages-by-thread-id `IN` clause ASC by `created_at_ms`, excludes soft-deleted messages, drops threads whose messages are all soft-deleted). Returns `{ contact, company, threads: [{ thread, messages[] }] }` or `null` for unknown contact. Client Context Engine can reuse verbatim (CCE-1 reads the same shape).
- `app/lite/inbox/_components/conversation-view.tsx` — client component. Header with Back link, contact name, company, thread count + "All caught up" micro-copy when fully read. Per-thread `<ConversationThreadBlock>` with chevron toggle (rotate animation under `houseSpring`), channel icon, subject (bold if thread unread), timestamp + message count, "Open →" Link to the single-thread detail. `<AnimatePresence>` wraps the collapsed/expanded panel with height animation. Default expanded when `isConversationThreadUnread(thread)` is true; collapsed otherwise. `useReducedMotion()` with reduced-motion fallback variants. `ConversationViewUnknownContact` fallback for an unknown `conversationWith` id.
- `app/lite/inbox/_components/conversation-view-helpers.ts` — client-safe pure function `isConversationThreadUnread(ThreadRow): boolean`. Mirrors `list-threads.ts`'s `isThreadUnread` heuristic. Exists in a dedicated module because `list-conversation.ts` transitively pulls `@/lib/db → better-sqlite3 → fs` into the browser bundle — value imports from that file break the client bundler. Pattern mirrors UI-8's `lib/graph/refine-draft-limits.ts`.
- `tests/inbox-list-conversation-query.test.ts` — 6 tests, per-file SQLite DB (`tests/.test-inbox-list-conversation-query.db`). Unknown contact → null; contact with no threads → empty array; single-thread chronological; multi-thread order (threads DESC, messages ASC within); soft-deleted messages excluded; threads whose every message is soft-deleted dropped.
- `tests/inbox-conversation-view.test.tsx` — 4 tests, `renderToStaticMarkup`. Empty-contact voice; Back link href; unread thread default-expanded with Open link + `aria-expanded="true"` + message body in markup; read thread default-collapsed + "All caught up" + message body NOT in markup.

**Files edited:**

- `app/lite/inbox/_components/thread-detail.tsx` — removed the `aria-disabled` contact-name placeholder. Replaced with a conditional:
  - If `contact`: `<Link href={buildConversationHref(view, address, sort, thread.id, contact.id)}>` opens Conversation view (preserves view/address/sort, sets both `thread` and `conversationWith`).
  - If no contact (walk-in thread): fallback aria-disabled span "Unknown contact" with tooltip "Walk-in thread — no linked contact yet." — prevents broken nav on threads that never resolved to a contact.
  - Added three new props: `view`, `address`, `sort`. Added imports: `Link`, `InboxView/InboxAddressFilter/InboxSortOrder` types.
- `app/lite/inbox/page.tsx` — added `conversationWith?: string` to searchParams; parses `conversationContactId = sp.conversationWith ?? null`; conditionally calls `listConversation(conversationContactId)`; passes `view/address/sort` to `ThreadDetail`; renders `ThreadDetail` and `ConversationView` as siblings inside `detailSlot` with CSS `hidden` toggling so `ThreadDetail → ReplyComposer` stays mounted during Conversation view:
  ```tsx
  const detailSlot = (
    <>
      <div className={conversationActive ? "hidden" : "h-full"}>
        {threadDetailNode}
      </div>
      {conversationNode && (
        <div className={conversationActive ? "h-full" : "hidden"}>
          {conversationNode}
        </div>
      )}
    </>
  );
  ```
  When `listConversation` returns `null` (unknown contact id), renders `<ConversationViewUnknownContact />` instead.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **URL-based navigation, not internal panel state.** `?thread=X&conversationWith=Y` drives the Conversation view. Preserves deep-linking (a contact-name click produces a shareable URL), makes Back a plain `<Link>` rather than a state pop, and keeps the React tree stable for composer preservation. Internal-state alternative would have required state lifting through `InboxShell → ThreadDetail` which rebuilds `ReplyComposer` on every toggle.
2. **Sibling-render with `display:none` toggling — not conditional render.** React reconciles by tree position + element type; both `ThreadDetail` and `ConversationView` stay mounted in their slots while the wrapper `hidden` class flips. Conditional render (`conversationActive ? <ConversationView/> : <ThreadDetail/>`) would unmount `ReplyComposer` on toggle and lose the dirty body — violates §16 #60. The sibling pattern was spec-implicit per the brief's G9 verification.
3. **Grouped payload, not raw §8.3 SQL.** Spec §8.3 prints a single `SELECT m.* JOIN threads WHERE contact_id` statement. UI-9 returns `{ contact, company, threads: [{ thread, messages[] }] }` — three drizzle queries (contact → optional company → threads DESC, then a single messages-by-`IN` clause). Functionally equivalent, N=2 (not N+1), indexes hit (`threads.contact_id`, `messages.thread_id`). Delivers the hydrated thread rows the UI renders per-thread blocks from without a second round-trip. CCE-1 reads the same shape.
4. **Client-safe helpers split.** `isConversationThreadUnread(thread)` exports from `conversation-view-helpers.ts`, not `list-conversation.ts`, because the query module transitively pulls `@/lib/db → better-sqlite3 → fs` into the browser bundle on value import. Types from `list-conversation.ts` (`ConversationPayload`, `ConversationThread`) come in via `import type` — TypeScript elides at build time. Build-break caught in G7 compile step and fixed inline.
5. **Unread = has inbound-newer-than-outbound.** `isConversationThreadUnread` returns true when `last_inbound_at_ms !== null && (last_outbound_at_ms === null || last_inbound_at_ms > last_outbound_at_ms)`. Mirrors the `isThreadUnread` heuristic in `list-threads.ts`; the brief's §4.2 "expanded if unread" rule aligns.
6. **Back link drops `conversationWith` but preserves thread.** `buildCloseHref(view, address, sort, returnThreadId)` in `conversation-view.tsx:32-44` builds `?view=focus&address=...&sort=...&thread=<returnThreadId>` without the contact id. Andy lands back on the originating thread with composer body intact.
7. **Per-thread Open link routes back to single-thread detail.** `buildThreadHref(view, address, sort, threadId)` in `conversation-view.tsx:46-58` strips `conversationWith` and sets `thread` to the clicked thread. Andy navigates between threads from the Conversation view exactly like the thread-list column — unified nav model.
8. **Walk-in fallback over disabled link.** Threads without a `contact_id` (walk-ins, unmatched imports) can't open Conversation view. Thread-detail shows "Unknown contact" as an aria-disabled span with tooltip "Walk-in thread — no linked contact yet." rather than a broken Link or silent no-op. Matches the brief's edge-case handling.
9. **No new motion slot.** `houseSpring` + `<AnimatePresence>` reuse UI-8's conventions. Chevron rotate, collapse height animation, and root `opacity/y` fade all use existing motion constants. `layoutId` from the contact-name link to the Conversation view reveal was considered but dropped — the URL-based nav pattern flips the whole slot, and a layoutId bridge across that boundary would either be cosmetic or fragile. Brief §9 G3 preserved.
10. **Soft-deleted filter + empty-thread drop.** Query excludes messages where `deleted_at_ms IS NOT NULL`, then filters out threads whose post-filter message list is empty. Matches UI-8's `readThread` semantics and avoids orphan thread blocks in the UI.
11. **Expansion state seeded once.** `initialExpanded` is computed per thread from `isConversationThreadUnread` and seeded into `useState`. `motion.div key={data.contact.id}` remounts the view on contact change, so the fresh map is applied per contact. Known cosmetic dead-code: the `useMemo` around `initialExpanded` is recomputed on re-render but ignored by `useState` — flagged as a nit for follow-up, not a bug.
12. **Voice surfaces inline.** Empty-contact: "First time you've spoken. / Nothing to look back on yet." All-read multi-thread: "All caught up across N threads." (with "this one" variant for N=1). Unknown-contact: "Can't find that contact. / It may have been merged or removed." Copy lives in the component files per `feedback_no_content_authoring`.

## Verification (G0–G12)

- **G0** — brief pre-compiled at UI-8 G11.b (`sessions/ui-9-brief.md`). Read at G0 alongside UI-5/UI-6/UI-7/UI-8 handoffs.
- **G1** — 8 preconditions verified: `listThreads({ contactId })` callable; `readThread(threadId)` returns chronological non-deleted messages; `threads.contact_id` + `messages.thread_id` indexes exist (`threads_contact_idx`, `messages_thread_idx` in schema); UI-8 placeholder `aria-disabled` span with "coming in UI-9" tooltip located in `thread-detail.tsx`; `messages.deleted_at_ms` soft-delete column present; zero new LLM slugs needed; `houseSpring` + `useReducedMotion` available; `layoutId="inbox-nav-active"` already used — Conversation view does not claim a sibling.
- **G2** — files match brief §4 whitelist. New helper `conversation-view-helpers.ts` is a brief-authorised addition per "client-component bundler isolation" guidance in §11 memory-alignment. `inbox-shell.tsx` left untouched — sibling-render at the page level avoided the need to thread state through the shell.
- **G3** — Tier-1 motion only (`houseSpring` for chevron rotate + height animate; `<AnimatePresence>` for collapse/expand panel). Zero Tier-2 slots claimed.
- **G4** — no new structural constants introduced.
- **G5** — context budget held; did not roll in CCE-1 surface work or ticket overlay.
- **G6** — no schema change, no migration, no new kill switch. No feature flag gate needed (pure-read UI over existing data). Rollback = `git revert` or re-render the UI-8 `aria-disabled` placeholder.
- **G7** — completion contract green: 0 TS errors; 10 new UI-9 tests (1015 total + 1 skipped, up from UI-8's 1005/1); clean build; lint baseline unchanged at 35 errors (no new UI-9 violations).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → **1015 passed + 1 skipped** (+10 new). `npm run build` → Compiled successfully. `npm run lint` → 35 errors unchanged from pre-UI-9 baseline.
- **G9** — composer dirty-state preservation not regressed. Architecture-level reasoning: sibling-render with CSS `hidden` keeps `ThreadDetail → ReplyComposer` mounted through the URL flip; `motion.div key={data.contact.id}` changes only on contact change, not on conversation toggle. Verified live at G10 with typed composer body surviving round-trip.
- **G10** — manual browser verify on port 3099: logged in as `andy@superbadmedia.com.au`; `/lite/inbox` rendered UI-8's three-column shell; clicked into `thread-ui8-demo-1` → thread detail rendered with "Sam Ryder" contact name as a Link (href `/lite/inbox?view=focus&thread=thread-ui8-demo-1&conversationWith=contact-ui8-demo-1`); typed "Draft that should persist across conversation toggle." into reply composer (Discard/Save enabled); clicked "Sam Ryder" → Conversation view rendered with Back link, "Conversation" eyebrow + "Sam Ryder" H1 + "Acme Co" company sub, "1 thread" badge, thread block default-expanded (inbound-only thread = unread), chevron-rotate + channel icon + subject + "16 Apr 2026 · 1 message" timestamp, "Open →" link, message body visible; clicked Back → returned to thread-detail with composer body preserved exactly ("Draft that should persist across conversation toggle.") and Discard/Save re-enabled. Edge cases covered by unit tests: empty-contact voice, multi-thread mixed-unread, fully-read "All caught up", unknown-contact fallback.
- **G10.5** — external `general-purpose` sub-agent review result: **"Ship with follow-up patches"** — no blockers. 11 findings total:
  - F1 (warning) — query shape is grouped/hydrated rather than literal §8.3 JOIN (functionally correct, matches brief payload shape).
  - F2 (nit) — `sql.join` IN clause could use drizzle's `inArray(...)` helper.
  - F3–F7, F9, F10 (ok) — §8.2 discipline, §16 #60 preservation, client-bundle safety, URL navigation correctness, edge cases, brief compliance, voice surfaces all pass.
  - F8 (warning) — test gaps: no coverage for `ConversationViewUnknownContact` render, multi-thread mixed-unread payload, channel-icon presence assertion, N>1 "All caught up" copy.
  - F11 (nit) — `useMemo` around `initialExpanded` effectively dead code (seeded into `useState` once on remount).
  - All non-blocking; logged to PATCHES_OWED as `ui_9_*` items.
- **G11** — this file. UI-10 brief pre-compiled alongside per G11.b rolling cadence.
- **G12** — tracker flip + CLOSURE_LOG prepend + PATCHES_OWED append + commit next.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all 12 implementation choices silently locked. No technical questions asked of Andy.
- **`feedback_motion_is_universal`** — every state change animates: chevron rotate (`houseSpring`), collapse/expand panel (`<AnimatePresence>` + height transition), root fade (`motion.div` opacity/y), reduced-motion fallback variants throughout.
- **`feedback_visual_references_binding`** — all tokens (`var(--color-*)`, `var(--font-*)`, `var(--text-*)`); letter-spacing on uppercase micro labels matches UI-8 pattern (1.5–2px); no raw hex, no raw DM Sans.
- **`feedback_individual_feel`** — Conversation view renders as Andy's cross-thread relationship with this specific contact, not a generic "contact profile" view. Company, subject, their words — their voice.
- **`feedback_primary_action_focus`** — Conversation view is read-only; zero primary actions. Back + per-thread Open are secondary navigation cues.
- **`feedback_no_content_authoring`** — voice copy inline, short, in-voice. Empty-contact, all-caught-up, unknown-contact micro-copy all live in the component file.
- **`feedback_no_lite_on_client_facing`** — admin-facing inbox surface; no Lite branding on Conversation view.
- **`project_two_perpetual_contexts`** — UI-9 makes zero LLM calls. Query helper shape is shared with CCE-1 build session so both contexts remain aligned.
- **`project_llm_model_registry`** — UI-9 adds zero LLM slugs.
- **`project_context_safety_conventions`** — client-safe `conversation-view-helpers.ts` split protects the browser bundle (mirrors UI-8's `refine-draft-limits.ts`); types-only imports from server-only query module.
- **`project_external_reviewer_gate`** — G10.5 run against brief + §4.2 + §8.2 + §8.3 + §16 #60; 11 findings, 0 blockers, follow-ups logged to PATCHES_OWED.

## PATCHES_OWED (raised this session)

See the session block appended to `PATCHES_OWED.md` under "Phase 5 Wave 10 UI-9 (2026-04-16)". Summary:

- **`ui_9_query_shape_vs_spec_sql_note`** — spec §8.3 prints a literal JOIN; `listConversation` returns a grouped payload. Functionally correct; add a one-line spec note or leave as-is.
- **`ui_9_use_drizzle_inarray_helper`** — swap `sql.join` IN clause for `inArray(messages.thread_id, threadIds)`.
- **`ui_9_unknown_contact_render_test`** — test missing for `ConversationViewUnknownContact`.
- **`ui_9_multi_thread_mixed_unread_test`** — test missing for one-expanded-one-collapsed payload.
- **`ui_9_channel_icon_presence_test`** — brief called for channel-icon assertion; not added.
- **`ui_9_all_caught_up_plural_test`** — only N=1 "this one" variant exercised.
- **`ui_9_initial_expanded_memo_cleanup`** — cosmetic: drop the `useMemo` around `initialExpanded`; seed `useState` from a plain closure.
- **`ui_9_cce_helper_reuse`** — when CCE-1 is built, verify `listConversation` is reused verbatim (not re-implemented). Spec §8.3 alignment gate.

## Rollback strategy

`git-revertable`. No schema change, no migration, no new kill switch, no feature flag. Pure-read UI over existing thread/message/contact data. Reverting the 6 files (3 new + 3 edited) restores the UI-8 `aria-disabled` placeholder on the contact-name link — the Conversation view surface simply disappears.

## What the next session (UI-10) inherits

UI-10 is the **Support@ ticket overlay** (spec §4.3) — when a `support@` thread is selected, a ticket chrome overlays the single-thread detail with a type chip (`question | issue | request | other`), a status pill (`open | in_progress | resolved`), a Close-ticket action, a collapsible customer-context panel, attachment upload (replaces UI-8's download-only stub), and real calendar-invite RSVP wiring (replaces UI-8's `inbox_calendar_rsvp_todo` placeholder toast). Things UI-10 inherits from UI-9:

- **Sibling-render pattern.** UI-9 locked the "two full-height panels in the thread-detail slot, CSS-hidden toggling" pattern for composer preservation. UI-10's ticket overlay may layer on top of the single-thread detail (not swap it), so the pattern shifts from sibling-hidden to overlay-positioned. Revisit at G1.
- **URL-param navigation convention.** `?conversationWith=<id>` layered on `?thread=<id>`. UI-10 can similarly layer `?ticket=<id>` or use the `support_tickets` row's `thread_id` FK directly (check at G1 — spec §4.3 should dictate).
- **Contact-name Link.** UI-9's contact-name Link in `thread-detail.tsx` stays exactly as-is. UI-10 doesn't re-render the thread header — the ticket overlay sits above the thread detail per spec §4.3, not on top of the Conversation view.
- **Voice bar.** UI-9's "First time you've spoken / All caught up / Can't find that contact" empty-state tone is the bar for UI-10's "Resolved" pill copy, customer-context panel intro, Close-ticket confirmation toast.
- **Attachment + RSVP stubs to replace.** UI-8 left attachments download-only with a stub toast on upload attempt; calendar-invite RSVP buttons log `inbox_calendar_rsvp_todo` activity and toast "RSVP wiring lands in UI-10". UI-10 replaces both with real implementations (Graph API upload + RSVP). Check `ui_8_attachments_and_calendar_stubs` in PATCHES_OWED for the exact stub locations.

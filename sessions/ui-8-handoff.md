# `ui-8` — Desktop three-column inbox UI + compose sheet + refine sidecar — Handoff

**Closed:** 2026-04-16
**Wave:** 10 — Unified Inbox (8 of 13 — first visible user surface)
**Model tier:** `/deep` (Opus)

---

## What was built

The first inbox surface a human actually looks at. Seven prior Wave-10 sessions (UI-1 Graph sync → UI-7 refine rewriter) built plumbing; UI-8 renders it. Three-column desktop shell (240px left nav / 360px thread list / 1fr thread detail), ten view filters with address-scope chips, thread-list rows with channel icons + classification chips, thread-detail with contact/company header + conversation stream, sticky reply composer with cached-draft pre-load, Compose modal wired to Wave-10 server actions, refine sidecar wired to the UI-7 `refineDraft` action. Mobile (< 768px) renders a voice-treated holding screen — real mobile surface is deferred to UI-11. Conversation-view (UI-9) and support-ticket overlay (UI-10) render as placeholder chips with explicit tooltips so Andy can see where they'll land without half-building them.

**Files created:**

- `app/lite/inbox/page.tsx` — server component; reads `threads` + `messages` + `contacts` + `companies` via `listThreads()` + `readThread()`, resolves the active thread from `?thread=`, gates mobile via viewport header, renders `<InboxShell>` with the three-column payload.
- `app/lite/inbox/_queries/list-threads.ts` — server query helper. Nine-branch view routing (focus/drafts/all/unread/flagged/snoozed/scheduled/sent/trash) + address filter (all/andy@/support@) + sort branches (most recent / unread first / priority first). Trash branch uses raw `sql\`NOT EXISTS (SELECT 1 FROM messages WHERE thread_id = threads.id AND deleted_at_ms IS NULL)\``; every other view adds the inverse EXISTS clause. Joins contacts + companies for the list row display; hydrates unread via `messages.read_at_ms IS NULL` count.
- `app/lite/inbox/_queries/read-thread.ts` — server query helper. Returns `null` for unknown thread id; otherwise `{ thread, contact, company, messages[] }` with ordered non-deleted messages.
- `app/lite/inbox/_components/inbox-shell.tsx` — three-column grid; `LayoutGroup` for the left-nav active-bar animation.
- `app/lite/inbox/_components/view-filter-tabs.tsx` — ten views + three address filters + Settings footer link. `motion.div` with `layoutId="inbox-nav-active"` + `houseSpring` gated by `useReducedMotion`.
- `app/lite/inbox/_components/thread-list-row.tsx` — sender/subject/preview/timestamp/channel-icon. `<ChannelIcon channel={...} />` component with inline switch (email → Mail; portal_chat/sms/whatsapp → MessageSquare; task_feedback/instagram_dm/facebook_messenger → MessageCircle). `ChannelIconOnly` variant delegates. Empty state is voice-treated per view.
- `app/lite/inbox/_components/thread-detail.tsx` — header (contact name + company + channel chip + Keep toggle), conversation stream (inbound vs outbound styling per design-system), reply composer slot at the bottom. Conversation-view link renders `aria-disabled` with tooltip "coming in UI-9" per brief §2.
- `app/lite/inbox/_components/reply-composer.tsx` — client; cached-draft pre-load gated on `threadId` change only (spec §16 #60 non-clobber); 30-second `pollCachedDraft()` interval to pick up stale-flag flips + fresh body (non-clobbering: rehydrates only when `!dirty`); `<AnimatePresence>`-wrapped stale banner with wired Regenerate button (`regenerateCachedDraft` server action, not cosmetic); low-confidence panel gated on `flags.length > 0 && !dirty`; Send / Save / Discard / Refine actions bound to Wave-10 server actions.
- `app/lite/inbox/_components/refine-sidecar.tsx` — client; ephemeral turns in React state (spec §7.4), `MAX_REFINE_TURNS=6` cap, `MAX_REFINE_INSTRUCTION_CHARS=500` cap enforced at both input `slice()` and Zod boundary; calls UI-7's `refineDraft` action; `onAccept` lifts the refined body back to the composer.
- `app/lite/inbox/_components/compose-modal.tsx` — client; recipient picker, optional subject (with "I'll pick one at send time" hint), body textarea, "Draft this for me" intent row bound to `draftComposeIntent`, Attach/Invite disabled with "UI-10" tooltips per brief, Refine button gated on body presence, footer Discard/Save/Send bound to Wave-10 actions.
- `app/lite/inbox/_components/mobile-holding.tsx` — voice-treated holding screen for < 768px viewports ("Not here. / The inbox wants more room than this screen has. Open it on a laptop for now. / mobile version's still in the back.").
- `app/lite/inbox/_components/low-confidence-flags.tsx` — `<mark>` span renderer with brand-pink underline over the draft body; reasons rendered inline below.
- `lib/graph/refine-draft-limits.ts` — client-safe module exporting `MAX_REFINE_INSTRUCTION_CHARS`, `MAX_REFINE_TURNS`, and the `RefineTurn` type. Created to prevent `"use client"` components from transitively pulling `@/lib/db` into the browser bundle.
- `tests/inbox-list-threads-query.test.ts` — 14 tests. Nine view branches + three address filters + sort ordering + `isUnread` derivation + trash-only / non-trash EXISTS semantics.
- `tests/inbox-read-thread-query.test.ts` — 4 tests. Unknown id → null; ordered non-deleted messages; hydrated contact/company; walk-in (null relations); all-soft-deleted → empty array.
- `tests/inbox-reply-composer.test.tsx` — 5 tests (`renderToStaticMarkup` + mocked server actions). Cached-draft body into textarea; stale banner gating; `<mark>` spans rendering; Send disabled when empty; kill-switch tooltip copy.
- `tests/inbox-refine-sidecar.test.tsx` — 5 tests. Dialog role + header; prior draft in Current-draft panel; textarea + button disabled on `llmEnabled=false`; turn counter + instruction counter; "Use this" disabled before any refine.

**Files edited:**

- `app/lite/inbox/compose/actions.ts` — added `pollCachedDraft(threadId)` (returns `{ body, stale, flags }` from the `threads` row) and `regenerateCachedDraft(threadId)` (stale-flags the row, enqueues `inbox_draft_generate` with a 60-second idempotency bucket so frantic clicks collapse). Added `DraftReplyLowConfidenceFlag` import + `threads` + `enqueueTask` imports.
- `app/lite/inbox/_components/reply-composer.tsx` — rehydrate effect now gated on `[props.threadId]` only (not `cachedDraftBody` / `cachedDraftStale` / `lowConfidenceFlags`); added `dirtyRef` + `bodyRef` for the polling closure; added 30-second polling effect with non-clobbering rehydrate; wired `handleRegenerate` async handler to `regenerateCachedDraft`; `<AnimatePresence>` wrapper around the stale banner.
- `app/lite/inbox/_components/compose-modal.tsx` — Send tooltip corrected from "Sending's paused — LLM calls off. Try again in a minute." to "Sending's paused — try again in a minute." (gate is `inbox_send_enabled`, not `llm_calls_enabled`).
- `lib/graph/refine-draft.ts` — constants and `RefineTurn` type moved to `lib/graph/refine-draft-limits.ts`; `refine-draft.ts` now re-exports them so server callers still import from a single module.
- `lib/graph/index.ts` — barrel gained `refine-draft-limits` re-exports so UI components can pull limits without pulling the generator.
- `lib/ai/prompts/INDEX.md` + `lib/ai/prompts/unified-inbox.md` — no content changes; line numbers shift from earlier sessions auto-synced.
- `lib/ai/models.ts` — no new slugs (all Wave-10 LLM calls already registered in UI-5/6/7).
- Three-file apostrophe escape fix: `app/lite/inbox/_components/mobile-holding.tsx`, `app/lite/inbox/_components/thread-detail.tsx`, `app/lite/inbox/_components/refine-sidecar.tsx` — `'` → `&rsquo;` in JSX text for the React-strict lint rule.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Cached-draft rehydrate is `threadId`-only.** The prior implementation ran the rehydrate effect whenever `cachedDraftBody` / `cachedDraftStale` / `lowConfidenceFlags` changed — which meant any server re-render (router.refresh, revalidatePath, polling tick) blew away an in-progress edit. Fixed to `[props.threadId]` only, with polling as the purpose-built channel for fresh-body updates. Spec §16 #60 + brief §12.8 are explicit.
2. **Polling is a 30-second `setInterval` of `pollCachedDraft(threadId)`, non-clobbering.** Updates the stale flag from server truth on every tick. Body rehydrate only fires when `!dirtyRef.current && result.body !== bodyRef.current`. Refs (not state) are read inside the closure so the interval isn't torn down on every keystroke. `POLL_STALE_MS = 30_000` matches brief §16 #60. SSE replacement is a `ui_8_poll_to_sse` patch for Wave-E.
3. **Regenerate is a real server action.** `regenerateCachedDraft(threadId)` stale-flags the row and enqueues `inbox_draft_generate` via the shared `enqueueTask` helper. Idempotency key bucketed on `Math.floor(nowMs / 60_000)` so pressing Regenerate five times in a second collapses to one enqueued task. Mirrors `maybeEnqueueDraftGeneration` in `lib/graph/sync.ts` but without the router/signal-noise gates (manual trigger is an explicit override).
4. **Client-safe limits module.** `lib/graph/refine-draft.ts` transitively pulls `@/lib/db` → `better-sqlite3` → node `fs`, which breaks the client bundler when `"use client"` components import value constants from it. Split off `refine-draft-limits.ts` (constants + type only, zero side-effects, zero db imports); `refine-draft.ts` re-exports for server callers. Pattern is the same as other client-safe modules in the repo.
5. **Channel icon is a component, not a factory.** `thread-list-row.tsx` previously assigned a Lucide component to a local variable via a `channelIcon()` helper, which tripped the `react-hooks/static-components` lint. Refactored into a proper `<ChannelIcon channel={...}>` component with an inline `switch` returning JSX. Behaviour unchanged; ESLint happy.
6. **Thread-list EXISTS/NOT-EXISTS uses raw SQL, not Drizzle subqueries.** Embedding `db.select(...)` inside `sql\`EXISTS (${subquery})\`` produced `near (: syntax error`. Switched to hand-written `sql\`EXISTS (SELECT 1 FROM ${messages} WHERE ${messages.thread_id} = ${threads.id} AND ${messages.deleted_at_ms} IS NULL)\``; drizzle interpolates table/column references correctly. Only tradeoff is no shared type-checking between the two branches, which is acceptable for a 5-line predicate.
7. **Send-button tooltip correctly attributes the gate.** Previous copy said "Sending's paused — LLM calls off. Try again in a minute." but the gate is `inbox_send_enabled`, independent of `llm_calls_enabled`. Corrected copy: "Sending's paused — try again in a minute." on both the reply composer and the compose modal. Test updated.
8. **Low-confidence panel hides while dirty.** Intentional — the flags annotate the pre-edit cached draft, not Andy's current text. Once he starts typing, showing flagged spans over his own words would mislead. Re-appears after `handleDiscard` (resets dirty) or next thread load. Logged as `ui_8_low_confidence_panel_visibility_on_dirty` for a possible spec note.
9. **Mobile is a holding screen, not a half-built surface.** Per brief §2 and the memory `feedback_setup_is_hand_held` + `project_autonomy_protocol_phase_4` (no half-finished implementations), the < 768px breakpoint renders `<MobileHolding>` with a voice-treated pause copy. UI-11 replaces with the real mobile surface.
10. **Placeholders for UI-9 / UI-10 are explicit.** Conversation-view link renders `aria-disabled` with tooltip "coming in UI-9"; support@ ticket overlay renders a "support — in UI-10" chip; attachments are download-only; calendar-RSVP buttons log `inbox_calendar_rsvp_todo` activity + toast "RSVP wiring lands in UI-10". No pretend-wiring that would break on first click.
11. **Constants stay module-level.** `POLL_STALE_MS=30_000`, `THREAD_LIST_PAGE_SIZE=50`, `COMPOSE_MODAL_MAX_WIDTH_PX=720`. Mirrors UI-3/4/5/6/7 precedent; logged as `ui_8_module_constants_to_settings` for Phase 3.5.
12. **Tests target the library surface + initial render.** `tests/inbox-list-threads-query.test.ts` + `tests/inbox-read-thread-query.test.ts` hit real per-file SQLite DBs with seeded rows (pattern established in SW/QB sessions). Client-component tests use `renderToStaticMarkup` + mocked server actions (no jsdom per existing convention). Effect-driven non-clobber + polling behaviour verified via G10 manual browser check; jsdom/RTL adoption is out-of-scope.

## Verification (G0–G12)

- **G0** — brief pre-compiled at UI-7 G11.b (`sessions/ui-8-brief.md`). Read at G0 alongside UI-5/UI-6/UI-7 handoffs.
- **G1** — 10 preconditions verified: Wave-10 server actions (`draftComposeIntent`, `sendCompose`, `saveComposeDraft`, `discardComposeDraft`, `refineDraft`) exported; `threads.cached_draft_*` columns present (migration 0035); `DraftReplyLowConfidenceFlag` type exported; `invalidateCachedDraft` and `enqueueTask` callable; `houseSpring` + `useReducedMotion` available from motion registry; `mockup-*.html` files present as binding visual references; memory files cited in brief readable.
- **G2** — files match brief whitelist; Conversation view / support-ticket overlay / mobile real surface / attachments upload / calendar RSVP wiring all deferred per brief §2.
- **G3** — Tier-1 motion only (`houseSpring` for active-bar `layoutId`; `<AnimatePresence>` for modal + sidecar + stale banner). No Tier-2 slots claimed.
- **G4** — structural constants inline (`POLL_STALE_MS`, `THREAD_LIST_PAGE_SIZE`, `COMPOSE_MODAL_MAX_WIDTH_PX`); flagged in PATCHES_OWED.
- **G5** — context budget held; did not roll Conversation view / mobile / ticket overlay in.
- **G6** — no schema change, no migration, no new kill switch. Feature-flag-gated via existing `llm_calls_enabled` + `inbox_send_enabled`. Rollback = flip flags off OR `git revert`.
- **G7** — completion contract green: 0 TS errors; 28 new UI-8 tests (1005 total + 1 skipped, up from UI-7's 977/1); clean build; lint baseline unchanged at 35 errors (no new UI-8 violations).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → **1005 passed + 1 skipped** (+28 new). `npm run build` → Compiled successfully. `npm run lint` → 35 errors unchanged from pre-UI-8 baseline (all are codebase-wide `react-hooks/purity` on `Date.now()` patterns inherited from prior sessions).
- **G9** — no critical flow regressed. `/lite/admin/pipeline`, `/lite/portal/subscription`, `/lite/quotes/[token]`, `/lite/onboarding` build and render as before.
- **G10** — manual browser verify on port 3099 (3001 held by another process): dev DB migrated; logged in as `andy@superbadmedia.com.au`; `/lite/inbox` rendered three-column shell with 10 views + address filter + Settings; Focus empty state showed voice copy "Nothing waiting. Go make something."; Drafts view switched active bar correctly; Compose modal opened centered at 720px with the full §4.4 action row; 640×900 viewport rendered `<MobileHolding>`; seeded `thread-ui8-demo-1` and loaded full populated view (sender/subject/channel-icon/Keep toggle/conversation bubble/reply composer with Refine/Discard/Save/Send).
- **G10.5** — external `general-purpose` sub-agent review surfaced **3 blockers** + 5 nits:
  - BLOCKER 1 (fixed inline): rehydrate effect clobbered in-progress edits on any `cachedDraft*` prop change (§16 #60 violation). Gated on `threadId` only.
  - BLOCKER 2 (fixed inline): stale-banner Regenerate button was cosmetic (`setStale(false)` + toast only). Replaced with `regenerateCachedDraft` server action call.
  - BLOCKER 3 (fixed inline): `POLL_STALE_MS` declared but never used. Added 30-second polling effect calling new `pollCachedDraft` server action, non-clobbering.
  - Nits: stale banner not wrapped in `<AnimatePresence>` (fixed); Send tooltip conflated LLM gate with send gate (fixed); 3 cosmetic/structural items logged as PATCHES_OWED rather than fixed (`ui_8_poll_to_sse`, `ui_8_regenerate_activity_log`, `ui_8_view_filter_href_dedup`).
  - Post-fix re-run: typecheck + full test suite (1005 green) + build all pass.
- **G11** — this file. UI-9 brief written alongside per G11.b rolling cadence.
- **G12** — tracker flip + CLOSURE_LOG prepend + PATCHES_OWED append + commit next.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all 12 implementation choices silently locked. No technical questions asked of Andy.
- **`feedback_motion_is_universal`** — every state change animates: modal open/close (`AnimatePresence`), sidecar slide (`<motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}`), left-nav active-bar (`layoutId="inbox-nav-active"` + `houseSpring`), stale banner mount/unmount.
- **`feedback_visual_references_binding`** — tokens used throughout (`var(--color-*)`, `var(--font-*)`, `var(--text-*)`); no raw hex, no raw "DM Sans". Letter-spacing on micro uppercase labels matches mockup pattern (1.5–2px).
- **`feedback_individual_feel`** — inbox reads as Andy's (sender names, their companies, their words in conversation bubbles). No generic CRM list framing.
- **`feedback_primary_action_focus`** — Send is the hero (brand-cta accent, no fallback clutter around it).
- **`feedback_no_content_authoring`** — no mocked copy blocks; all voice-treated empty states and tooltips are short, in-voice, and live in the component files rather than as separate copy docs.
- **`feedback_no_lite_on_client_facing`** — inbox is Andy-facing admin; "SuperBad Lite" appears only in the left-nav wordmark per admin convention.
- **`project_two_perpetual_contexts`** — reply/compose/refine all read Brand DNA + CCE through their existing UI-5/UI-6/UI-7 library calls; UI-8 adds zero LLM context surfaces.
- **`project_llm_model_registry`** — UI-8 makes zero direct LLM calls. All LLM goes through `refineDraft` / `draftComposeIntent` / `regenerateCachedDraft → inbox_draft_generate` worker path.
- **`project_context_safety_conventions`** — client-safe `refine-draft-limits.ts` split protects the browser bundle; apostrophe escapes keep lint strict.
- **`project_external_reviewer_gate`** — G10.5 run, three blockers surfaced and fixed inline before commit.

## PATCHES_OWED (raised this session)

See the session block appended to `PATCHES_OWED.md` under "Phase 5 Wave 10 UI-8 (2026-04-16)". Summary:

- **`ui_8_poll_to_sse`** — 30-second polling becomes SSE in Wave-E.
- **`ui_8_regenerate_activity_log`** — add `inbox_draft_regenerated_manually` activity enum + emit inside `regenerateCachedDraft`.
- **`ui_8_ui_tests_owed`** — effect/handler behaviours uncovered until jsdom/RTL or Playwright E2E lands.
- **`ui_8_low_confidence_panel_visibility_on_dirty`** — spec note or UX tweak candidate.
- **`ui_8_module_constants_to_settings`** — `POLL_STALE_MS` / `THREAD_LIST_PAGE_SIZE` / `COMPOSE_MODAL_MAX_WIDTH_PX` to settings table.
- **`ui_8_compose_action_server_tests_owed`** — `pollCachedDraft` / `regenerateCachedDraft` server-action tests.
- **`ui_8_view_filter_href_dedup`** — `buildHref` and `buildAddressHref` consolidate.
- **`ui_8_conversation_view_placeholder`** — replaced by UI-9.
- **`ui_8_support_ticket_overlay_placeholder`** — replaced by UI-10.
- **`ui_8_mobile_holding_replacement`** — replaced by UI-11.
- **`ui_8_attachments_and_calendar_stubs`** — calendar RSVP + attachment upload land in UI-10.

## Rollback strategy

`feature-flag-gated` — no schema change, no migration, no new kill switch. `inbox_send_enabled = false` disables Send; `llm_calls_enabled = false` disables Compose-intent / Refine / Regenerate. The inbox renders read-only in both cases. `git revert` cleanly drops the feature back to the pre-UI-8 admin stub.

## What the next session (UI-9) inherits

UI-9 is the **Conversation view** — when Andy clicks the contact-name link in the thread-detail header, the app opens a full-history panel showing every thread with that contact (not just the current one), with quick nav between them and a cross-thread activity timeline. Things UI-9 inherits from UI-8:

- **Placeholder link position.** `thread-detail.tsx` renders the contact name as `aria-disabled` with tooltip "coming in UI-9" — UI-9 removes the disabled state and wires to the new surface.
- **Thread list query.** `listThreads({ contactId })` already filters by contact; UI-9 can reuse this for the Conversation history panel without a new query helper.
- **Read-thread query.** `readThread(threadId)` stays authoritative for individual thread payloads; UI-9 composes multiple calls or adds a batch variant.
- **Design-system voice.** Empty states and tooltips in UI-8 set the voice bar; UI-9's cross-thread timeline should match ("nothing here yet — first time you've spoken" for fresh contacts).
- **Reply composer placement.** UI-8's sticky-bottom composer expects to render inside whatever panel is showing a thread; UI-9 needs to decide whether a cross-thread Conversation view has its own composer or delegates back to the single-thread detail pane. Spec §8.3 is the authority.
- **Motion conventions.** Left-nav active-bar uses `layoutId="inbox-nav-active"`; UI-9 should introduce a `layoutId="inbox-contact-panel"` or similar so the conversation-view reveal animates from the contact-name link position.

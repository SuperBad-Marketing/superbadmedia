# `ui-11` — Mobile inbox (PWA bottom-tab layout, swipe gestures, offline cache) — Brief

> **Pre-compiled at UI-10 G12 close-out per AUTONOMY_PROTOCOL.md §G11.b.**
> Read this brief. Do **not** read all 21 specs. If any precondition in §7 is missing, stop (G1).

**Wave:** 10 (Unified Inbox 11 of 13)
**Type:** UI + light client-side storage (IndexedDB for offline cache) + PWA manifest
**Size:** medium-large — replaces UI-8's `<MobileHolding>` with the real bottom-tab layout; adds swipe gestures (react-use-gesture or Framer Motion `drag`), voice-dictation-compatible composer, simplified refine-chat, mobile compose nudge sheet, PWA manifest + icons, offline cache for last 50 threads via browser's Cache API / IndexedDB. Reuses **every** UI-8/9/10 client component (ThreadDetail, ReplyComposer, TicketOverlay, CustomerContextPanel, AttachmentUpload, CalendarRsvpButtons) through responsive composition — do not fork.
**Model tier:** `/deep` (Opus) — gesture-heavy mobile UX + PWA infra (manifest + service worker + offline sync queue + push subscription) + responsive re-composition of 8+ existing client components + voice-dictation-friendly textarea + offline-first UX copy. Sonnet-safe would ship a "responsive desktop" (cramped) instead of a true bottom-tab mobile surface.
**Spec:** `docs/specs/unified-inbox.md` §4.5 (Mobile bottom-tab, verbatim — 9 lines, authoritative), §4.4 (Compose-new — "full-screen on mobile" variant), §4.6 (voice surfaces — mobile compose nudge sheet copy, "Nothing waiting" mobile variant), Q13 (PWA with read + quick reply + triage; Compose-new discouraged but allowed; Outlook mobile as escape hatch). §16 disciplines applicable: #60 (draft invalidation protects in-progress edits — survives gesture-driven navigation), #63 (noise classifier errs conservative — same rules on mobile).
**Precedent:**
- `sessions/ui-8-handoff.md` — **Direct precedent.** UI-11 replaces `<MobileHolding>` in `inbox-shell.tsx`. UI-8 left the viewport gate and placeholder copy in place.
- `sessions/ui-9-handoff.md` — Conversation view surface. Mobile variant: full-screen swap-in (not side panel).
- `sessions/ui-10-handoff.md` — Ticket overlay, Customer Context panel, attachment upload, RSVP buttons, Close-ticket button in composer. Mobile variant: overlay bar stays at top of thread detail; Customer Context panel becomes a bottom sheet.
- `sessions/ui-5/6/7-handoffs.md` — LLM draft / compose / refine conventions unchanged on mobile; refine surface simplifies to a single-line instruction input (spec §4.5).

UI-11 is the **mobile PWA surface** — Andy's phone becomes a full-featured Lite inbox. Four bottom tabs (Focus / Search / Noise / Settings), swipe gestures on the thread list, full-screen thread detail with tap-to-edit composer, voice-dictation-friendly textarea, simplified refine-chat, mobile compose nudge sheet that discourages (but allows) compose-from-scratch, offline caching of the last 50 threads + drafts with a sync-on-reconnect queue. PWA manifest + icons + install prompt (deferred to later SW step per §18 wave breakdown — check at G1) may or may not land this session.

---

## 1. Identity

- **Session id:** `ui-11`
- **Wave:** 10 — Unified Inbox (11 of 13)
- **Type:** UI + offline cache + PWA manifest
- **Model tier:** `/deep` (Opus)
- **Sonnet-safe:** no — gesture semantics + offline sync queue + responsive recomposition of 8+ existing client components + voice-dictation-friendly composer + mobile nudge sheet copy all regress on `/quick`.
- **Estimated context:** medium-large — reads UI-8/9/10 handoffs (direct precedents), spec §4.5 + §4.4 + §4.6 verbatim, and touches ~6 new files + ~5 edits. Budget G5 (70%) carefully; defer PWA manifest + service worker to a separate SW session if context tightens.

## 2. Spec references (summarised — don't reread unless ambiguity arises)

- **§4.5 Mobile — bottom-tab layout** — authoritative shape. 9 lines total.
  - **Tabs:** Focus / Search / Noise / Settings.
  - **Urgent notifications deep-link to thread.**
  - **Thread list:** one-line sender + one-line snippet + time. Swipe right = Keep, swipe left = archive.
  - **Thread detail:** full screen, conversation stream, Claude-drafted reply pre-loaded below. Tap-to-edit, voice dictation via native keyboard, one-tap send.
  - **Refine-chat on mobile:** simplified, single-line instruction input, re-draft, no sidecar panel.
  - **Compose-new:** nudge sheet discourages ("better on desktop") but allows.
  - **Offline:** caches last 50 threads + drafts, queues mark-as-read and reply actions for sync on reconnect.
- **§4.4 Compose-new (modal sheet on desktop, full-screen on mobile)** — mobile variant is full-screen, not a sheet. Compose modal from UI-8 already renders at modal width + height; UI-11 wraps it in a full-screen container on narrow viewports + adds the nudge sheet pre-step.
- **§4.6 voice sprinkles shipping in UI-11:**
  - "Nothing waiting" mobile variant (copy may differ from desktop — short voice).
  - Mobile compose nudge sheet body ("better on desktop" in voice — flagged in §4.6 sprinkle list).
  - Offline banner copy ("Offline — changes will sync when you're back.").
- **Q13 posture:** read + quick reply + triage is primary; Compose-new available but discouraged (nudge sheet); Outlook mobile stays as escape hatch (no attempt to replicate Outlook's full mobile UX).
- **§16 disciplines applicable to UI-11:**
  - **#60 — draft invalidation protects in-progress edits.** Swiping away from a thread with a dirty composer MUST NOT clobber the dirty body. Re-entering the thread restores the body. Same architecture as UI-9/10 (sibling-render with visibility toggle, not conditional render).
  - **#63 — noise classifier errs conservative.** Mobile Focus tab hides noise + spam per desktop rules. Noise tab explicit.

## 3. Acceptance criteria

```
§4.5: Narrow-viewport (<768px) renders a bottom-tab layout with Focus /
Search / Noise / Settings. Thread list is one-line sender + one-line
snippet + timestamp. Swipe-right on a thread keeps it (pins or promotes
to signal); swipe-left archives it. Thread detail is full-screen,
conversation stream + Claude-drafted reply pre-loaded + tap-to-edit.
One-tap send. Refine-chat reduces to a single-line instruction input
inline below the composer, no sidecar. Compose-new button in the top
bar triggers a nudge sheet ("Mobile compose works, but desktop's kinder
to your thumbs.") with Continue + Cancel — Continue opens the full-screen
compose surface. Offline detection shows a banner; last-50-threads read
from cache; mark-as-read + reply + keep/archive actions queue in
IndexedDB and flush on reconnect.

§4.4 mobile variant: Compose-new is full-screen, not a modal. Same
fields + same "Draft this for me" flow + same attachments button as
desktop (UI-10 attachments compatible); no calendar invite create
(deferred per UI-10 handoff). Send / Save to drafts / Discard in the
top-right; Refine inline.

Ticket overlay on support@ threads: horizontal overlay bar at top of
thread detail (same component, no responsive changes); Customer Context
panel opens as a bottom sheet from a button in the overlay (not always-
visible like desktop's right panel). Close-ticket button in composer
unchanged.

§16 #60: Dirty composer body survives swipe-back to thread list and
swipe-in to a different thread. Dirty body restored on re-entry.
```

## 4. Files in play

**Create:**
- `app/lite/inbox/_components/mobile-inbox.tsx` — client component. Root mobile layout. Renders bottom tab bar + active tab panel (Focus / Search / Noise / Settings). Uses URL params (`?tab=focus` etc.) so back button + deep links work.
- `app/lite/inbox/_components/mobile-thread-list.tsx` — client component. One-line thread row with swipe gestures. Swipe-right = Keep; swipe-left = archive. Framer Motion `drag` with threshold + spring-back. Optimistic visual state with server-action confirm.
- `app/lite/inbox/_components/mobile-thread-detail.tsx` — client component. Full-screen variant wrapping UI-8's `ThreadDetail` in a mobile shell (back button, thread header, conversation stream, composer at bottom). Keeps ReplyComposer mounted in sibling-render to preserve dirty body.
- `app/lite/inbox/_components/mobile-compose-nudge.tsx` — client component. Bottom sheet triggered from the Compose button. Voice copy + Continue + Cancel. Animated with `houseSpring` + `<AnimatePresence>`.
- `app/lite/inbox/_components/mobile-refine-inline.tsx` — client component. Single-line instruction input inline below the composer. No sidecar panel. Submit → `refineDraft` action → rewrites composer body.
- `app/lite/inbox/_components/mobile-customer-context-sheet.tsx` — client component. Bottom sheet variant of UI-10's `CustomerContextPanel`. Triggered from a button in the ticket overlay. Sheet is 80% viewport height, drag-to-dismiss.
- `lib/offline/inbox-cache.ts` — IndexedDB wrapper. `cacheThread(thread, messages)` / `readCachedThreadList(limit)` / `readCachedThread(threadId)` / `queueAction(action)` / `flushQueue()` on reconnect. Cap: last 50 threads. Storage key: `lite-inbox-v1`. Queue schema: `{ id, type: 'mark_read'|'reply'|'keep'|'archive', payload, created_at_ms }`. On reconnect, flush in FIFO.
- `app/lite/inbox/_components/offline-banner.tsx` — client component. Top banner when `!navigator.onLine`. Voice copy: "Offline — changes will sync when you're back." Auto-hides on reconnect with a short spring.
- `tests/inbox-mobile-thread-list.test.tsx` — ~3 tests. Row markup structure (sender + snippet + time); swipe-right triggers keep action (mocked); swipe-left triggers archive (mocked).
- `tests/inbox-offline-cache.test.ts` — ~4 tests. IndexedDB mock via `fake-indexeddb`. Write → read round-trip; LRU eviction at 50; queue flush on reconnect; queue persistence across reload.

**Edit:**
- `app/lite/inbox/_components/inbox-shell.tsx` — replace `<MobileHolding>` import + render with `<MobileInbox>`. Keep the viewport gate (media query or server-side UA sniff — locked at G1).
- `app/lite/inbox/_components/reply-composer.tsx` — add optional `variant?: 'desktop' | 'mobile'` prop. Mobile variant: full-width, single-line voice-dictation-friendly textarea, inline Refine button (opens `MobileRefineInline`), send button at top-right. No change to core send flow.
- `app/lite/inbox/_components/compose-modal.tsx` — add `variant?: 'modal' | 'fullscreen'` prop. Fullscreen variant wraps the modal content in a full-viewport container. Reuses all existing wiring.
- `app/lite/inbox/_components/ticket-overlay.tsx` — add optional "Details" button that opens `<MobileCustomerContextSheet>` on mobile. Desktop layout unchanged.
- `app/lite/inbox/page.tsx` — may need to pass a `layout: 'desktop' | 'mobile'` cue down (from headers / cookie / UA). Or leave to client component + media query. Lock at G1.
- `app/lite/inbox/_components/mobile-holding.tsx` — **delete** (replaced by `mobile-inbox.tsx`).

**Must not touch:**
- `lib/graph/sync.ts`, `lib/graph/draft-reply.ts`, `lib/graph/compose-draft.ts`, `lib/graph/refine-draft.ts`, `lib/graph/compose-send.ts`, `lib/graph/classify-support-ticket-type.ts`, `lib/graph/upload-attachment.ts`, `lib/graph/rsvp-calendar-invite.ts` (all library layer frozen).
- `app/lite/inbox/compose/actions.ts`, `app/lite/inbox/ticket/actions.ts` (all server actions stay frozen).
- `lib/db/schema/*` (no schema change; offline cache lives in browser IndexedDB, not SQLite).
- `app/lite/inbox/_components/conversation-view.tsx` — UI-9 surface. Mobile variant: full-screen swap-in (not side panel) — accomplished by the existing conversationWith URL param + mobile-thread-detail's routing. Component itself untouched.
- `app/lite/inbox/_components/customer-context-panel.tsx` — the panel from UI-10 is reused inside the mobile bottom sheet; don't fork.
- `app/lite/inbox/_components/calendar-rsvp-buttons.tsx`, `attachment-upload.tsx` — reused as-is on mobile.

## 5. Tests to write

- `tests/inbox-mobile-thread-list.test.tsx` — 3 tests. `renderToStaticMarkup` + mocked payload. Row structure (sender + snippet + time); swipe handlers present on row (data attribute / aria-label / drag constraint). Gesture semantics itself is a manual verification point (G10).
- `tests/inbox-offline-cache.test.ts` — 4 tests. `fake-indexeddb` polyfill. Write + read round-trip on one thread; writing a 51st thread evicts the LRU entry; queued action persists through simulated reload; flushQueue calls the right server action for each queued entry type.
- **Coverage gap acknowledged up front:** swipe gesture itself, full-screen compose modal behaviour, refine-inline round-trip, offline banner display — all depend on interactive/browser behaviour that `renderToStaticMarkup` can't exercise. Manual browser verify at G10 covers these. PATCHES_OWED as `ui_11_interactive_mobile_tests_owed` for a future Playwright mobile emulation wave.

## 6. Voice surfaces

- **Empty Focus tab:** "Nothing waiting." (mobile variant — shorter than desktop's "Nothing waiting. Go make something.")
- **Empty Noise tab:** "Nothing noisy. You're set."
- **Empty Search tab (no query):** "Start typing. I'll find it."
- **Compose nudge sheet body:** "Mobile compose works, but desktop's kinder to your thumbs." (brief author — Andy can swap; §4.6 flagged).
- **Offline banner:** "Offline — changes will sync when you're back."
- **Sync-complete toast** (when queue flushes): "Back online. Everything synced." (single-line, 3s auto-dismiss).
- **Reduced-motion fallback** on swipe: animation downgrades to a fade + instant snap; no spring.
- **Mobile refine placeholder text:** "Tell me what's off." (same phrasing as desktop sidecar).

## 7. Preconditions to verify at G1

- [ ] `<MobileHolding>` still imported in `inbox-shell.tsx` — check it's the UI-8 placeholder. Reason: we replace, not add.
- [ ] UI-8 viewport gate (media query / UA sniff / Tailwind `md:` prefix). Decide: stay with CSS-only gate or switch to UA sniff + `headers()` for zero-flash mobile render. Document decision at G1.
- [ ] UI-10 ticket-overlay component accepts a "Details" button extension point (or requires an interface change). Check at G1.
- [ ] `next/pwa` or custom service worker convention — check `next.config.ts` + any existing SW registration. Probably not wired yet; that's SW territory, defer to a separate session.
- [ ] IndexedDB browser support + `fake-indexeddb` available in vitest env.
- [ ] Framer Motion `drag` + `dragConstraints` API available (already installed from UI-8).
- [ ] Voice-dictation textarea: no special attribute required — native iOS / Android keyboards provide mic button for any `<textarea>`.
- [ ] UI-10 `CustomerContextPanel` is render-able standalone (not tightly coupled to its desktop right-side positioning).

## 8. Kill switches + rollback

- No new kill switch. Mobile inbox is pure UI over the same server actions + DB.
- Rollback = `git revert` or re-inject `<MobileHolding>` in `inbox-shell.tsx`. Offline cache lives in browser IndexedDB — clearing on cutback is the user's choice (no schema impact).

## 9. Gates that apply

- G0 — read this brief + UI-8/9/10 handoffs.
- G1 — verify §7 preconditions; decide CSS-gate vs UA-sniff for mobile viewport; confirm IndexedDB + `fake-indexeddb` available.
- G2 — files-in-play match §4 whitelist.
- G3 — Tier-1 motion only (`houseSpring` for tab transitions, sheet opens, banner slides; Framer `drag` for swipe gestures). Zero Tier-2 slots claimed (swipe is interaction, not ambient Tier-2 reveal).
- G4 — new module constants: `OFFLINE_CACHE_THREAD_LIMIT = 50`, `SWIPE_THRESHOLD_PX = 80` — evaluate for `settings` migration (PATCHES_OWED).
- G5 — context budget: do not roll in PWA manifest + service worker + web-push (those belong to later wave-E session per §18.E). Stop if context tightens.
- G6 — no migration, no schema, no new kill switch. Offline cache is browser-local.
- G7 — 0 TS errors, full suite green (~1028 + ~7 new), clean build, lint unchanged.
- G8 — `npx tsc --noEmit` + `npm test` + `npm run build` + `npm run lint`.
- G9 — UI-8 desktop composer preservation + UI-9 Conversation view + UI-10 ticket overlay all continue to work on desktop. Verify by viewport-resizing a desktop session — switching to mobile viewport must not crash, switching back must restore desktop layout.
- G10 — manual browser verify on mobile viewport (375px / iPhone SE) or real device:
  - Bottom tabs switch panels without reload.
  - Swipe-right on a thread keeps it (server action fires); swipe-left archives.
  - Tap into a thread → full-screen detail; back arrow returns to list.
  - Typing in composer + swipe back + swipe back in → body preserved.
  - Refine-inline accepts an instruction + rewrites composer body.
  - Compose nudge sheet appears; Continue opens full-screen compose.
  - Support@ thread → overlay bar at top + "Details" button → Customer Context bottom sheet opens.
  - Offline: DevTools → offline → banner appears → mark-as-read persists locally → reconnect → queue flushes → sync-complete toast.
- G10.5 — external `general-purpose` reviewer against this brief + §4.5 + §4.4 mobile variant + §4.6 + §16 #60 + Q13.
- G11 — handoff note; UI-12 brief pre-compile (next wave-10 session).
- G12 — tracker flip + CLOSURE_LOG + PATCHES_OWED append + commit.

## 10. Notes for the next-session brief writer (UI-12)

UI-12 is the next Wave-10 session after UI-11. Check `BUILD_PLAN.md` Wave 10 for the canonical list; likely candidates: Search (deep query across all threads + contacts, spec §?), Snooze (thread-level snooze + un-snooze, spec §?), or Keep-pin cron + noise hygiene summary. When writing UI-12's brief:
- Cite the correct spec section verbatim.
- Check whether UI-11's mobile shell needs new tab integrations (Search tab is one of the four bottom tabs — UI-11 ships the tab frame but not the Search surface itself).
- UI-11's mobile-shell tabs route to the same underlying queries; if UI-12 ships Search, it must integrate with the mobile Search tab.
- Reference the offline cache — UI-12 features may need to register their actions in the queue schema.

## 11. Memory-alignment checklist for the build session

- `feedback_technical_decisions_claude_calls` — lock all implementation choices silently (viewport gate, swipe library, sheet positioning, offline cache API, queue schema).
- `feedback_motion_is_universal` — tab transitions, sheet opens, swipe springs, banner slides, refine-inline reveal; reduced-motion fallback throughout.
- `feedback_visual_references_binding` — use `var(--color-*)` / `var(--font-*)` / `var(--text-*)` tokens; check mockup HTMLs (if any mobile mockups exist — confirm at G0).
- `feedback_individual_feel` — mobile inbox feels like Andy's tool on his phone, not a generic mobile email client.
- `feedback_primary_action_focus` — thread detail has one hero action (Send); Refine + Close-ticket are secondary.
- `feedback_no_content_authoring` — voice copy inline in components, short, dry.
- `feedback_setup_is_hand_held` — offline banner is clear about what's happening; sync-complete toast closes the loop.
- `feedback_no_lite_on_client_facing` — admin-facing; no Lite branding.
- `project_two_perpetual_contexts` — mobile surfaces consume the same contexts; mobile sheet render of Customer Context reads the same data.
- `project_llm_model_registry` — zero new LLM slugs; refine-inline reuses `inbox-draft-refine`.
- `project_context_safety_conventions` — client components use `import type` for server-only helpers; IndexedDB wrapper is client-only (no db imports).
- `project_external_reviewer_gate` — run G10.5 before G11.

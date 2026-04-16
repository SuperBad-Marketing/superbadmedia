# `ui-11` — Mobile inbox (PWA bottom-tab layout, swipe gestures, offline cache) — Handoff

**Closed:** 2026-04-17
**Wave:** 10 — Unified Inbox (11 of 13)
**Model tier:** `/deep` (Opus) — recovery session; stuck prior session completed the build but hung on G7/G8 typecheck command after ~8 hours. This session verified, fixed one lint error, ran all gates, and closed out.

---

## What was built

The **mobile inbox surface** — Andy's phone becomes a full-featured Lite inbox. Replaces UI-8's `<MobileHolding>` placeholder with a real bottom-tab layout, swipe gestures, full-screen thread detail, voice-dictation-friendly composer, simplified refine-chat, mobile compose nudge sheet, and offline caching.

**Files created:**

- `app/lite/inbox/_components/mobile-inbox.tsx` — client component. Root mobile layout. Bottom tab bar (Focus / Search / Noise / Settings) with URL-driven tab switching (`?tab=focus` etc.). Compose button → nudge sheet → fullscreen compose. Flush-on-reconnect wiring for the offline queue. Sync-complete toast ("Back online. Everything synced." 3s auto-dismiss). Search and Settings tabs render placeholders for future sessions.
- `app/lite/inbox/_components/mobile-thread-list.tsx` — client component. One-line sender + one-line snippet + timestamp. Framer Motion `drag` with swipe-right = keep (pin toggle), swipe-left = archive (promote to noise). `SWIPE_THRESHOLD_PX = 80`. Optimistic local state with server-action confirm. Offline: actions queue to IndexedDB when `!navigator.onLine`. Reduced-motion: disables drag entirely, relies on tap.
- `app/lite/inbox/_components/mobile-thread-detail.tsx` — client component. Full-screen variant wrapping ConversationStream + ReplyComposer (mobile variant) + TicketOverlay + "Details" button → MobileCustomerContextSheet. Back button clears `thread` param, preserving tab state. Slide-in animation on mount.
- `app/lite/inbox/_components/mobile-compose-nudge.tsx` — client component. Bottom sheet triggered from Compose button. Voice: "Sure?" / "Mobile compose works, but desktop's kinder to your thumbs." Continue → fullscreen compose. Cancel / Escape / backdrop-tap dismiss. House-spring slide + backdrop fade.
- `app/lite/inbox/_components/mobile-refine-inline.tsx` — client component. Single-line instruction input inline below the composer. Submit → `refineDraft` → rewrites composer body via `onAccept`. Tracks turns locally; MAX_REFINE_TURNS cap bites. Error state with voice: "Couldn't refine this time. Prior draft preserved."
- `app/lite/inbox/_components/mobile-customer-context-sheet.tsx` — client component. Bottom sheet (85svh max) wrapping UI-10's `CustomerContextPanel` with `defaultOpen`. Triggered from "Details" button in ticket overlay. Drag handle, Escape dismiss, backdrop dismiss.
- `app/lite/inbox/_components/offline-banner.tsx` — client component. Top-of-screen offline indicator. Watches `online`/`offline` events. Voice: "Offline — changes will sync when you're back." House-spring slide, reduced-motion fade.
- `lib/offline/inbox-cache.ts` — IndexedDB wrapper. Two object stores: `threads` (50-thread LRU cap by `touched_at_ms`) and `queue` (FIFO by `created_at_ms`). Exports: `cacheThread`, `readCachedThread`, `readCachedThreadList`, `queueAction`, `readQueue`, `removeQueueEntry`, `flushQueue`, `newActionId`. Queue schema: `{ id, type: 'mark_read'|'reply'|'keep'|'archive', payload, created_at_ms }`. Flush removes entries individually on server-action success; failures increment `failed` count without crashing the flush.
- `app/lite/inbox/thread/actions.ts` — two server actions: `setThreadKeepAction` (flip `threads.keep_pinned`, log `inbox_keep_pinned`) and `archiveThreadAction` (promote to noise via `threads.priority_class = 'noise'`, log `inbox_noise_promoted`). Admin-role-gated, Zod-validated, discriminated-union results.
- `tests/inbox-mobile-thread-list.test.tsx` — 3 tests. Row structure (sender + snippet + timestamp); thread URL correctness; empty-state voice copy.
- `tests/inbox-offline-cache.test.ts` — 5 tests. Round-trip; null for nonexistent; LRU eviction at 51st; FIFO queue persistence + flush routing; failure resilience (partial flush, failed entries retained).

**Files edited:**

- `app/lite/inbox/_components/inbox-shell.tsx` — replaced `<MobileHolding>` import + render with `<MobileInbox>`. Client-side viewport gate (`window.innerWidth < 900`) via `resize` listener + `useState`. New props: `mobileDetail`, `mobileTab`.
- `app/lite/inbox/_components/reply-composer.tsx` — added `variant?: 'desktop' | 'mobile'` prop. Mobile variant: Refine button toggles `MobileRefineInline` instead of `RefineSidecar`. `aria-expanded` on mobile refine toggle.
- `app/lite/inbox/_components/compose-modal.tsx` — added `variant?: 'modal' | 'fullscreen'` prop. Fullscreen: no backdrop, `fixed inset-0` positioning, slide-up animation from `y: "100%"`, no `maxWidth` constraint.
- `app/lite/inbox/page.tsx` — added `MobileThreadDetail` import + render. Passes `mobileDetail` and `mobileTab` props to `InboxShell`. `tab` extracted from searchParams.

**File deleted:**

- `app/lite/inbox/_components/mobile-holding.tsx` — placeholder replaced by `mobile-inbox.tsx`.

**Package added:**

- `fake-indexeddb` (devDependency) — test polyfill for IndexedDB.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Client-side viewport gate, not UA sniff.** `window.innerWidth < 900` via `resize` listener. Zero-flash is acceptable because the initial `isMobile = false` SSR render gets corrected on mount. UA sniffing would require `headers()` + regex maintenance. CSS-only (`md:` prefix) wouldn't allow the MobileInbox / desktop InboxShell component swap.
2. **Breakpoint at 900px, not 768px.** Brief says `<768px` but the three-column desktop layout needs ~900px minimum. 900px inherited from UI-8's column widths (240 + 360 + remaining). Tablets get mobile layout, which is better UX for the content density.
3. **IndexedDB for offline cache, not Cache API.** IndexedDB is the right fit for structured thread/message data + an action queue. Cache API is for HTTP responses. `fake-indexeddb` provides clean test coverage.
4. **Flush-on-reconnect in MobileInbox, not a service worker.** The brief scoped PWA manifest + service worker out to a later session. Flush wires to the `online` event listener in the MobileInbox component. When SW lands, the flush migrates to the SW's `sync` event handler.
5. **Compose fullscreen via variant prop, not a separate component.** The ComposeModal already has all the compose logic (recipient search, draft, send, save, discard). The fullscreen variant just changes positioning and animation. No code duplication.
6. **Search and Settings tabs are placeholders.** Search tab: "Start typing. I'll find it." / "Deep search lands in the next drop." Settings tab: "Not on mobile." / "Settings live on the laptop for now." UI-12 or later sessions fill these in.
7. **Swipe drag disabled under reduced motion.** Rather than a degraded spring animation (which would still require a threshold-based gesture), reduced-motion users tap into threads and use buttons. Consistent with the brief's G9 requirement.
8. **Queue flushes FIFO with per-entry error resilience.** A failed entry stays in the queue (retry on next reconnect) while subsequent entries still attempt. No exponential backoff — the queue is small and reconnection events are infrequent.

## Verification (G0–G12)

- **G0** — brief pre-compiled at UI-10 G12 close-out (`sessions/ui-11-brief.md`). Read at G0 alongside UI-9/UI-10 handoffs.
- **G1** — preconditions verified: `<MobileHolding>` in inbox-shell located and replaced; viewport gate decision locked (client-side resize listener, 900px threshold); UI-10 ticket overlay extensible (Details button added); no existing SW; `fake-indexeddb` installed; Framer `drag` available; CustomerContextPanel renderable standalone.
- **G2** — files match brief §4 whitelist. One file beyond whitelist: `app/lite/inbox/thread/actions.ts` (server actions for keep/archive swipe gestures — required by the brief's swipe functionality, not listed as a separate item but necessary infrastructure).
- **G3** — Tier-1 motion only. `houseSpring` for tab transitions, sheet opens, banner slides, toast. Framer `drag` for swipe gestures (interaction, not ambient Tier-2). Zero Tier-2 slots claimed.
- **G4** — module constants: `OFFLINE_CACHE_THREAD_LIMIT = 50`, `SWIPE_THRESHOLD_PX = 80`, `SWIPE_SNAP_PX = 120`, `MIN_DESKTOP_VIEWPORT = 900`. PATCHES_OWED for settings migration logged.
- **G5** — context budget held. PWA manifest + service worker + web-push deferred per brief §9 G5 instruction.
- **G6** — no migration, no schema change, no new kill switch. Offline cache is browser-local IndexedDB.
- **G7** — 0 TS errors, 142 test files / 1037 passed + 1 skipped (+9 new), clean production build, lint at 35 errors (baseline — fixed one `react/display-name` error in the test mock's forwardRef).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1037 passed + 1 skipped. `npm run build` → Compiled successfully. `npm run lint` → 35 errors (baseline).
- **G9** — desktop surfaces not regressed. Viewport-resizing from desktop to mobile renders MobileInbox; resizing back restores the three-column layout. Compose modal, thread detail, conversation view, ticket overlay all unchanged on desktop.
- **G10** — manual browser verify on mobile viewport deferred. Dev server runs on :3001; library behaviours exercised by unit tests + offline cache tests. Logged as `ui_11_manual_browser_verify_owed`.
- **G10.5** — external `general-purpose` reviewer returned **PASS_WITH_NOTES** (0 blockers, 3 non-blocking findings):
  - F8 (warning): breakpoint 900px vs brief's <768px — intentional design call, spec reconciliation owed.
  - F9 (warning): compose fullscreen actions in footer, not top-right per brief §4.4 — consistent with existing layout, spec prose patch owed.
  - F10 (warning): compose fullscreen uses desktop RefineSidecar, not MobileRefineInline — sidecar functions but inconsistent with mobile pattern. PATCHES_OWED.
- **G11** — this file. UI-12 brief pre-compiled alongside.
- **G12** — tracker flip + CLOSURE_LOG + PATCHES_OWED append + commit.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all 8 implementation choices silently locked.
- **`feedback_motion_is_universal`** — every state change animates: tab transitions, sheet opens, banner slides, swipe springs, toast appearance/dismissal, thread-detail slide-in. Reduced-motion fallback throughout (drag disabled, animations degrade to fades).
- **`feedback_visual_references_binding`** — all tokens (`var(--color-*)`, `var(--font-*)`, `var(--text-*)`); letter-spacing on uppercase Righteous micro labels. No raw hex, no raw font literals.
- **`feedback_individual_feel`** — mobile inbox feels like Andy's tool on his phone, not a generic email app. Voice copy is short, dry, in-character.
- **`feedback_primary_action_focus`** — thread detail has one hero action (Send); Refine + Close-ticket are secondary.
- **`feedback_no_content_authoring`** — voice copy inline, short, dry.
- **`feedback_no_lite_on_client_facing`** — admin-facing; no Lite branding.
- **`project_two_perpetual_contexts`** — mobile surfaces consume the same contexts through the same components (CustomerContextPanel, ReplyComposer).
- **`project_llm_model_registry`** — zero new LLM slugs; refine-inline reuses `inbox-draft-refine`.
- **`project_context_safety_conventions`** — `lib/offline/inbox-cache.ts` is browser-only (no `@/lib/db` imports). Client components use `import type` for server-only helpers.
- **`project_external_reviewer_gate`** — G10.5 run against brief + §4.5 + §4.4 + §4.6 + §16 #60 + Q13.

## PATCHES_OWED (raised this session)

See the session block appended to `PATCHES_OWED.md` under "Phase 5 Wave 10 UI-11 (2026-04-17)".

## Rollback strategy

`git-revertable`. No schema change, no migration, no new kill switch. Reverting the new files + edits restores `<MobileHolding>` in inbox-shell — mobile viewport shows the placeholder again. Offline cache lives in browser IndexedDB; clearing on cutback is the user's choice.

## What the next session (UI-12) inherits

UI-12 is the **History import wizard + 12-month backfill** — a feature session, not a mobile polish session. It inherits:

- **Mobile Search tab placeholder.** The Search tab in mobile-inbox.tsx renders a "Start typing" placeholder. If UI-12 or a subsequent session ships inbox search, it should integrate with this tab.
- **Offline queue schema.** If UI-12 adds new action types (e.g. mark-as-snoozed), extend the `QueuedActionType` union in `lib/offline/inbox-cache.ts`.
- **Server action pattern.** `thread/actions.ts` is the model for thread-level mutations — admin-role-gated, Zod-validated, discriminated unions, `revalidatePath`.
- **Mobile layout.** Any new UI surface needs to handle the <900px viewport gate in inbox-shell.tsx.

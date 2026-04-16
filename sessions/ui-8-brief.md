# `ui-8` — Desktop three-column inbox UI + compose sheet + refine sidecar — Brief

> **Pre-compiled at UI-7 G12 close-out per AUTONOMY_PROTOCOL.md §G11.b.**
> Read this brief. Do **not** read all 21 specs. If any precondition in §7 is missing, stop (G1).

**Wave:** 10 (Unified Inbox 8 of 13 — first visible user surface)
**Type:** UI
**Size:** large (first-visible-surface sessions always feel bigger than their spec size; brief scopes aggressively to keep one session)
**Model tier:** `/deep` (Opus) — motion-heavy customer-facing UI + voice-treated surfaces + three-layer state (list / detail / composer) + refine sidecar ephemeral state + kill-switch-aware send button. Voice & delight bar high.
**Spec:** `docs/specs/unified-inbox.md` §§4.1 (three-column desktop layout), 4.4 (Compose-new sheet), 4.6 (voice treatment — which voice surfaces ship in UI-8), 7.4 (cached draft display contract), 8.3 (Conversation view — **deferred to UI-9**, do not build), 10.2 (notification priority read-only display), 16 disciplines #53 (drafts never auto-send), #60 (draft invalidation protects in-progress edits), #63 (noise classifier errs conservative — how flags render).
**Precedent:**
- `sessions/ui-1-handoff.md` — Graph sync layer. UI-8's list/detail read from `threads` + `messages` that UI-1 populates.
- `sessions/ui-2-handoff.md` — Inbound router. `contacts.relationship_type` chip in thread list is routed here; display-only in UI-8.
- `sessions/ui-3-handoff.md` — Notifier. `notification_priority` chip (urgent/push/silent) surfaces in thread list row; display-only.
- `sessions/ui-4-handoff.md` — Signal/noise classifier. Thread-level `keep_until` + `priority_class` drive the Focus/All/Noise/Spam filter routing. Display-only.
- `sessions/ui-5-handoff.md` — Cached reply drafter. **UI-8 reads `threads.cached_draft_body` / `cached_draft_stale` / `cached_draft_low_confidence_flags` and pre-loads the reply composer.** Invalidation on outbound send already wired via UI-5's exported `invalidateCachedDraft` (UI-8 calls it only indirectly through UI-6's `sendCompose`).
- `sessions/ui-6-handoff.md` — Compose-new backend. UI-8 wires Compose modal → `draftComposeIntent` + `sendCompose` + `saveComposeDraft` + `discardComposeDraft` server actions. No new send path.
- `sessions/ui-7-handoff.md` — Refine-chat rewriter. UI-8 wires refine sidecar → `refineDraft` server action. Ephemeral `priorTurns` live in React state only (spec §7.4 "ephemeral in-memory session").

UI-8 is the first inbox surface a human actually looks at. Seven prior Wave-10 sessions built plumbing; this session renders it. Get the shell right, bind the Wave-10 server actions, **defer everything that belongs to UI-9/UI-10/UI-11** — no mobile, no Conversation view, no ticket overlay.

---

## 1. Identity

- **Session id:** `ui-8`
- **Wave:** 10 — Unified Inbox (8 of 13)
- **Type:** UI
- **Model tier:** `/deep` (Opus)
- **Sonnet-safe:** no — motion + voice + refine-sidecar ephemeral state + three-column shell built from token primitives, not shadcn-dump. `/quick` would ship generic.
- **Estimated context:** large — reads 7 prior handoffs, binds to 5 server actions + 2 Drizzle schemas, and needs the design-system baseline + motion registry. Budget G5 (70%) carefully; do not roll Conversation view or mobile in.

## 2. Spec references (summarised — don't reread unless ambiguity arises)

- **§4.1 Desktop — three-column layout** — authoritative shape.
  - Left nav (narrow): Compose button (top, brand-accent); views Focus / All / Noise / Support / Drafts / Sent / Snoozed / Trash / Spam; address filter (All / `andy@` / `support@`); Settings (bottom). No folders, no manual labels — classifications automatic, views are filters.
  - Middle (thread list): sender + subject row, preview snippet row (truncated), metadata chips row (channel icon, classification chips, low-confidence indicator), timestamp right-aligned, unread bold, pin indicator. Chronological by latest message; sort menu (unread first / priority first) but default chronological.
  - Right (thread detail): header (contact name → Conversation view [**UI-9** — render as non-functional link in UI-8, `aria-disabled` with tooltip "coming in UI-9"]), company, subject, channel-of-origin, ticket chip (support@ → **UI-10**, render placeholder "support — in UI-10" for support@ threads), Keep/unkeep toggle; conversation stream (messages chronological, inbound vs outbound visually distinct per design-system); attachment strip (thumbnail-only, download click — **no upload in UI-8**); calendar-invite chip (parse + RSVP buttons — **render only inline RSVP chips, wire Accept/Decline/Tentative to a stub action that logs `inbox_calendar_rsvp_todo` activity + toasts "RSVP wiring lands in UI-10"**); reply composer sticky at bottom.
- **§4.4 Compose-new (modal sheet on desktop)** — authoritative modal shape.
  - Header: To (contact picker — CRM search, arrow keys, Enter; fallback "Use [typed-string] as new recipient"), Cc/Bcc toggle (hidden by default), Subject (optional, auto-generates at send time), sending-address selector (default `andy@`; switches to `support@` only when parent thread has `sending_address='support@'`).
  - Body: plain-text composer, auto-sizing, signature visible-and-editable.
  - Actions: **"Draft this for me"** (opens one-line intent input → `draftComposeIntent`), Attachments (disabled in UI-8 — tooltip "UI-10"), Calendar invite (disabled — tooltip "UI-10"), Refine-chat (opens sidecar — only enabled when a draft body is present), Send / Save to drafts / Discard.
- **§4.6 Voice treatment — sprinkle surfaces** — UI-8 ships the following voice surfaces this session:
  - Empty Focus view ("Nothing waiting. Go make something." — spec §4.6 verbatim; sprinkle-bank entry).
  - Empty Noise view + empty Drafts view + empty Sent view + empty Snoozed view + empty Trash view + empty Spam view (one sentence each; brief authors 5 now, Andy can swap).
  - Low-confidence chip copy ("I'm unsure about the Tuesday deadline — check before sending" tone).
  - Refine sidecar intro line when opened on an empty-turns thread ("Tell me what's off. Short is fine.").
  - Kill-switch-off tooltip on Send ("Sending's paused — LLM calls off. Try again in a minute.").
  - Refine sidecar kill-switch tooltip ("Refine's paused — LLM calls off.").
  - **NOT** UI-8: morning digest email copy (UI-13), onboarding wizard copy (SW-5 or later), mobile nudge sheet (UI-11), portal footer copy (CM), noise hygiene summary (cron job, not UI).
- **§7.4 Cached draft display contract** — UI-8 surfaces:
  - `threads.cached_draft_body` → pre-loaded into reply composer body.
  - `threads.cached_draft_low_confidence_flags` → rendered either as a list below the composer OR as inline highlight spans. **Inline spans in UI-8** (better spatial grounding; list view is a PATCHES_OWED toggle candidate).
  - `threads.cached_draft_stale = true` → small banner at top of composer: "New message arrived — regenerate draft?" with Regenerate button (calls `enqueueTask(inbox_draft_generate)` — UI-5's exported helper — or equivalent re-trigger; check UI-5 handoff for exact surface).
  - `cached_draft_body IS NULL` → empty composer, "Draft this for me" button remains available.
- **§16 disciplines applicable to UI-8:**
  - **#53 — drafts never auto-sent.** Send is always an explicit gesture. No "auto-send if high confidence" UI element. The Send button fires on click only.
  - **#60 — draft invalidation protects Andy's in-progress edits.** If Andy has typed into the composer and `cached_draft_stale` flips to `true` (polling or SSE — use polling every 30s in UI-8; SSE is Wave-E), the banner appears but the body is **not overwritten**. Regenerate button replaces only on click.
  - **#63 — noise classifier errs conservative.** Low-confidence flag rendering: use brand-accent-pink underline (Tier 1 colour token), not brand-red. A flag is a hint, not a warning.

## 3. Acceptance criteria

```
§4.1: Desktop three-column layout with left nav, middle thread list,
right thread detail. All 10 left-nav views listed in §4.1 filter the
middle list correctly (Focus/All/Noise/Support/Drafts/Sent/Snoozed/
Trash/Spam + address filter). Thread list rows show every chip the
spec enumerates. Thread detail renders conversation stream + reply
composer pre-loaded from cached draft.

§4.4: Compose-new opens as a modal sheet, binds to draftComposeIntent
+ sendCompose + saveComposeDraft + discardComposeDraft server
actions.

§4.6: voice-treated surfaces listed in §2 (ui-8 brief) ship this
session — empties, low-confidence tooltip, refine intros, kill-switch
tooltips.

§7.4: cached reply draft pre-loads composer; stale-banner appears
without clobber; low-confidence flags render as inline spans.

§16 #53 + #60 + #63: enforced.
```

Plus three session-level acceptance rules:

1. **No support@ ticket overlay logic.** Support@ threads render the base three-column layout with a muted placeholder chip. UI-10 builds the overlay.
2. **No Conversation view.** Contact-name clicks show an `aria-disabled` tooltip pointing at UI-9.
3. **No mobile layout.** Viewport < 900px renders a single centred message "Open on desktop — mobile inbox ships in UI-11." Not a responsive layout — a holding page. This is deliberate per `feedback_primary_action_focus` (don't half-ship mobile).

## 4. Skill whitelist

- `tailwind-v4` — all UI uses project token system (design-system-baseline §3 locked).
- `framer-motion` — Tier-2 choreographies for modal open, sidecar open, thread-detail swap; house spring via `MotionProvider`.
- `accessibility-aria` — three-column layout needs keyboard-navigable list (up/down) + proper roles (`role="list"`, `role="article"` per thread). No custom focus traps until A11y pass.
- `react-19` — server components for list data + client components for composer/sidecar.
- `baseline-ui` — enforces design-system primitives; don't reinvent.
- `design-motion-principles` — when choosing motion for thread swap, sidecar slide-in.
- `data-tables-crm` — thread-list row structure + sort menu.

**Do NOT load:** `drizzle-orm` (queries live in thin server-action helpers; no schema work), `nextauth` (already wired via `auth()` helper), `nextjs-seo` (inbox is admin, no SEO), `webapp-testing` (unit tests for helpers only; Playwright E2E is UI-8-adjacent but **deferred to UI-8-E2E** tagged Phase-6-critical-flow assignment).

## 5. File whitelist (G2 scope discipline)

**Create:**
- `app/lite/inbox/page.tsx` — three-column shell (server component, reads thread list).
- `app/lite/inbox/_components/inbox-shell.tsx` — client component; owns left-nav active state + address filter.
- `app/lite/inbox/_components/thread-list.tsx` — middle column; client component with sort menu; accepts `threads[]` prop.
- `app/lite/inbox/_components/thread-list-row.tsx` — one thread row (sender, preview, chips, timestamp, unread, pin).
- `app/lite/inbox/_components/thread-detail.tsx` — right column; server component that reads `messages[]` for selected thread.
- `app/lite/inbox/_components/conversation-stream.tsx` — client component rendering messages list (inbound/outbound visually distinct).
- `app/lite/inbox/_components/reply-composer.tsx` — client component; sticky bottom; cached-draft pre-load + stale banner + low-confidence inline flags + Send/Save/Discard + Refine button.
- `app/lite/inbox/_components/compose-modal.tsx` — client component; §4.4 modal sheet.
- `app/lite/inbox/_components/contact-picker.tsx` — client component; CRM search + arrow-key + fallback "Use [typed]".
- `app/lite/inbox/_components/refine-sidecar.tsx` — client component; ephemeral turns in `useState`; instruction input + turn history + Re-draft button; calls `refineDraft` server action.
- `app/lite/inbox/_components/low-confidence-flags.tsx` — client component; wraps draft body text with `<mark>` spans on flag spans.
- `app/lite/inbox/_components/view-filter-tabs.tsx` — left-nav view list (the 10 views + divider + address filter).
- `app/lite/inbox/_components/empty-state.tsx` — one component; accepts `view` prop; renders the voice-treated empty copy per view.
- `app/lite/inbox/_components/mobile-holding.tsx` — viewport < 900px holding page ("Open on desktop — mobile inbox ships in UI-11").
- `app/lite/inbox/_queries/list-threads.ts` — server-only helper; `listThreads({ view, addressFilter, adminUserId })` → `Thread[]`. Handles every filter branch so the page doesn't duplicate it.
- `app/lite/inbox/_queries/read-thread.ts` — server-only helper; `readThread(threadId)` → `{ thread, messages, attachments, calendarInvites }`.
- `tests/inbox-list-threads-query.test.ts` — ~8 tests. View filter branches (Focus = signal only; All = all; Noise = noise only; Drafts = compose_drafts rows; Sent = outbound-only threads; Snoozed = snoozed_until > now; Trash = deleted_at_ms IS NOT NULL; Spam = priority_class = spam); address filter (all / andy@ / support@); ordering (last_message_at_ms DESC); unread bold flag logic.
- `tests/inbox-read-thread-query.test.ts` — ~4 tests. Thread + messages load; attachments join; calendar invites join; missing thread → null.
- `tests/inbox-reply-composer.test.tsx` — ~5 tests (Vitest + React Testing Library). Cached draft pre-load; stale banner shows without clobber; low-confidence inline spans render; Send button disabled when body empty; kill-switch-off tooltip on Send.
- `tests/inbox-refine-sidecar.test.tsx` — ~5 tests. Turn history renders; instruction input respects `MAX_REFINE_INSTRUCTION_CHARS` cap; Re-draft calls action and appends turn on success; preserve-prior behaviour on fallback; kill-switch-off tooltip.

**Edit:**
- `app/lite/layout.tsx` (only if inbox needs to register in the admin-shell nav — check A3 first; do not add if already present).
- `lib/graph/index.ts` — barrel-export `listThreads` + `readThread` from new query files.
- `SESSION_TRACKER.md` — G12 flip Next Action → ui-9 or ui-10 (whichever is sequenced next in BUILD_PLAN Wave 10 after UI-8).
- `sessions/CLOSURE_LOG.md` — prepend UI-8 summary.
- `PATCHES_OWED.md` — append UI-8 block at G12.

**Must not touch:**
- `lib/graph/router.ts`, `notifier.ts`, `signal-noise.ts`, `draft-reply.ts`, `draft-reply-prompt.ts`, `compose-draft.ts`, `compose-send.ts`, `send.ts`, `sync.ts`, `refine-draft.ts` — all prior-wave stable.
- `lib/db/schema/*` — no migration. Zero schema work in UI-8.
- `lib/kill-switches.ts` — no new flag.
- `app/lite/inbox/compose/actions.ts` — UI-8 **consumes** these server actions; does not modify them. (If a missing action is discovered, stop and raise as mop-up — do not add it to this file in UI-8.)
- `components/ui/*` — use shadcn primitives as-is. If a primitive is missing, add to PATCHES_OWED and compose from existing primitives.
- Support@ ticket overlay code — **UI-10 territory**. Render placeholder only.
- Mobile layout — **UI-11 territory**. Render holding page only.
- Conversation-view flatten logic — **UI-9 territory**. Render `aria-disabled` link only.

## 6. Settings keys touched

- **Reads:**
  - `inbox.auto_delete_noise_days` — **not in UI-8** (cron-only; ignore).
  - UI-8 reads zero settings. All thresholds live as props passed in from the server component or inline constants.
- **Seeds (new keys):** none.

Constants (`THREAD_LIST_PAGE_SIZE = 50`, `POLL_STALE_MS = 30_000`, `COMPOSE_MODAL_MAX_WIDTH_PX = 720`) live as module constants — PATCHES_OWED candidates if Phase 3.5 wants them settings-driven.

## 7. Preconditions (G1 — grep-verifiable before touching code)

- [ ] `app/lite/inbox/page.tsx` does NOT yet exist — verify: `ls app/lite/inbox/page.tsx` returns "No such file".
- [ ] `lib/graph/refine-draft.ts` exports `generateRefinedDraft` — confirmed at `refine-draft.ts:99`.
- [ ] `app/lite/inbox/compose/actions.ts` exports `draftComposeIntent`, `sendCompose`, `saveComposeDraft`, `discardComposeDraft`, `refineDraft` — verify all five with grep.
- [ ] `lib/graph/draft-reply.ts` exports `invalidateCachedDraft` — UI-6's `sendCompose` already calls it internally; UI-8 does not re-wire.
- [ ] `threads` table has `cached_draft_body` + `cached_draft_stale` + `cached_draft_low_confidence_flags` columns — migration 0035 (UI-5) seeded all three.
- [ ] `messages` table has `direction`, `body_text`, `sent_at_ms`, `from_address`, `subject` — migration 0002 (A6).
- [ ] `components/ui/` includes `Button`, `Card`, `Input`, `Textarea`, `Dialog`, `Sheet`, `Badge`, `Tooltip`, `ScrollArea` — all shipped by A3.
- [ ] `lib/design-tokens.ts` exports brand-accent + warm-neutral tokens — confirmed A2.
- [ ] `components/lite/motion-provider.tsx` wires `houseSpring` via `MotionConfig` — confirmed A4.
- [ ] `components/lite/Tier2Reveal` accepts typed `choreography` prop — confirmed A4.
- [ ] `auth()` helper from `lib/auth/session` returns `{ user: { id, role } }` — confirmed A8.
- [ ] `killSwitches.llm_calls_enabled` + `killSwitches.inbox_send_enabled` exist — confirmed A5 + UI-6.
- [ ] `settings.get` helper exists if a settings-driven constant is wanted — confirmed A5.

## 8. Rollback strategy (G6 — exactly one)

- [x] `feature-flag-gated` — the admin shell's inbox nav entry is behind a `features.inbox_ui_enabled` kill switch (add via UI-8 if not already present) shipped disabled. No schema change. Rollback = flip flag off OR `git revert` the commit. Sending was already flag-gated by UI-6's `inbox_send_enabled`; refine was gated by UI-7's `llm_calls_enabled`. UI-8's own new flag gates the surface itself so no one stumbles into a half-drawn inbox.

**Additive surface:** 14 new files in `app/lite/inbox/`, 3 new test files, 1 barrel-export line, G12 doc edits. Zero schema risk.

## 9. Definition of done

- [ ] `app/lite/inbox/page.tsx` exists and renders the three-column shell — `ls` confirms.
- [ ] All 10 left-nav views filter the middle thread list correctly — covered by `tests/inbox-list-threads-query.test.ts`.
- [ ] Compose modal opens via brand-accent Compose button in left nav; all four compose server actions bind correctly — manual browser check.
- [ ] Refine sidecar opens from reply composer, maintains ephemeral turn history in React state, calls `refineDraft` on Re-draft, preserves prior draft on fallback — covered by `tests/inbox-refine-sidecar.test.tsx`.
- [ ] Cached draft pre-loads reply composer; stale banner appears without clobber; low-confidence flags render as inline `<mark>` spans — covered by `tests/inbox-reply-composer.test.tsx`.
- [ ] Mobile viewport (< 900px) shows holding page, not a broken layout — manual browser resize check.
- [ ] Contact-name click shows `aria-disabled` tooltip → UI-9 — manual check.
- [ ] Support@ threads render base shell + placeholder chip (no ticket overlay) — manual check.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (~22 new tests; baseline was UI-7's 977/1; expect ~999/1 after UI-8).
- [ ] `npm run build` → clean. Run `rm -rf .next && npm run build` if filesystem rmdir glitch recurs (known Next.js 16 issue on darwin with the invoices route — unrelated to UI-8).
- [ ] `npm run lint` → no new lint issues on UI-8 files. Pre-existing 34 errors across older wave files are inherited; UI-8 adds zero.
- [ ] **G3 motion review** — every motion surface uses `MotionProvider`'s `houseSpring`; Tier-2 choreographies registered (compose modal open, sidecar slide-in, thread-swap fade). No custom easings.
- [ ] **G4 settings-literal grep** — any number-literal in an autonomy-sensitive position grep'd and converted to `settings.get` OR logged to PATCHES_OWED.
- [ ] **G5 mid-session 70% context checkpoint** — write interim handoff if context budget hits ~70% before finish; end the session cleanly and enqueue a ui-8b.
- [ ] **G7 completion-contract artefact verification** — list every file this session claims to have created/edited, `ls`/grep each, confirm presence.
- [ ] **G10.5 external-reviewer gate** — `general-purpose` sub-agent verdict `PASS` or `PASS_WITH_NOTES`; attached verbatim to handoff; notes → `PATCHES_OWED.md`.
- [ ] **G10 manual browser verification** — non-skippable for UI sessions per AUTONOMY_PROTOCOL. Start dev server (`npm run dev`), load `/lite/inbox` at desktop width, exercise all 10 left-nav views, open Compose, open Refine sidecar, send a mock draft (mock server action if database empty). Screenshot the three-column shell.
- [ ] **Memory-alignment declaration** — handoff lists every applied memory with one-line "how applied" (this brief names 11 in §13).
- [ ] G-gates end-to-end (G0 → G12).

## 10. Notes for the next-session brief writer (UI-9)

UI-9 is the per-contact Conversation view (§4.2 — flattened thread history). Things UI-9 will need from UI-8:

- **Where the click lives.** Thread detail header's contact name is an `aria-disabled` link in UI-8. UI-9 flips it to a real link → `/lite/inbox/conversation/[contactId]` (route to be spec'd in UI-9 brief).
- **The `readThread` query.** UI-9 wants a `readContactConversation(contactId)` helper that returns every thread for the contact + messages interleaved chronologically. New query helper, not modifying `readThread`.
- **Reply path.** Conversation view is read-only navigation per spec §4.2. To reply, user clicks into a specific thread (which loads in `/lite/inbox`). No composer on the Conversation view surface. UI-9 reuses UI-8's `conversation-stream.tsx` rendering.
- **Design-system binding.** UI-9 should reuse UI-8's `conversation-stream.tsx` at the cost of one breakage if UI-9 wants channel-icon swaps (email ↔ portal chat ↔ task feedback). Add a `variant: "thread" | "conversation"` prop — don't fork the component.

## 11. PATCHES_OWED additions (provisional — append at G12)

1. `THREAD_LIST_PAGE_SIZE = 50` → settings key candidate.
2. `POLL_STALE_MS = 30_000` → settings key candidate; also replace with SSE in Wave-E.
3. `COMPOSE_MODAL_MAX_WIDTH_PX = 720` → settings key candidate.
4. Low-confidence flag rendering toggle (inline span vs list view) — currently hardcoded to inline span; Phase 3.5 may want a user preference.
5. Contact-picker CRM search — if no server action exists for "search contacts by name/email", UI-8 writes a minimal one inline; proper search API (trigram index, rate-limited) is a post-UI-8 task.
6. Attachment upload UI — deferred to UI-10 (ticket overlay session) or a later file-handling session; tooltip disables the button for now.
7. Calendar invite RSVP buttons — stub action logs activity; real wiring in UI-10 + `lib/calendar/*`.
8. Draft-regenerate button on stale banner — calls `enqueueTask("inbox_draft_generate")` inline via a thin helper; proper retrigger surface is a PATCHES_OWED candidate if Phase 3.5 wants it split out.

## 12. Silent locks (per `feedback_technical_decisions_claude_calls` — NOT asked to Andy)

1. **Three-column shell is a CSS-grid layout, not a framework chrome primitive.** `grid-template-columns: 240px 360px 1fr`. Tailwind arbitrary values.
2. **Left-nav state is URL-synced via `/lite/inbox?view=focus&address=all`.** Server component reads `searchParams`, passes to `listThreads`. Back/forward navigation works.
3. **Thread-list pagination: no infinite scroll in UI-8.** First `THREAD_LIST_PAGE_SIZE = 50` threads render; "Load more" button at bottom if more exist. Infinite scroll has a long tail of a11y bugs — skip for v1.
4. **Thread-detail route: `/lite/inbox/[threadId]?view=focus`** (view preserved for nav state). Server component fetches via `readThread`. Client composer hydrates.
5. **Compose modal is a `<Dialog>`, not a `<Sheet>`.** Spec says "modal sheet" but shadcn's Sheet is side-anchored; Dialog is centred and matches §4.4's "centred sheet" intent. Mobile holding page renders the same Dialog but with full-screen variant (won't ship in UI-8 — only desktop).
6. **Refine sidecar is a `<Sheet>` anchored right.** Slides in from the right edge via `houseSpring`. Reply composer compresses laterally; thread detail doesn't unmount. Ephemeral turn list in `useState<RefineTurn[]>([])`. No server persistence (spec §7.4).
7. **Low-confidence inline spans use `<mark className="bg-pink-100 underline decoration-pink-300">`.** Spec §16 #63 — flag is a hint not a warning; brand-accent pink, not brand-red.
8. **Stale banner: non-intrusive.** Small inline pill above composer body, not a full-width banner. Regenerate button enqueues a fresh draft; polling every 30s picks up the new body. Andy's in-progress edits never clobbered (§16 #60).
9. **Kill-switch behaviour.** `inbox_send_enabled` off → Send button disabled + tooltip. `llm_calls_enabled` off → Draft / Refine buttons disabled + tooltip. Buttons visible, not hidden — Andy needs to understand *why* something isn't working.
10. **Attachment strip (thumbnail-only).** Clicking opens attachment in a new tab via `/api/inbox/attachments/[id]` (new route owed? check existing routes — if absent, file as PATCHES_OWED, leave disabled).
11. **Contact picker: SQLite `LIKE` on `contacts.name` + `contacts.email`.** No fuzzy search. First 20 results. Good enough for v1.
12. **Sort menu default: `last_message_at_ms DESC`.** "Unread first" toggles the ORDER BY. "Priority first" sorts signal > noise > spam then by timestamp. All three server-side.
13. **Mobile holding page at viewport < 900px.** Single `<MediaQuery>` hook; replaces the three-column shell with a centred message. No responsive layout at all — intentional, per §11 (UI-11 is the real mobile session).
14. **"Support" view in left nav** renders but filters to `sending_address = 'support@'`. No ticket overlay. Placeholder chip on support@ threads says "ticket UI lands in UI-10" with muted styling.
15. **Contact-name click in thread header** → `aria-disabled` with `<Tooltip>`. No URL change. UI-9 wires it.
16. **`_components` directory convention.** Following existing App Router pattern in this repo (see `app/lite/quotes/`). Do not invent a new convention.

## 13. Memory alignment gates (G10.5 reviewer will check)

- **`feedback_technical_decisions_claude_calls`** — §12 locks all silently. No technical questions to Andy.
- **`feedback_motion_is_universal`** — every state change gets motion. Modal open, sidecar open, thread swap, stale-banner appear, low-confidence flag pulse-on-focus all use `houseSpring`.
- **`feedback_visual_references_binding`** — read `mockup-unified-inbox.html` if it exists; if not, bind to design-system-baseline §3 (three-column shell pattern) + §6 (BHS allocations) + §7 (warm table recipe). **Do not ship generic shadcn defaults.**
- **`feedback_individual_feel`** — inbox is admin-only; still apply: thread-detail header feels like Andy's inbox, not a shared platform. Brand-cream surface, Righteous eyebrow, dry voice throughout.
- **`feedback_primary_action_focus`** — no fallback UX in Compose / Refine. Edge cases push to PATCHES_OWED or a support email. Send/Save/Discard/Refine are the only actions in the compose modal; everything else is disabled with a tooltip.
- **`feedback_no_lite_on_client_facing`** — inbox is admin; not a concern here, but watch that the mobile holding page copy doesn't say "SuperBad Lite mobile" — just "SuperBad".
- **`feedback_takeaway_artefacts_brand_forward`** — not applicable (no exports in UI-8).
- **`project_two_perpetual_contexts`** — UI-8 displays cached draft + low-confidence flags generated by UI-5 / UI-6 / UI-7 which already honour this. UI-8 just surfaces them.
- **`project_llm_model_registry`** — UI-8 makes zero LLM calls directly. All LLM goes through `refineDraft` / `draftComposeIntent` / stale-banner regenerate.
- **`project_context_safety_conventions`** — UI-8 doesn't author prompts. No prompt-file work.
- **Voice profile** — dry, observational, self-deprecating, slow burn. Every voice-treated surface in §2 (ui-8 brief) goes through the voice lens. Ban "synergy", "leverage", "solutions".

## 14. Verification-gate checklist (G0 → G12 condensed)

- **G0 (kickoff):** read this brief + UI-6 + UI-7 handoffs. Do not re-read specs.
- **G1 (preconditions):** verify §7 list. Stop on any failure.
- **G2 (file whitelist):** confirm every file about to be touched is in §5. "Must not touch" list obeyed.
- **G3 (motion review):** every motion surface uses `houseSpring`; Tier-2 slots registered.
- **G4 (settings-literal grep):** any numeric/string literal in an autonomy position → `settings.get` or PATCHES_OWED.
- **G5 (mid-session 70% context):** write interim handoff + enqueue ui-8b if hitting budget.
- **G6 (rollback):** one declaration (feature-flag-gated).
- **G7 (artefact verification):** ls/grep every claimed file.
- **G8 (tsc + tests + build + lint):** all green. Expect `rm -rf .next && npm run build` if rmdir glitch recurs.
- **G9 (critical-flow E2E):** UI-8 is not itself a critical flow; the UI-8-E2E assignment (if scheduled) lands later. No Playwright in this session.
- **G10 (manual browser verification):** non-skippable for UI. Desktop + viewport < 900 holding page.
- **G10.5 (external reviewer):** `general-purpose` sub-agent verdict attached verbatim.
- **G11 (handoff + next-brief):** write this session's handoff + pre-compile the UI-9 brief per G11.b rolling cadence.
- **G12 (close-out):** tracker flip → ui-9. CLOSURE_LOG prepend. PATCHES_OWED append. Commit.

---

## G0 kickoff ritual (condensed)

1. Read this brief.
2. Read `sessions/ui-7-handoff.md` + `sessions/ui-6-handoff.md` + `sessions/ui-5-handoff.md`.
3. Spot-read spec §§4.1, 4.4, 4.6, 7.4, 16 disciplines #53/#60/#63. **Do not** reread §8.3 (Conversation view — UI-9), §4.3 (Support overlay — UI-10), §4.5 (Mobile — UI-11), §13 (setup wizard — SW-5).
4. Read `lib/graph/index.ts` + `app/lite/inbox/compose/actions.ts` to confirm server-action contracts.
5. Verify all preconditions in §7.
6. Lock silent decisions per §12.
7. Build order:
   1. `_queries/list-threads.ts` + `_queries/read-thread.ts` (server helpers — tests co-author).
   2. `page.tsx` + `inbox-shell.tsx` + `view-filter-tabs.tsx` (three-column shell).
   3. `thread-list.tsx` + `thread-list-row.tsx` + `empty-state.tsx`.
   4. `thread-detail.tsx` + `conversation-stream.tsx`.
   5. `reply-composer.tsx` + `low-confidence-flags.tsx` (binds UI-5/UI-6 cached draft + `sendCompose`).
   6. `refine-sidecar.tsx` (binds UI-7 `refineDraft`).
   7. `compose-modal.tsx` + `contact-picker.tsx` (binds UI-6 compose actions).
   8. `mobile-holding.tsx` + viewport guard.
   9. Motion wiring: Tier-2 choreographies for modal / sidecar / thread-swap.
   10. Tests (query + composer + sidecar).
   11. Typecheck + test + build + lint (G8).
   12. Manual browser verify + screenshot (G10).
   13. G10.5 external reviewer.
   14. Handoff + UI-9 brief + tracker flip + closure-log prepend + PATCHES_OWED block + commit.

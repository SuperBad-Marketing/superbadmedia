# `ui-10` — Support@ ticket overlay + attachment upload + calendar RSVP wiring — Brief

> **Pre-compiled at UI-9 G12 close-out per AUTONOMY_PROTOCOL.md §G11.b.**
> Read this brief. Do **not** read all 21 specs. If any precondition in §7 is missing, stop (G1).

**Wave:** 10 (Unified Inbox 10 of 13)
**Type:** UI + schema extension + light worker (attachment upload) + Graph API (RSVP)
**Size:** medium-to-large — new `inbox_support_tickets` table (or extension to existing `support_tickets`), overlay UI layer above UI-8's thread detail, Haiku-tier type classifier, attachment upload wired through Graph, calendar RSVP wired through Graph. Replaces two UI-8 stubs.
**Model tier:** `/deep` (Opus) — spec §4.3 requires Haiku-tier type classification + status auto-transitions + customer-context panel with Client Context Engine reads + two Graph API wiring replacements; Sonnet-safe would miss the inbox-ticket vs report-issue-ticket table naming collision or the RSVP semantics.
**Spec:** `docs/specs/unified-inbox.md` §4.3 (Support@ ticket overlay — full text verbatim), §4.6 (voice-treatment sprinkle surfaces), Q4 (two-address UX), §8.3 (shared query surface). §16 disciplines: #60 (composer dirty-state preserved during overlay open), #63 (type classifier conservative fallback to `other`), #56 (thread-level aggregate — ticket status is thread-level, not message-level).
**Precedent:**
- `sessions/ui-1-handoff.md` — Graph sync layer. Attachment upload + RSVP both need Graph API calls.
- `sessions/ui-5-handoff.md` / `sessions/ui-6-handoff.md` / `sessions/ui-7-handoff.md` — LLM invocation conventions (`lib/ai/invoke.ts` wrapper, no direct Anthropic SDK).
- `sessions/ui-8-handoff.md` — Attachment strip + calendar RSVP stub locations; support@ placeholder chip location; compose modal attach/invite buttons.
- `sessions/ui-9-handoff.md` — **Direct precedent.** URL-param navigation convention (`?ticket=<id>` or `?thread=<id>`-derived); sibling-render pattern for detail-slot layering; composer preservation architecture.

UI-10 is the **support@ mode**. When Andy selects a support@ thread, an overlay layer adds ticket chrome above UI-8's single-thread detail: type chip (Claude-classified), status pill, Close-ticket action, and a right-side collapsible Customer Context panel. UI-10 also replaces two UI-8 stubs: attachment upload via Graph, and calendar-invite RSVP via Graph.

---

## 1. Identity

- **Session id:** `ui-10`
- **Wave:** 10 — Unified Inbox (10 of 13)
- **Type:** UI + schema + light worker + Graph wiring
- **Model tier:** `/deep` (Opus)
- **Sonnet-safe:** no — §4.3 type classifier (Haiku) + status auto-transition state machine + customer-context CCE read + attachment upload round-trip + RSVP reply-without-body Graph semantics would each regress on `/quick`.
- **Estimated context:** medium-to-large — reads UI-8 + UI-9 handoffs (direct precedents), spec §4.3 + §4.6 verbatim, Graph attachment/calendar docs via the UI-1 wrapper, and touches three new files + ~four edits + two tests.

## 2. Spec references (summarised — don't reread unless ambiguity arises)

- **§4.3 Support@ ticket overlay** — authoritative shape.
  - **Type chip** (Claude-assigned Haiku-tier): `billing | bug | question | feedback | refund | other`. Clickable to re-classify manually (dropdown or cycle).
  - **Status pill**: `Open | Waiting on customer | Resolved`. Auto-transitions: on Andy-send → `Waiting on customer`; on inbound reply from customer → `Open`; on Close-ticket → `Resolved`; on inactivity >7d → `Resolved` (auto, via scheduled task). Manually settable from the pill itself.
  - **Close-ticket action**: combines reply + set-status-Resolved in one click. Sits alongside Send in the composer.
  - **Customer context panel**: collapsible right-side panel. Subscription tier, billing cadence, last payment, usage stats, links to recent activity. Reads from Client Context Engine + SaaS Subscription Billing records.
  - **Support@ view filters** (existing in UI-8 left nav): all / open / waiting / resolved / unassigned-type. Unassigned-type = Haiku returned `other` or fallback.
- **§4.6 voice-treatment sprinkle surfaces** — three UI-10-scoped: "Resolved" pill copy, Customer Context panel intro line, Close-ticket confirmation toast.
- **Q4 two-address UX** — ticket overlay is exclusive to `support@` threads. `andy@` threads never get ticket chrome. Check `thread.sending_address` to gate overlay render.
- **§16 disciplines applicable to UI-10:**
  - **#60 — draft invalidation protects in-progress edits.** Opening the Customer Context panel, toggling the type chip, or clicking the status pill must NOT unmount the ReplyComposer. Overlay chrome layers above the thread detail; composer state stays mounted.
  - **#63 — noise classifier errs conservative.** Type classifier falls back to `other` on any LLM error, empty response, or parse failure. Unassigned-type bucket is the safe home.
  - **#56 — thread-level aggregate.** Ticket status is per-thread, not per-message. `support_tickets.thread_id` is the FK (1:1 with threads, on `thread.sending_address = 'support@'`).

## 3. Acceptance criteria

```
§4.3: Selecting a support@ thread renders the ticket overlay above UI-8's
thread detail. Type chip is populated (Haiku classifier on first render
for threads with no prior ticket row; cached on `support_tickets.type` for
re-render). Status pill displays current status; auto-transitions fire on
Andy-send (Waiting) / customer-reply (Open) / Close-ticket (Resolved) /
>7d inactivity (Resolved via cron). Close-ticket action appears in the
composer action row alongside Send.

§4.3 Customer Context panel: collapsible right-side panel renders when
the thread has a linked contact. Reads subscription tier + billing
cadence + last payment + usage stats + last 5 activity_log entries for
the contact. Collapses/expands without unmounting the composer.

UI-8 attachment strip upgrade: drag-drop or click-to-upload attachments
via Graph API. Upload progress, error states, retry. Download-only was
UI-8.

UI-8 calendar RSVP upgrade: `inbox_calendar_rsvp_todo` stub activity
replaced with real RSVP via Graph. Accept / Tentative / Decline buttons
fire the RSVP and log `inbox_calendar_rsvp_sent` with the choice.

Q4: `andy@` threads still never render ticket chrome. The overlay is
strictly gated on `thread.sending_address === 'support@'`.

§16 #60: Opening the Customer Context panel, clicking the type chip, or
clicking the status pill does NOT reset the ReplyComposer dirty body.
```

## 4. Files in play

**Create:**

- `lib/db/schema/inbox-support-tickets.ts` — **naming-collision flag: `support_tickets` already exists for `reportIssue()` surface (B1).** Use `inbox_support_tickets` or `ticket_overlays` for the inbox-side table. Columns: `id`, `thread_id` (FK → threads), `type` (enum: billing|bug|question|feedback|refund|other), `status` (enum: open|waiting_on_customer|resolved), `type_assigned_by` (enum: claude|andy), `resolved_at_ms`, `created_at_ms`, `updated_at_ms`. Indexes: `by_thread`, `by_status`.
- `lib/graph/classify-support-ticket-type.ts` — Haiku-tier classifier. Input: thread subject + first 3 inbound message bodies. Output: `{ type: SupportTicketType }`. New LLM slug `inbox-support-type` (Haiku). Zod-validated. Conservative fallback to `other` on any failure.
- `app/lite/inbox/_components/ticket-overlay.tsx` — client component. Type chip + status pill + Close-ticket button wired through server actions. Customer Context panel (collapsible) renders when `thread.contact_id` is set.
- `app/lite/inbox/_components/customer-context-panel.tsx` — client component. Subscription tier + billing cadence + last payment + usage stats + recent activity. Reads via new server helper `loadSupportCustomerContext(contactId)`.
- `app/lite/inbox/_queries/load-support-customer-context.ts` — server query helper. Composes reads from `saas_subscriptions` + `deals` + `activity_log` for the contact.
- `app/lite/inbox/_components/attachment-upload.tsx` — client component replacing UI-8's download-only strip. Drag-drop zone + file input + upload progress + error/retry.
- `app/lite/inbox/_components/calendar-rsvp-buttons.tsx` — client component replacing UI-8's toast stub. Accept / Tentative / Decline buttons.
- `lib/graph/upload-attachment.ts` — Graph API wrapper. Upload file to a message or draft.
- `lib/graph/rsvp-calendar-invite.ts` — Graph API wrapper. Accept / Tentative / Decline response to a meeting invite.
- `lib/scheduled-tasks/handlers/inbox-ticket-auto-resolve.ts` — handler for new task type `inbox_ticket_auto_resolve_idle` (scans `inbox_support_tickets` with `status != 'resolved'` and `updated_at_ms` older than 7d; flips to `resolved`; logs `inbox_ticket_auto_resolved`).
- `app/lite/inbox/ticket/actions.ts` — server actions: `setTicketType(ticketId, type)`, `setTicketStatus(ticketId, status)`, `closeTicket(ticketId, replyBody)` (combines reply + set-Resolved), `uploadAttachmentToDraft(threadId, file)`, `respondToCalendarInvite(messageId, response)`.
- `tests/inbox-classify-support-ticket-type.test.ts` — ~5 tests. Happy-path each type (billing/bug/question); empty body → other; kill-switch off → other; malformed response → other.
- `tests/inbox-ticket-overlay.test.tsx` — ~5 tests. Overlay visible on support@; hidden on andy@; chip renders; pill renders; Close-ticket action present on support@ only.
- `tests/inbox-ticket-auto-resolve-handler.test.ts` — ~3 tests. Idle ticket resolved; active ticket untouched; already-resolved ticket untouched.

**Edit:**

- `app/lite/inbox/page.tsx` — gate ticket overlay on `thread.sending_address === 'support@'`; render as overlay/sibling above UI-9 `detailSlot`; pass ticket payload from new server helper.
- `app/lite/inbox/_components/thread-detail.tsx` — add ticket overlay slot above composer; replace attachment-strip stub with `<AttachmentUpload>`; replace calendar RSVP stub toast with `<CalendarRsvpButtons>`.
- `app/lite/inbox/_components/compose-modal.tsx` — enable Attachment + Calendar Invite buttons (UI-8 left them disabled with "UI-10" tooltips).
- `app/lite/inbox/_components/reply-composer.tsx` — add "Close ticket" button alongside Send for support@ threads; wire to `closeTicket()` server action.
- `lib/db/schema/index.ts` — export `inbox_support_tickets`.
- `lib/ai/models.ts` + `lib/ai/prompts/INDEX.md` + `lib/ai/prompts/unified-inbox.md` — register `inbox-support-type` (Haiku) slug + prompt.
- `lib/scheduled-tasks/task-types.ts` — add `inbox_ticket_auto_resolve_idle` + register handler in worker switch.
- `lib/db/schema/activity-log.ts` — add `inbox_ticket_type_assigned`, `inbox_ticket_type_changed`, `inbox_ticket_status_changed`, `inbox_ticket_resolved`, `inbox_ticket_auto_resolved`, `inbox_calendar_rsvp_sent`, `inbox_attachment_uploaded`.
- `app/lite/inbox/compose/actions.ts` — `sendCompose` / `saveComposeDraft` gain optional `attachments: File[]` param; on support@ send, fire `setTicketStatus(..., 'waiting_on_customer')` post-send.

**Must not touch:**

- `lib/graph/sync.ts` core inbound router — status auto-transitions for inbound-reply-on-resolved-ticket can be called from `sync.ts` via a small hook, but the router's classification logic stays frozen.
- `lib/graph/draft-reply.ts`, `lib/graph/compose-draft.ts`, `lib/graph/refine-draft.ts` (UI-5/6/7 library layer frozen).
- `lib/db/schema/messages.ts` (no new columns).
- `app/lite/inbox/_components/conversation-view.tsx` — UI-9's Conversation view does not render ticket chrome. Ticket overlay sits on top of the single-thread detail only.
- `app/lite/inbox/_components/mobile-holding.tsx` — mobile surface is UI-11.
- The existing `support_tickets` table (B1 reportIssue) — do not conflate with the inbox-side ticket table. Use a distinct name.

## 5. Tests to write

- `tests/inbox-classify-support-ticket-type.test.ts` — per-file SQLite not needed; pure LLM-wrapper test. Mock `invokeLlmText`. 5 tests.
- `tests/inbox-ticket-overlay.test.tsx` — `renderToStaticMarkup` + mocked payload. Overlay rendered on `support@` only; type chip + status pill + Close-ticket; Customer Context panel header; collapsed-state default. 5 tests.
- `tests/inbox-ticket-auto-resolve-handler.test.ts` — per-file SQLite DB. Seed 3 tickets (idle >7d, idle <7d, already-resolved). Assert handler flips only the first. 3 tests.
- **Coverage gap acknowledged up front** (matches UI-5/6/7/8 precedent): server actions `setTicketType`, `setTicketStatus`, `closeTicket`, `uploadAttachmentToDraft`, `respondToCalendarInvite` have no unit tests this session — auth-gate + Graph API-mocking is painful without a full E2E harness. Log to PATCHES_OWED as `ui_10_server_action_tests_owed` for the same E2E wave as UI-6/7/8.

## 6. Voice surfaces

- **"Resolved" pill copy**: one word. No tooltip. The green colour is the emotion.
- **Customer Context panel intro line** (when the panel first opens): "Who they are, where they are." (or similar — matches `project_two_perpetual_contexts` memory). Brief author; Andy can swap.
- **Close-ticket confirmation toast**: "Closed. They'll hear back when they need to." — dry, brand-narrative tone. Brief author.
- **Upload error toast**: "That file didn't want to go. Try again or drop a different one." — UI-8's copy pattern.
- **RSVP success toast**: "Accepted. Calendar pinged." / "Marked tentative." / "Declined. They'll get the note." — plain, unfussy.

## 7. Preconditions to verify at G1

- [ ] `thread.sending_address` column exists and is populated for imported threads — check `lib/db/schema/messages.ts`.
- [ ] Existing `support_tickets` table (B1) does NOT conflate with the new `inbox_support_tickets` — grep to confirm the name is free, or pick `ticket_overlays` / `inbox_tickets`.
- [ ] `contacts` + `deals` + `saas_subscriptions` schemas support the Customer Context reads — check each exists.
- [ ] Graph API wrapper supports attachment upload + RSVP — UI-1 handoff documents what's already there; check `lib/graph/` for any half-built helpers.
- [ ] `invokeLlmText` + `lib/ai/invoke.ts` + `lib/ai/models.ts` registration pattern (per UI-5/6/7) is the path; no direct Anthropic SDK imports.
- [ ] Kill switches: reuse `llm_calls_enabled` for the type classifier; no new kill switch needed unless RSVP/upload warrants one — evaluate at G1.
- [ ] UI-8 stub locations: attachment strip in `thread-detail.tsx` + compose modal attach button + calendar RSVP buttons in `thread-detail.tsx` (`inbox_calendar_rsvp_todo` activity). Confirm all three are still present.
- [ ] UI-9 sibling-render pattern in `page.tsx` — plan how ticket overlay layers above both `threadDetailNode` and `conversationNode` (ticket overlay MUST NOT render when conversation view is active per §4.2).
- [ ] Motion conventions: `houseSpring`, `useReducedMotion`, `<AnimatePresence>` for panel collapse.

## 8. Kill switches + rollback

- No new kill switch by default; classifier inherits `llm_calls_enabled`. Evaluate at G1 whether attachment upload or RSVP should add new gates.
- Rollback = `git revert` or drop the new table + disable the overlay render in `page.tsx`. UI-8 attachment/RSVP stubs come back via revert.

## 9. Gates that apply

- G0 — read this brief + UI-8 + UI-9 handoffs.
- G1 — verify §7 preconditions; silently lock naming collision (pick `inbox_support_tickets` or alternative); confirm RSVP/upload Graph availability.
- G2 — files-in-play match §4 whitelist.
- G3 — Tier-1 motion only (`houseSpring`, `<AnimatePresence>` for Customer Context panel collapse, type-chip dropdown, Close-ticket confirmation).
- G4 — no new module constants expected; 7d auto-resolve threshold goes into `settings` table (`inbox.ticket_auto_resolve_idle_days` = 7) — avoids a new module constant debt.
- G5 — context budget held; do not roll in mobile ticket UI (UI-11).
- G6 — migration required for new ticket table + activity_log enum extensions; no new kill switch unless G1 decides otherwise. Rollback strategy = migration reversible.
- G7 — 0 TS errors, full suite green (targeting ~1028 tests after +13 new), clean build, lint unchanged.
- G8 — `npx tsc --noEmit` + `npm test` + `npm run build` + `npm run lint`.
- G9 — UI-8's composer dirty-state + UI-9's Conversation view preservation must not regress. Verify dirty composer on a support@ thread, open/close Customer Context panel, change type chip, click status pill — dirty body intact.
- G10 — manual browser verify: support@ thread opens with overlay; type chip populated via Haiku; status pill displays Open; send fires auto-transition to Waiting; Close-ticket combines reply + Resolved; Customer Context panel collapses/expands; attachment upload round-trips; calendar RSVP Accept/Tentative/Decline fires Graph call; andy@ thread renders WITHOUT overlay.
- G10.5 — external `general-purpose` reviewer against this brief + §4.3 + §4.6 + §16 #60 + #63 + #56.
- G11 — handoff note; UI-11 brief pre-compile (mobile surface).
- G12 — tracker flip + CLOSURE_LOG + PATCHES_OWED append + commit.

## 10. Notes for the next-session brief writer (UI-11)

UI-11 is the **mobile surface** (spec §4.5) — replaces UI-8's `<MobileHolding>` with the real bottom-tab layout: Focus / Search / Noise / Settings tabs, swipe-to-Keep / swipe-to-archive gestures, full-screen thread detail, voice-dictation-friendly composer, simplified refine-chat input, mobile compose nudge sheet, offline caching of last 50 threads. When writing UI-11's brief:

- Cite spec §4.5 verbatim.
- Reference UI-8's `<MobileHolding>` replacement (deletes the holding screen; keeps the viewport gate).
- Reference UI-9's Conversation view surface — mobile Conversation view may collapse differently (full-screen overlay vs slide-over).
- Reference UI-10's ticket overlay — mobile ticket UI compresses the Customer Context panel to a sheet or expandable drawer.
- Call out offline caching requirement — new primitive or reuse browser Cache API / IndexedDB.
- Voice surfaces: "Nothing waiting" mobile variant, voice-dictation hint copy.

## 11. Memory-alignment checklist for the build session

- `feedback_technical_decisions_claude_calls` — lock all implementation choices silently (table name, UX layering, RSVP semantics, upload UX).
- `feedback_motion_is_universal` — panel collapse animates; chip/pill dropdowns animate; upload progress animates.
- `feedback_visual_references_binding` — use `var(--color-*)` / `var(--font-*)` tokens; no raw values; check mockup HTMLs before shipping.
- `feedback_individual_feel` — ticket UI is "this person's open issue with me", not a generic ticketing interface.
- `feedback_primary_action_focus` — Close-ticket is a secondary action alongside Send; don't clutter the composer's hero with multiple CTAs.
- `feedback_no_content_authoring` — voice copy inline; short, in-voice.
- `feedback_setup_is_hand_held` — no raw form for RSVP (buttons) or type re-classification (dropdown of canonical options).
- `project_two_perpetual_contexts` — Customer Context panel reads BOTH Brand DNA context AND CCE snapshots; not just one.
- `project_llm_model_registry` — new Haiku slug `inbox-support-type` registered in MODELS + INDEX + unified-inbox.md. No direct Anthropic SDK imports.
- `project_context_safety_conventions` — any client-component imports from query helpers use `import type` only; split a client-safe helper if needed.
- `project_external_reviewer_gate` — run G10.5 before G11.

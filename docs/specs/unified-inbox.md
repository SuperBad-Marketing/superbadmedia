# Unified Inbox — Feature Spec

**Phase 3 output. Locked 2026-04-13. 13 questions resolved.**

> **Prompt files:** `lib/ai/prompts/unified-inbox.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

SuperBad's single pane of glass for every human-to-human communication the platform touches. Email (both inbound and outbound on `andy@superbadmedia.com.au` and `support@superbadmedia.com.au`), portal chat escalations, task rejection feedback, newsletter subscriber replies, outreach replies, and — future — SMS, Instagram DMs, Facebook Messenger, WhatsApp. One `messages` table, one UI, one set of classifications.

This spec replaces Andy's Outlook as his primary work email client. Outlook remains active as a backup throughout Phase 1 of the M365 migration (Lite as another Graph API client on top of the existing mailbox); Phase 2 (DNS cutover, Lite becomes the mailbox) is a later, lower-risk project once Lite's email UX is proven.

The inbox is also the `messages` backbone the Client Context Engine reads from. Every touchpoint a contact has with SuperBad lands here. One query reconstructs any relationship.

---

## 1. Locked decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | What counts as a "message" | Full consolidation. One `messages` table with a `channel` enum. Email, portal chat, task feedback, newsletter replies, outreach replies, future SMS / social DMs all unified. Rule: if there's a human on both ends, it's a message. |
| Q2 | Email infrastructure | Full migration. `andy@` + `support@` both function through Lite. Outlook drops to worst-case backup. |
| Q3 | How Lite talks to mailbox | Staged migration. Phase 1 = Lite-as-another-client on top of M365 via Graph API; Outlook keeps working unchanged. Phase 2 = DNS cutover later once Lite's UX is proven. This spec covers Phase 1. |
| Q4 | Two-address UX | Unified inbox with ticket overlay on `support@` threads only. `andy@` threads flow as conversations; `support@` threads carry a ticket status (Open / Waiting / Resolved) and a Claude-assigned type chip (billing / bug / question / feedback / refund / etc.). |
| Q5 | Inbound contact routing | LLM routes every inbound. Four categories: match-to-existing-contact / new-lead (auto-create with tag) / non-client (auto-create with `relationship_type: 'non-client'`) / spam (silent archive). Andy re-routes corrections; corrections feed back into prompt. |
| Q6 | Threading model | Topic threads + per-contact Conversation view. Each thread links to a contact. Clicking a contact anywhere opens a flattened chronological Conversation view across all their threads. |
| Q7 | Outbound cross-channel delivery | Hybrid with passive-vs-active rule. Passive channels (portal chat, task feedback) echo to email. Active channels (IG / FB / SMS / WhatsApp) deliver through native transport only — no email echo. |
| Q8 | Reply drafting | Always-drafted for client-facing threads + chat refinement sidecar available. Opus for drafts. Voice-learning via retrieved past Andy-sent messages. Never auto-sends. |
| Q9 | Compose-from-scratch | Single composer with optional AI draft. Contact-aware picker, subject optional, CC/BCC behind toggle. "Draft this for me" takes a one-line intent. |
| Q10 | Notifications | Claude-triaged push notifications + 8am daily digest of everything silenced. Three tiers: urgent (persistent) / push (standard) / silent (inbox only). Learning via ambient corrections. |
| Q11 | History import | 12-month window imported on setup. Older history on-demand backfill per thread. Background sync job with progress. |
| Q12 | Signal/noise + auto-delete | Signal / noise / spam third classification axis. Noise auto-deletes after 30 days (180 days for transactional/receipts), spam after 7. Keep pin overrides. Pre-purge trash bin 14 days. Focus view (signal only) is default. |
| Q13 | Mobile | PWA with read + quick reply + triage. Claude-drafted replies pre-loaded. Compose-new available but discouraged. Outlook mobile stays as escape hatch. |

---

## 2. Product shape

The inbox is a three-column layout on desktop (navigation / thread list / thread detail), a tabbed single-pane on mobile, and — underneath both — the same unified `messages` + `threads` tables.

Every inbound message runs through three independent Claude classification passes:

1. **Inbound router** (Q5): contact resolution + sender-type classification (known / new-lead / non-client / spam).
2. **Notification triage** (Q10): interruption priority (urgent / push / silent).
3. **Signal/noise classifier** (Q12): content priority (signal / noise / spam), with noise sub-classification (transactional / marketing / automated / update).

All three run on every inbound in parallel. Combined cost is negligible (three Haiku calls per email) and latency is sub-2-second. Classifications are stored on the message; any subsequent correction by Andy writes to a shared `classification_corrections` table that all three classifiers read from at inference time for learning.

Every client-facing thread that arrives with a new inbound message triggers a background draft generation (Q8), cached on the thread for zero-click retrieval when Andy opens it.

Threads are topic-scoped. Each thread links to a contact. The per-contact Conversation view (Q6) flattens all of a contact's threads chronologically — the single query the Client Context Engine and Andy's own "what's the state of this relationship" view both consume.

---

## 3. User stories

### 3.1 The morning check-in

Andy opens Lite at 8am. Three things are already on his screen:

- The **morning digest email** (sent at 8am by the system to `andy@`) summarising everything that was silenced overnight — "47 noise threads (12 marketing, 18 automated, 17 transactional receipts), 3 spam auto-archived, zero urgent escalations." Scan-and-dismiss.
- The **Focus inbox view**, default, showing only signal threads. A handful of new inbound messages, each with a Claude draft already waiting inside.
- The **Daily Cockpit tile** (own spec, #12) summarising inbox-side: "2 support tickets open, 1 waiting >48h. 3 threads waiting on you. 1 unreviewed outreach reply."

He clicks the first thread. It's a client confirming a shoot date. Claude's draft is in the composer: *"All good — I'll see you Thursday 10am. I'll bring the full kit so we can cover both the outdoor and studio looks in one go."* Andy reads, changes one word, sends. Thirty seconds.

Next thread: support@ ticket, type chip reads "billing," status reads "Open." Customer is confused about a subscription renewal. Claude's draft references their specific tier and renewal date (because Claude has Client Context). Andy sends. Thread auto-flips to "Waiting on customer."

Third thread: new inbound from a prospect. Classified as `new-lead` by Q5, auto-created as a contact with a tag. Claude's draft opens with a warm acknowledgement and an offer for a trial shoot — Brand DNA context means the draft is in SuperBad's voice. Andy tweaks the second paragraph, sends.

Thirty minutes of email, finished in eight. He doesn't touch Outlook all day.

### 3.2 The portal chat escalation

A retainer client is chatting with the portal bartender about a late deliverable. Bartender can't de-escalate — client is frustrated. Bartender escalates to Andy. A thread appears in Andy's inbox with `channel: 'portal_chat'` and the full chat history as the first message (direction: inbound). Claude drafts a reply that acknowledges the delay specifically and offers a concrete new delivery date.

Andy edits and sends. The reply goes out two ways: email to the client's registered address (email echo, per Q7), and posts back into the portal chat thread (native surface, for when they return to the portal). Either path they take to reply lands back in the same thread.

### 3.3 The receipt

A PayPal receipt for a software subscription lands overnight. Q5 routes sender as `non-client`, Q10 notifies silently, Q12 classifies as `noise` → `transactional`. `keep_until` is set to 180 days. Andy never sees it unless he searches for it. In 180 days, unless he's engaged with it (opened, replied, pinned), it moves to the 14-day trash bin, then hard-deletes. If he needs it for tax, it's been there for six months and he can find it via search.

### 3.4 The supplier coordination

Andy composes a new email to a supplier who isn't in the CRM yet. He types "gabriel@pri..." — the contact picker has no match. He clicks "Use `gabriel@printshop.com` as new recipient." Types "Hey, wondering if you can turn around 50 postcards by Friday — are you set up for that?" Sends.

On send: Q5 router fires, classifies the recipient as `non-client` / `supplier`, creates a stub contact with `relationship_type: 'non-client'`. Thread now has a proper contact link. No pipeline pollution. Tomorrow when Gabriel replies, the thread continues cleanly.

### 3.5 The mobile moment

Andy is at a shoot. Push notification: urgent — a client has replied to an open support ticket with "this is still broken, it's been three days." He taps the notification on his phone. The PWA opens directly to the thread. Claude's draft is ready: an apology + acknowledgement + a specific action ("let me push this fix within the hour"). He taps "Send." Thirty seconds, standing on a sidewalk.

---

## 4. UI description

### 4.1 Desktop — three-column layout

**Left column — navigation (narrow):**

- Compose button (top, prominent — primary action, brand-accent colour)
- Focus (default view, signal threads)
- All (signal + noise interleaved, noise visually muted)
- Noise (noise-only, hunt for receipts)
- Support (support@ threads with ticket overlay)
- Drafts
- Sent
- Snoozed
- Trash (pre-purge 14-day bin)
- Spam (silent-archive from Q5, 7-day auto-purge)
- Divider
- Address filter toggle — All addresses / `andy@` / `support@`
- Divider
- Settings (bottom)

No folders or manual labels. Classifications are automatic, views are filters.

**Middle column — thread list:**

Each thread row shows:
- Sender name + subject line (one row)
- Preview snippet of latest message (one row, truncated)
- Metadata chips row: channel icon, classification chips (ticket status + type for support@, relationship_type for client threads, low-confidence indicator if present)
- Timestamp (right-aligned)
- Unread indicator (bold)
- Pin indicator (if pinned)

Thread list is chronological by latest message. Sort options (unread first, priority first) in a small menu, but default is chronological.

**Right column — thread detail:**

- Thread header: contact name (clickable → opens Conversation view), company, thread subject, channel of origin, ticket status + type (if support@), Keep/unkeep toggle
- Conversation stream: messages chronologically, inbound vs outbound visually distinct (matches locked design-system baseline)
- Attachment strip per message (images inline preview, PDFs thumbnail)
- Calendar invite (if .ics in message): parsed, RSVP chip inline with Accept/Decline/Tentative buttons
- Reply composer at bottom (sticky):
  - **Draft pre-loaded** if thread has a cached Claude draft
  - Signature auto-appended based on sending address
  - Refine-chat sidecar button (opens side panel for instruction-based rewrite)
  - Attachment button
  - Calendar-invite button (opens calendar picker → attaches .ics)
  - Send / Send & Snooze / Send & Close-ticket (for support@)

### 4.2 Per-contact Conversation view

Activated by clicking the contact's name anywhere. Takes over the thread detail column, flattening all of that contact's threads chronologically into one scroll. Each thread in the flattened view is collapsible (default expanded if unread, collapsed if read). Channel icons distinguish email from portal chat from task feedback.

This view is read-only for navigation — to reply, click into a specific thread. Serves the "give me the full relationship" cognitive mode.

### 4.3 Support@ ticket overlay

Support@ threads get additional UI in the thread detail:

- **Type chip** (Claude-assigned): billing / bug / question / feedback / refund / other. Clickable to re-classify manually.
- **Status pill**: Open / Waiting on customer / Resolved. Auto-transitions on send/reply/inactivity; manually settable.
- **Close ticket** action alongside send: combines reply + set to Resolved in one click.
- **Customer context panel** (collapsible, right side): subscription tier, billing cadence, last payment, usage stats, links to recent activity. Reads from Client Context Engine + SaaS Subscription Billing records.

Support@ view in left nav has additional filters: all / open / waiting / resolved / unassigned-type.

### 4.4 Compose-new (modal sheet on desktop, full-screen on mobile)

Header:
- To: (contact picker — search CRM, keyboard arrows, Enter to select; fallback "Use [typed-string] as new recipient")
- Cc / Bcc toggle (hidden by default)
- Subject: (optional — auto-generates at send time from body if blank)
- Sending address selector (small, defaults to `andy@` for personal compose, `support@` for support-context compose)

Body:
- Plain text composer, auto-sizing
- Signature visible, part of the body (editable if Andy wants to remove it for a specific email)

Actions row:
- **"Draft this for me"** small button → opens one-line intent input → triggers Opus draft with contact context → populates body
- Attachments
- Calendar invite
- Refine-chat (if draft present)
- Send / Save to drafts / Discard

### 4.5 Mobile — bottom-tab layout (PWA)

Tabs: Focus / Search / Noise / Settings. Urgent notifications deep-link to thread.

- Thread list: one-line sender + one-line snippet + time. Swipe right = Keep, swipe left = archive.
- Thread detail: full screen, conversation stream, Claude-drafted reply pre-loaded below. Tap-to-edit, voice dictation via native keyboard, one-tap send.
- Refine-chat on mobile: simplified, single-line instruction input, re-draft, no sidecar panel.
- Compose-new: nudge sheet discourages ("better on desktop") but allows.
- Offline: caches last 50 threads + drafts, queues mark-as-read and reply actions for sync on reconnect.

### 4.6 Voice treatment — sprinkle surfaces

Flagged for Content Mini-Session:

- Morning digest email subject + body (on quiet mornings: no send)
- Low-confidence chip copy ("I'm unsure about the Tuesday deadline — check before sending" tone)
- "Continue in your portal" email footer for portal-originated threads
- Compose-new nudge sheet on mobile copy
- Empty-state copy (empty Focus view: "Nothing waiting. Go make something.")
- Trash-bin copy ("Purged: 47 noise, 3 spam. Recoverable for 14 days.")
- Onboarding wizard copy (Graph API consent step)
- "Link contact" interstitial copy
- "Keep-sender promoted to signal" microcopy
- Noise-folder hygiene summary copy ("Inbox stayed clean this week: 147 noise threads auto-purged")
- Setup completion celebration copy

---

## 5. Data model

### 5.1 New tables

**`threads`**
- `id` (pk)
- `contact_id` (fk → contacts, nullable for unresolved routing)
- `company_id` (fk → companies, nullable)
- `channel_of_origin` (enum: email / portal_chat / task_feedback / outreach_reply / newsletter_reply / sms / instagram_dm / facebook_messenger / whatsapp — future-extensible)
- `sending_address` (nullable: 'andy@' / 'support@', null for non-email channels)
- `subject` (nullable)
- `ticket_status` (nullable enum: open / waiting_on_customer / resolved, only populated if channel_of_origin = email and sending_address = 'support@')
- `ticket_type` (nullable string, Claude-assigned for support@ threads)
- `priority_class` (enum: signal / noise / spam — inherits from latest message or can be overridden per thread)
- `keep_until` (nullable timestamp — null = never auto-delete)
- `keep_pinned` (boolean, default false)
- `last_message_at` (timestamp)
- `last_inbound_at` (timestamp, nullable)
- `last_outbound_at` (timestamp, nullable)
- `has_cached_draft` (boolean)
- `cached_draft_body` (nullable text)
- `cached_draft_generated_at` (nullable timestamp)
- `cached_draft_stale` (boolean — flips to true on new inbound)
- `snoozed_until` (nullable timestamp)
- `created_at` / `updated_at`

**`messages`**
- `id` (pk)
- `thread_id` (fk → threads)
- `direction` (enum: inbound / outbound)
- `channel` (enum, same set as threads.channel_of_origin)
- `from_address` (string)
- `to_addresses` (json array)
- `cc_addresses` (json array)
- `bcc_addresses` (json array)
- `subject` (nullable)
- `body_text` (text — always populated, either extracted or original)
- `body_html` (nullable text — original HTML if available)
- `headers` (json — RFC 5322 headers for email)
- `message_id_header` (indexed — email Message-ID for threading)
- `in_reply_to_header` (indexed — email In-Reply-To for threading)
- `references_header` (indexed — email References for threading)
- `sent_at` (timestamp)
- `received_at` (timestamp)
- `priority_class` (enum: signal / noise / spam — Q11/Q12 classifier output)
- `noise_subclass` (nullable enum: transactional / marketing / automated / update / other — only if priority_class = noise)
- `notification_priority` (enum: urgent / push / silent — Q10 classifier output)
- `router_classification` (enum: match_existing / new_lead / non_client / spam — Q5 classifier output)
- `router_reason` (string — one-line Claude explanation for audit)
- `is_engaged` (boolean — replied / pinned / opened-longer-than-15s / forwarded)
- `engagement_signals` (json array of engagement events + timestamps)
- `import_source` (enum: live / backfill_12mo / backfill_on_demand)
- `has_attachments` (boolean)
- `has_calendar_invite` (boolean)
- `graph_message_id` (nullable string — Microsoft Graph API ID for mapping)
- `created_at` / `updated_at`

**`message_attachments`**
- `id` (pk)
- `message_id` (fk)
- `filename`
- `mime_type`
- `size_bytes`
- `r2_key` (storage path)
- `is_inline_image` (boolean)
- `created_at`

**`message_calendar_invites`**
- `id` (pk)
- `message_id` (fk)
- `ics_r2_key` (storage path to original .ics)
- `event_start` (timestamp)
- `event_end` (timestamp)
- `event_summary` (string)
- `event_location` (nullable)
- `organizer_email`
- `rsvp_status` (nullable enum: accepted / declined / tentative / no_response)
- `lite_calendar_event_id` (nullable fk → calendar_events — populated if Andy accepted and it's in his native calendar)
- `created_at` / `updated_at`

**`message_delivery_attempts`**
- `id` (pk)
- `message_id` (fk — outbound messages only)
- `transport` (enum: email_graph / portal_chat / sms / etc.)
- `status` (enum: pending / sent / delivered / bounced / failed / portal_seen)
- `status_reason` (nullable string)
- `attempted_at` (timestamp)
- `delivered_at` (nullable timestamp)

**`notifications`**
- `id` (pk)
- `message_id` (nullable fk — null if system notification not tied to a message)
- `user_id` (fk → users)
- `priority` (enum: urgent / push / silent)
- `fired_transport` (enum: web_push / pwa_push / none — silent = none)
- `fired_at` (timestamp)
- `reason` (string — one-line Claude explanation)
- `correction_action` (nullable enum: user_opened / user_corrected_up / user_corrected_down)
- `correction_at` (nullable timestamp)

Shared across inbox + all system notifications (SaaS payment failures, Content Engine milestones, Daily Cockpit anomalies). All route through the same pipeline.

**`classification_corrections`**
- `id` (pk)
- `message_id` (fk)
- `classifier` (enum: router / notifier / signal_noise)
- `original_classification` (string)
- `corrected_classification` (string)
- `correction_source` (enum: explicit_reroute / engagement_implicit / keep_pinned / etc.)
- `created_at`

Read by all three classifier prompts as few-shot examples for learning.

**`inbox_signature_settings`**
- `id` (pk)
- `sending_address` (enum: 'andy@' / 'support@')
- `signature_html` (text)
- `signature_text` (text — auto-derived plain-text fallback)
- `updated_at`

**`graph_api_state`**
- `id` (pk, one row per user/mailbox)
- `user_id`
- `tenant_id` (Azure AD tenant)
- `client_id` (Azure AD app)
- `refresh_token` (encrypted)
- `access_token` (encrypted)
- `access_token_expires_at`
- `subscription_id` (Graph webhook subscription ID)
- `subscription_expires_at` (Graph subscriptions auto-expire, need renewal)
- `last_delta_token` (for incremental sync)
- `last_full_sync_at`
- `initial_import_status` (enum: not_started / in_progress / complete / failed)
- `initial_import_progress_json` (progress + counts)
- `created_at` / `updated_at`

### 5.2 New columns on existing tables

**`contacts`**
- `relationship_type` (enum: lead / client / past_client / non_client / supplier / personal, nullable) — populated by Q5 router or manually
- `inbox_alt_emails` (json array — secondary email addresses for the contact, detected by LLM matching "emailing from their phone" cases)
- `notification_weight` (integer, default 0 — adjusted by ambient corrections, high positive = always push, high negative = always silent)
- `always_keep_noise` (boolean, default false — from "keep from this sender" action)

**`activity_log.kind`** gains ~18 values (see §11.3).

**`scheduled_tasks.task_type`** gains 5 values (see §11.4).

---

## 6. Channel routing and delivery

### 6.1 Inbound channels

- **Email (`andy@` / `support@`):** Microsoft Graph webhook subscription → inbound handler → parse message → run three classifiers → insert into `messages` → threading via RFC headers → fire notification if needed → trigger draft generation if client-facing.
- **Portal chat escalation:** Client Management's bartender calls `createThreadFromPortalChat(contact_id, chat_history)` → creates thread with channel_of_origin = portal_chat, first message = consolidated chat history (direction: inbound) → runs classifiers → fires notification → triggers draft.
- **Task rejection feedback:** Task Manager calls `createThreadFromTaskFeedback(task_id, feedback_body, contact_id)` → creates thread with channel_of_origin = task_feedback → same downstream pipeline.
- **Outreach reply:** Lead Generation's reply intelligence fires; its reply handler calls `attachMessageToInboxThread(outreach_campaign_id, inbound_email)` → threading via RFC headers + campaign_id fallback → message added to thread with channel_of_origin = outreach_reply if new, else threaded into existing.
- **Newsletter reply:** Content Engine's Resend inbound webhook for reply-to newsletter → `createThreadFromNewsletterReply(...)` → standard pipeline.
- **Future channels:** SMS (Twilio inbound webhook), Instagram DMs (Graph API for Meta), Facebook Messenger, WhatsApp Business API. Each gets its own inbound adapter, same downstream pipeline.

### 6.2 Outbound channels — the passive/active rule

When Andy sends a reply:

1. **Write one `messages` row** with direction = outbound, channel = channel-of-reply (see below).
2. **Dispatch via one or more transports** per the passive/active rule:

| Thread channel of origin | Reply transport(s) |
|--------------------------|--------------------|
| email | email (Graph API send as `from_address`) |
| portal_chat (passive) | portal chat post + email echo to contact's registered address |
| task_feedback (passive) | portal notification + email echo to contact's registered address |
| outreach_reply | email only |
| newsletter_reply | email only |
| instagram_dm (active) | IG DM only, no echo |
| facebook_messenger (active) | FB Messenger only, no echo |
| sms (active) | SMS only, no echo |
| whatsapp (active) | WhatsApp only, no echo |

3. **Email echo branding:** for passive-channel echoes, the email includes a footer: *"You can reply directly to this email or continue the conversation in your portal: [link]."* Footer copy owed to content mini-session.

4. **Per-thread override:** if Andy repeatedly silences the echo on a specific portal-originated thread (e.g. the customer always replies via email anyway), a small toggle on the thread disables future echoes. Ambient behaviour, not a settings panel.

5. **Non-portal contacts auto-skip portal echo.** If the contact has no active portal session (non-client, lead, prospect), portal echo is silently skipped — reply goes email-only. No Andy-facing logic.

6. **Delivery tracking:** each transport writes a `message_delivery_attempts` row. Status flows: pending → sent → delivered (or bounced / failed). Email delivery via Graph API webhook events. Portal delivery status = `portal_seen` when the customer opens it.

### 6.3 Outbound identity

- **Reply to an `andy@` thread:** send as `andy@`. `thread.sending_address` remembers.
- **Reply to a `support@` thread:** send as `support@`.
- **Compose-new:** defaults to `andy@`. Dropdown allows `support@` for explicit support-context compose.
- Graph API requires SendAs permission on both mailboxes — handled at M365 admin level during setup wizard.

---

## 7. The three LLM classification passes

All three fire in parallel on every inbound message. Each uses Haiku. Each reads from `classification_corrections` as few-shot context for learning.

### 7.1 Inbound router (Q5)

**Input:**
- Message body + subject + from address + other headers
- Existing contacts list (scoped by recent engagement or domain match)
- Brand DNA (lightweight — for tone/spam assessment)
- Recent classification_corrections for router

**Output:**
```
{
  classification: "match_existing" | "new_lead" | "non_client" | "spam",
  contact_id: <number|null>,
  new_contact_fields: { first_name, last_name, email, company_name, relationship_type, tag } | null,
  reason: "One-line explanation"
}
```

**Effects:**
- `match_existing`: assign thread.contact_id to matched contact; if from_address is a new email for existing contact, add to contact.inbox_alt_emails.
- `new_lead`: create contact with relationship_type = lead, tag inferred from message content (e.g. "inbound-photography-enquiry"), link thread.
- `non_client`: create contact with relationship_type = non_client / supplier / personal (sub-type by LLM), link thread.
- `spam`: silent-archive, thread hidden from all views, written to Spam folder with 7-day purge timer. Still searchable, still recoverable.

**Correction loop:** Andy can re-route any thread (right-click → Re-route). Correction logs to `classification_corrections` and immediately reshapes the thread.

### 7.2 Notification triage (Q10)

**Input:**
- Message body + subject
- Thread context (is it a client? active retainer? open support ticket? waiting on Andy reply?)
- Contact.notification_weight
- Recent classification_corrections for notifier

**Output:**
```
{
  priority: "urgent" | "push" | "silent",
  reason: "One-line explanation"
}
```

**Effects:**
- `urgent`: persistent desktop/PWA notification until cleared, larger visual treatment on thread, badge on Daily Cockpit.
- `push`: standard push notification, dismissible.
- `silent`: no push, accumulates in morning digest.

**Correction loop:**
- Andy opening a silenced thread within 15 min of arrival → chip offers "Notify me next time from this contact?" → adjusts contact.notification_weight + logs correction.
- Andy dismissing an urgent push without opening → implicit down-correction.

### 7.3 Signal/noise classifier (Q12)

**Input:**
- Message body + subject + from address + domain
- Router output (if from is `noreply@`, strong noise signal)
- Recent classification_corrections for signal_noise

**Output:**
```
{
  priority_class: "signal" | "noise" | "spam",
  noise_subclass: "transactional" | "marketing" | "automated" | "update" | null,
  reason: "One-line explanation"
}
```

**Effects:**
- `signal`: visible in Focus, never auto-deletes.
- `noise` + subclass: visible in Noise (muted in All), keep_until set per subclass (transactional = 180d, others = 30d).
- `spam`: silent-archive, Spam folder, 7d purge.

**Correction loop:**
- Andy pinning a noise thread → per-sender promotion (third pin from same sender → auto-promote that sender to signal going forward).
- Andy moving a Focus thread to Noise → down-correction, sender pattern recorded.

### 7.4 Reply drafter (Q8)

Opus, not Haiku — this is customer-facing text, quality matters.

**Input (full perpetual-context pattern per `project_two_perpetual_contexts`):**
- Thread history (all messages, inbound and outbound)
- Brand DNA profile (as system context, not user context — per discipline)
- Client Context Engine output for the contact (recent activity, sentiment, relationship state)
- Contact's relationship_type, any tags, any associated deals/tasks
- Support@ ticket_type if applicable (shapes prompt scaffold)
- Retrieved recent Andy-sent messages to similar contacts (few-shot voice examples — N=5 to 10, similarity matched by relationship_type + channel + classification similarity)

**Output:**
```
{
  draft_body: "The draft email body",
  low_confidence_flags: [
    { span: "...the Tuesday deadline...", reason: "Mentioned but I don't have context" }
  ]
}
```

**Trigger:** fires as a scheduled task when a client-facing thread receives a new inbound. Writes to `threads.cached_draft_body` + sets `has_cached_draft = true`, `cached_draft_stale = false`. Invalidates (sets `cached_draft_stale = true`) on subsequent inbound; next open regenerates. Invalidates on outbound send (the thread now has a different state).

**Refine-chat:** when Andy opens the refine sidecar, conversation is: his instructions in, new draft out, iterate. Stores as an ephemeral in-memory session, no persistence unless useful for future learning.

**No auto-send. Always explicit send button.** Cannot be configured to auto-send even for "very confident" drafts — policy, not capability. Protects from the worst failure mode.

---

## 8. Threading

### 8.1 Email threading (within channel = email)

- **Primary:** RFC 5322 headers — `Message-ID`, `In-Reply-To`, `References`. If an inbound message's `In-Reply-To` matches a prior message's `Message-ID` in our DB, attach to that thread.
- **Secondary fallback:** if headers are absent (mail merge, "new email but same topic" user behaviour), match on (same from_address + similar subject within 30-day window). Subject similarity uses normalized subject (strip "Re:", "Fwd:", whitespace).
- **Tertiary LLM merge suggester:** Haiku looks at inbound messages whose header + subject fallback both fail. If the content looks like continuation of a recent thread with that contact, surface "Looks like this continues [subject] — merge?" as a one-click action on the thread. Andy confirms; merging is never automatic.
- **Outreach-specific:** outreach emails carry a `campaign_id` in a custom header. Replies attach via RFC headers first, campaign_id + content-match second. Feeds Lead Gen reply intelligence already locked.

### 8.2 Cross-channel — no automatic merging

A portal chat thread and an email thread are separate thread records, even if they're "about the same thing." The per-contact Conversation view (Q6) handles relationship-level navigation; topic-level navigation stays scoped.

**Manual merge:** Andy can merge two threads explicitly from the thread menu ("Merge into another thread"). Contact-scoped only (can't merge threads across contacts). Used rarely. Merged threads become one record, source thread marked archived.

### 8.3 Conversation view

```sql
SELECT m.*
FROM messages m
JOIN threads t ON m.thread_id = t.id
WHERE t.contact_id = :contact_id
ORDER BY m.sent_at ASC
```

One query, cross-channel, chronological. Client Context Engine reads the same way. Conversation view UI renders with collapsibles + channel icons as described in §4.2.

---

## 9. Signal/noise + auto-deletion

### 9.1 Keep-until calculation

On message insert:
- `priority_class = signal` → `keep_until = NULL` (never auto-delete)
- `priority_class = noise` + `noise_subclass = transactional` → `keep_until = sent_at + 180 days`
- `priority_class = noise` + other subclass → `keep_until = sent_at + 30 days`
- `priority_class = spam` → `keep_until = sent_at + 7 days`
- `thread.keep_pinned = true` → override to NULL
- `contact.always_keep_noise = true` → override to NULL

**Thread-level keep_until is the MAX of message-level keep_until values on the thread.** One signal message on an otherwise-noise thread promotes the whole thread to never-delete.

### 9.2 Engagement signals

Whenever any of these occur on a thread, `keep_until` is re-computed with the engagement timestamp as the new baseline (resets the decay clock):

- Replied to (outbound message appended)
- Pinned (keep_pinned → true, overrides to NULL)
- Opened + read for >15 seconds (front-end event → `engagement_signals` append)
- Forwarded
- Starred (synonym for pin)

### 9.3 Auto-delete daily job

Scheduled task fires once daily (`inbox_hygiene_purge`):

1. Find all messages where `keep_until < now()` AND thread has no keep-override AND message has no engagement signal.
2. Move to trash bin (soft delete — set `deleted_at`, hide from all views except Trash).
3. After 14 days in trash, hard-delete (physical row delete + R2 cleanup of attachments).
4. Log summary to `activity_log.kind = inbox_hygiene_purged` with counts by category.

### 9.4 Keep-sender promotion

When Andy pins his **third** noise-classified message from the same sender within a 90-day window:

- `contact.always_keep_noise = true` for that sender.
- Future noise-classified messages from them bypass auto-delete.
- Fires a one-time UI chip: *"I'll keep all future noise from [sender] — undo?"*
- Andy can disable via contact settings.

### 9.5 Historical import + hygiene

Post-initial-import, the setup wizard offers a single action:

*"I've imported 12 months of email. About 2,100 are noise-classified and older than 30 days. Want to auto-purge those, or keep them in Noise for now?"*

- Accept → bulk-purge to trash (14-day recovery window preserved).
- Decline → keep in Noise indefinitely, normal purge rules apply from today forward.

---

## 10. Notifications

### 10.1 Transport

- **Web Push** for desktop browsers (supported in Chrome, Firefox, Edge, Safari 16+). Service worker registers on first use.
- **PWA Push** for mobile. iOS 16.4+ supports PWA web push. Android always has.
- **Permission prompt** is part of the setup wizard, not a blocking dialog on first inbox load.

### 10.2 Priority handling

- **Urgent:** persistent notification (doesn't auto-dismiss), requires explicit click-to-clear, stronger visual treatment in the inbox (red accent strip on thread), badge on Daily Cockpit, potential SMS fallback later (not v1).
- **Push:** standard web push, auto-dismisses after 30s or on user dismiss.
- **Silent:** no transport fires; accumulates in morning digest queue.

### 10.3 Morning digest

**Trigger:** scheduled task `inbox_morning_digest` at 8am Andy-local. If zero silenced messages in the last 24hr, no send (don't train dismissal).

**Content:** grouped by category, counts only for pure noise, one-line previews for non-noise silenced threads (unusual but possible — e.g. an auto-classified-silent signal thread Andy might want to know about).

**Channel:** email to `andy@` via Resend (not Graph — this is a system email, `email-nodejs` skill's transactional classification).

**Copy:** voice treatment owed to content mini-session. Sprinkle-bank surface.

### 10.4 Shared pipeline

The same notification infrastructure serves:

- Inbox (this spec)
- SaaS Subscription Billing — payment failures, renewal reminders, etc.
- Content Engine — unreviewed draft, ranking milestones, list health warnings
- Daily Cockpit — anomaly alerts (deferred, spec #12)
- Brand DNA — nothing yet, but available
- Task Manager — task-due reminders, rejection alerts (cross-spec flag)

Every callsite fires `enqueueNotification(user_id, payload, priority_hint)`. Central dispatcher (introduced by this spec) runs Q10 classifier on `priority_hint + context` and fires the right transport.

---

## 11. Cross-spec flags

### 11.1 Foundations patches owed

- **`sendEmail()` gains a new transport option.** Existing Foundations §11 covered Resend for transactional + outreach. Now `sendEmail()` needs to support Graph API as a transport for Andy-replies (from `andy@` / `support@`). Proposed signature: `sendEmail({ from, to, subject, body, classification, transport: 'graph' | 'resend' })`. Transactional system emails (morning digest, SaaS receipts) continue via Resend. Andy-authored replies go via Graph. Cross-spec flag for Foundations §11 patch list.
- **Notification dispatcher primitive.** New module, shared across all specs. Foundations patch owed for §11 inclusion.
- **R2 storage for attachments + .ics + visual outputs** — already in Foundations for Content Engine. Inbox reuses. No patch needed.
- **LLM model registry** — per memory `project_llm_model_registry`, inbox classifiers and drafter reference models by job name (`inbox.router`, `inbox.notifier`, `inbox.signal_noise`, `inbox.draft_reply`). No model IDs in feature code.

### 11.2 Spec-level cross-flags (consolidated)

**Client Management (LOCKED):**
- `contacts` gains `relationship_type` enum, `inbox_alt_emails` json, `notification_weight` int, `always_keep_noise` bool
- `createThreadFromPortalChat()` integration point — Client Management calls this when bartender escalates
- AI chatbot cancel flow reads from + writes to inbox threads
- Portal menu gains "Messages" (own spec already, but threaded under inbox data)

**Task Manager (LOCKED):**
- `createThreadFromTaskFeedback()` integration point — Task Manager calls this on rejection feedback
- Task due / rejection notifications route through shared notification dispatcher

**Lead Generation (LOCKED):**
- Outreach reply intelligence feeds into inbox; reply drafts surface through shared Q8 pipeline
- `attachMessageToInboxThread()` used by reply handler
- Outreach campaign_id custom header preserved in messages.headers for fallback threading
- **Reply-intelligence dispatch registration (added 2026-04-13 Phase 3.5):** inbox routes every inbound message through `classifyReply()` (owner: Lead Generation §13.0). Inbox registers the `'outreach'` dispatch table at module-load. Lead Generation remains the handler owner for outreach replies; inbox is the transport.

**Hiring Pipeline (added 2026-04-13 Phase 3.5):**
- Hiring-invite thread replies route through `classifyReply()` with `classificationContext: 'hiring_invite'`. Inbox registers the `hiring_invite` dispatch at module-load:
  - `positive` → auto-link apply-form + transition candidate to `Applied`
  - `objection` → Andy review queue (inbox thread surfaces as waiting-item)
  - `question` → Andy review queue
  - `negative` → auto-archive with `disposition_direction = 'they_withdrew'`
  - `auto_responder` → ignore
- Threading follows the existing outreach pattern (`X-SuperBad-Candidate-Id` custom header preserved for fallback match).

**Content Engine (LOCKED):**
- Newsletter subscriber replies route to inbox via `createThreadFromNewsletterReply()`
- `origin_context: 'newsletter_reply'` tag on thread
- Content Engine unreviewed draft notifications route through shared dispatcher

**SaaS Subscription Billing (LOCKED):**
- Support@ ticket threads link to customer subscription record via contact → subscription FK (existing)
- Customer context panel on support@ threads reads subscription tier, billing cadence, usage from SaaS tables
- Payment failure notifications route through shared dispatcher
- AI chatbot cancel flow uses inbox threads for Andy-escalation

**Brand DNA Assessment (LOCKED):**
- Brand DNA profile read by reply drafter (system context)
- No new columns needed on brand_dna_profiles

**Client Context Engine (LOCKED):**
- Reads `messages` + `threads` directly via `contact_id` FK — one query
- Classification outputs (priority_class, notification_priority, router_classification) are signals Context Engine consumes
- `engagement_signals` array on messages provides behavioural signal data

**Onboarding + Segmentation (LOCKED):**
- Graph API connection is a setup wizard step (new step, not in existing onboarding flow — flag for patch)
- Post-import contact routing review is a wizard step
- Noise-folder bulk-purge offer is a wizard step

**Intro Funnel (LOCKED):**
- No direct flag — funnel outputs become lead contacts via normal pipeline, which then receive inbound normally

**Quote Builder (LOCKED):**
- Quote send emails continue via Resend (outreach/transactional classification). No inbox change.
- Quote-acceptance replies from clients land in inbox as standard client threads.

**Branded Invoicing (LOCKED):**
- Invoice send emails continue via Resend. Client replies re invoice land in inbox as standard.
- No schema change.

**Sales Pipeline (LOCKED):**
- Deal pages show "Recent messages" sidebar reading from inbox (contact_id join)
- No schema change.

**Surprise & Delight (PRE-WRITTEN):**
- Sprinkle-bank surfaces claimed — see §12 for full list
- Hidden egg suppression on inbox compose surface (drafting a customer reply is not the moment for a CRT turn-off)
- Standard suppression on setup wizard, payment/billing-adjacent threads

**Daily Cockpit (#12, UNLOCKED):**
- Reads inbox aggregates: unread counts, waiting-on-Andy count, open support tickets, tickets waiting >48h, silenced-digest preview, hygiene stats ("47 noise purged this week"), anomaly detection (drop in response rate, unusual reply sentiment cluster)
- Andy-facing weekly digest across social DM channels (parked Q7 idea) lands here

**Unified Inbox itself:**
- Foundation-layer spec. Several other specs reference abstractly — this spec makes them concrete.

### 11.3 `activity_log.kind` additions (~18 values)

- `inbox_thread_created`
- `inbox_message_received`
- `inbox_message_sent`
- `inbox_routed` (router classification outcome)
- `inbox_routed_reviewed` (Andy re-routed)
- `inbox_notification_fired`
- `inbox_notification_corrected`
- `inbox_draft_generated`
- `inbox_draft_refined`
- `inbox_draft_sent`
- `inbox_draft_discarded`
- `inbox_hygiene_purged` (summary of daily purge)
- `inbox_noise_promoted` (sender promoted to signal)
- `inbox_keep_pinned`
- `inbox_import_completed` (12mo import)
- `inbox_import_backfilled` (on-demand thread backfill)
- `inbox_ticket_status_changed` (support@)
- `inbox_thread_merged`

### 11.4 `scheduled_tasks.task_type` additions (5 values)

- `inbox_draft_reply` — generate cached reply draft for a new inbound
- `inbox_hygiene_purge` — daily cleanup
- `inbox_morning_digest` — daily 8am digest send
- `inbox_graph_subscription_renew` — Graph webhook subscription renewal (Graph subs auto-expire)
- `inbox_initial_import` — one-time on setup, checkpoints progress

---

## 12. Sprinkle bank — content mini-session claims

Surfaces owed to a later Content Mini-Session with `superbad-brand-voice` + `superbad-visual-identity` loaded:

- Morning digest email — subject line + body, voice-treated. On quiet mornings, no send.
- Low-confidence chip copy — the "I'm unsure about X" tone.
- "Continue in your portal" email echo footer copy.
- Compose-new mobile nudge sheet copy.
- Focus view empty state — *"Nothing waiting. Go make something."*-style.
- Noise view empty state.
- Trash bin hygiene preview copy — *"Purged: 47 noise. Recoverable for 14 days."*-style.
- Setup wizard Graph-API consent step copy (this is the most technical step in the platform — needs reassurance).
- Post-import routing-review copy — *"I sorted your last 12 months into…"*-style, confidence-building.
- Keep-sender promotion chip copy — *"I'll keep all future noise from X"*-style.
- Weekly inbox hygiene celebration copy for Daily Cockpit — *"Inbox stayed clean: 147 noise auto-purged, 5 promoted to signal."*
- Browser tab title for inbox surface — joins existing claim list.
- "Send & Close ticket" button voice (subtle).
- Signature default templates (2 variants per address — understated + slightly more dry) — a starting point, Andy can edit.

---

## 13. Setup wizard

**Setup wizard shell reference (added 2026-04-13 Phase 3.5):** this flow renders through the `WizardDefinition` primitive owned by [setup-wizards.md](./setup-wizards.md). The Graph API consent is split into two wizard keys (per Phase 3.5 patch):

- **`graph-api-admin`** (admin, §5.1 in setup-wizards) — Andy connecting his own M365 tenant. Steps 1–9 below are the admin definition. Render mode: slideover (launched from `/lite/integrations` or morning-brief health banner on disconnect).
- **`graph-api-client`** (client, §5.3 in setup-wizards) — forward-looking hook for a future Client or Subscriber to connect their own mailbox. Same step spine, client-tone copy, no "admin rights" escape hatch, completion payload scoped to their own Graph subscription. Not built in v1 but reserved as a wizard key so the split is honest.

This spec owns all step content and copy for both variants. Shell chrome (progress bar, resume, cancel, celebration, Observatory integration) lives in the primitive.

---

Multi-step, hand-held per `feedback_setup_is_hand_held`. Runs once on first connection.

### Step 1: The story
One-screen overview. *"Lite's going to become your primary inbox for `andy@` and `support@`. Outlook stays active as your backup — nothing about your existing mailbox changes. Let's connect."* Voice-treated copy, claimed.

### Step 2: Connect Microsoft 365
- "Sign in with Microsoft" button → OAuth flow (delegated permissions)
- Requested scopes: `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.Read`, `User.Read`, `offline_access` (for refresh tokens)
- If Andy's M365 account doesn't have admin rights and the app requires admin consent, we show a copy-paste admin link to hand to himself (he IS the admin, but the language needs to be plain)
- After consent: store tokens encrypted, create Graph subscription for webhook delivery, confirm mailbox access for both `andy@` and `support@` addresses

### Step 3: Existing history import
- Progress bar with live counts: "Imported 487 of ~6,200 messages…"
- Continues in background if Andy moves on — non-blocking
- On completion: summary screen — *"Imported 6,231 messages. 4,112 signal, 1,847 noise, 272 spam auto-archived. Ready to review?"*

### Step 4: Contact routing review
- Post-import, Claude has auto-created contacts for routed messages
- Wizard shows a summary: "I matched 134 messages to existing contacts. Created 27 new leads, 43 suppliers, 18 personal contacts. Want to review any before we go live?"
- Expandable list. Andy can re-route in bulk or individually. Corrections log to classification_corrections.

### Step 5: Noise-folder initial cleanup (optional)
- *"About 2,100 imported messages are noise older than 30 days. Auto-purge them now to start fresh, or keep them for reference?"*
- One click → bulk soft-delete to trash (14-day recovery). Skip keeps them.

### Step 6: Signatures
- Two default templates per address shown. Andy picks one or edits.

### Step 7: Browser notifications
- Request browser push permission. Permission granted → test notification fires. Skip allowed.

### Step 8: Install on phone
- PWA install instructions with platform detection (iOS vs Android). Short, copy-pasted screenshots of the home screen button. Optional.

### Step 9: Done
- Confirmation. *"Lite is your inbox now. Outlook still works as backup. Morning digest arrives at 8am."*

---

## 14. Out of scope (explicitly deferred)

- **Full phase-2 DNS migration** (Lite replaces M365 as the mailbox). Separate, later project. This spec is phase-1 only.
- **Native mobile app** (Swift / Kotlin). PWA is sufficient for v1.
- **Do-not-disturb mode.** Could add later. Not v1.
- **Per-category notification customisation UI.** Smart filtering is the default; if Andy wants per-category controls later, add as a settings panel then.
- **Customer-facing weekly digest** (the parked Q7 idea). Revisit post-launch with real behaviour data.
- **Andy-facing weekly DM-channel digest** — belongs in Daily Cockpit spec (#12), not this one.
- **Third-party email integrations beyond M365** (Gmail for Andy's personal, IMAP for legacy). If ever needed later. Not v1.
- **Full conversation merging by LLM** without confirmation. Manual merge only for v1.
- **Email templates / canned responses.** Claude drafts replace this use case. If ever needed, add later.
- **Calendar-event creation from inbox with external participants invited via .ics.** Outbound calendar invites in composer included; multi-participant scheduling UI is deferred to Daily Cockpit / calendar spec.
- **Shared inbox with assignees** — Andy is solo; multi-user inbox assignment is post-hiring (spec #14).
- **Email rules / filters** in the Gmail/Outlook sense. Classifications replace this. No rules UI.
- **Encryption (PGP/S/MIME).** Not needed for SuperBad's customer base.
- **Auto-send of Claude drafts.** Never. Not a v1.1 thing — a policy thing.

---

## 15. Success criteria

Inbox is considered successful if, after launch:

1. **Andy stops opening Outlook daily.** Outlook becomes a safety net consulted only when he suspects Lite missed something. If after 60 days he's still reaching for Outlook, the UX isn't reliable enough.
2. **Reply time on client threads drops.** Baseline: pre-launch average. Target: measurable improvement because Claude drafts remove the first-draft cost.
3. **Morning digest is useful, not ignored.** Open rate tracked. If he never opens it, the digest is the wrong shape.
4. **Zero missed client replies.** No thread from a paying client goes unanswered >48hr because of a classification error.
5. **Noise auto-purge reduces inbox volume by 50%+.** Measured as threads remaining in Focus view after 90 days vs All view.
6. **Support@ ticket overlay actually replaces ad-hoc tracking.** If Andy's still keeping a separate "who I owe a reply to" note on the side after 30 days, the overlay needs work.
7. **Mobile PWA reply rate matches or exceeds Outlook mobile baseline.** Measured as % of threads Andy replies to from phone.
8. **Multi-tenant classification corrections propagate.** Within 30 days of go-live, each classifier shows measurable improvement on previously-corrected patterns.

---

## 16. Build-time disciplines (new)

Adding to the project's running discipline list:

51. **Graph API token lifecycle is non-negotiable.** Refresh tokens stored encrypted. Access token refresh happens automatically on expiry. Webhook subscription renewal is a scheduled task (Graph subs expire in max 3 days).

52. **Three classifiers run in parallel, not serial.** Q5 router, Q10 notifier, Q12 signal/noise classifier all fire on the same inbound. Don't serialize.

53. **Drafts are never auto-sent.** No "high-confidence auto-send" mode. No flag to enable it. No settings. Policy, enforced at the send-button level — draft-send requires an explicit user gesture.

54. **Classification corrections write to one shared table.** All three classifiers read from it. Correction data is not fragmented across three tables.

55. **Email echo for passive channels only.** Active channels (IG, FB, SMS, WhatsApp) never echo to email. Enforced at dispatch layer, not caller.

56. **Thread-level `keep_until` is the MAX of message-level values.** One signal message rescues the thread. Never collapse to message-level when the thread is the visible unit.

57. **`createThreadFrom*()` integration functions live in the inbox module.** Client Management, Task Manager, Content Engine, Lead Gen callers don't build thread records themselves. One entry point, one validation layer.

58. **Multi-tenant isolation discipline inherits.** Same as Content Engine — every inbox query scopes by user_id. For now, user_id = Andy-only (solo); scaffolded correctly from day one for future hiring.

59. **Graph webhook replay handling.** Graph may deliver the same change notification twice. Inbound pipeline must be idempotent on `graph_message_id`.

60. **Draft invalidation protects Andy's in-progress edits.** If Andy is actively editing a cached draft and a new inbound arrives, the edit is preserved; the new draft is offered ("New message arrived. Regenerate draft?") but not auto-applied.

61. **Outbound state transitions handle Outlook-sent messages.** When Andy sends from Outlook mobile during Phase 1 migration, Graph delivers a "message sent" event. Inbox pipeline catches this, attaches the message to the right thread with `sending_address` populated, runs through ticket auto-transitions for support@ if applicable. Test this case specifically.

62. **No auto-merge across threads without explicit user action.** LLM merge-suggester surfaces proposals; Andy confirms. Zero silent merges.

63. **Noise classifier errs conservative.** When uncertain between signal and noise, classify as signal. Missed noise in Focus is an annoyance; missed signal in Noise is a broken relationship.

64. **Spam silent-archive still audits.** Every spam decision logs `inbox_routed` with reason. If Andy ever asks "why didn't I see this," the log answers.

---

## 17. Phase 5 sizing

Unified Inbox is a foundation-layer spec. Sessions A + B must land early in Phase 5, before features that depend on `messages` + `threads`.

- **A. Graph API integration** (large)
  - OAuth + Azure AD app registration
  - Token storage + refresh cycle
  - Webhook subscription + renewal
  - Inbound message handler (parse, normalize)
  - Outbound send via Graph (as andy@ and support@)
  - Delivery tracking
  - Setup wizard steps 1–3
  - *Dependencies: Foundations (R2, SQLite, scheduled_tasks), LLM model registry primitive*

- **B. Data model + threading + contact routing + 12-month import** (large, depends on A)
  - `threads`, `messages`, `message_attachments`, `message_calendar_invites`, `message_delivery_attempts`, `notifications`, `classification_corrections`, `inbox_signature_settings`, `graph_api_state` tables
  - RFC-header threading + subject-similarity fallback
  - Q5 router classifier (Haiku prompt + contact-creation logic)
  - 12-month import background job with progress checkpoints
  - Post-import contact routing review UI (wizard step 4)
  - *Dependencies: A*

- **C. Inbox UI + compose + thread detail + Conversation view** (large, depends on B)
  - Three-column layout, thread list, thread detail
  - Focus / All / Noise / Support / Drafts / Sent / Snoozed / Trash / Spam views
  - Compose-new with contact picker and optional AI draft
  - Per-contact Conversation view
  - Attachment upload/view
  - Calendar invite parse + RSVP UI
  - Manual merge UI
  - Re-route UI
  - Keep pin UI
  - *Dependencies: B*

- **D. Reply drafting + refine-chat + voice learning** (medium, depends on C)
  - Q8 Opus drafter with Brand DNA + Client Context injection
  - Cached draft generation trigger on inbound
  - Draft invalidation logic
  - Refine-chat sidecar component
  - Retrieval-based few-shot voice learning
  - Low-confidence flag display
  - *Dependencies: C, Brand DNA feature shipped, Client Context Engine shipped*

- **E. Notifications + PWA + morning digest** (medium, depends on C)
  - Notification dispatcher primitive (shared)
  - Q10 notifier classifier
  - Web push + PWA push
  - PWA manifest + icons + install prompt
  - Mobile UI (thread list + detail + swipe actions)
  - Morning digest scheduled task + Resend template
  - Setup wizard steps 7–8
  - *Dependencies: C*

- **F. Signal/noise classifier + auto-delete + Keep pin + hygiene loop** (medium, depends on B)
  - Q12 signal/noise classifier
  - `keep_until` calculation + thread-level max aggregation
  - Daily hygiene purge scheduled task
  - Pre-purge trash bin UI
  - Keep-sender promotion logic (3-pin threshold)
  - Setup wizard step 5 (initial noise cleanup)
  - Classification correction learning loop
  - *Dependencies: B*

- **G. Support@ ticket overlay + classification + state transitions** (small-medium, depends on B)
  - Ticket type classifier (Haiku, specific prompt)
  - Ticket status UI + auto-transitions on send/reply
  - Customer context panel (reads SaaS Billing + Client Context Engine)
  - Support@ filter views
  - Close ticket action
  - *Dependencies: B, SaaS Subscription Billing shipped (for customer context panel — can launch without, fill in post-SaaS-launch)*

- **H. Cross-spec integration surfaces** (medium, depends on C + integrating specs shipped)
  - `createThreadFromPortalChat()` wired up (after Client Management ships)
  - `createThreadFromTaskFeedback()` wired up (after Task Manager ships)
  - Outreach reply thread attachment (after Lead Gen ships)
  - Newsletter reply thread creation (after Content Engine ships)
  - Client Context Engine reads wired up (already spec'd in its own spec)
  - Daily Cockpit aggregates exposed (at Daily Cockpit build time)
  - *Dependencies: C + respective specs shipped*

**Ordering implication for Phase 4 (Build Plan):** A + B must land very early — likely the second and third build sessions after the foundation session itself. C follows immediately. D–G can parallel each other after C lands. H is integration work sprinkled through later build sessions.

---

## 18. Open items / non-blocking flags

- **Content mini-session** owed (§12 claims) — large. Dedicated creative session with voice + visual-identity skills loaded. Must run before Phase 5 sessions C + E.
- **Graph API app registration setup** — Andy creates Azure AD app registration once; documented in wizard but may need a one-off live session to walk through. Low-risk but not zero.
- **Daily Cockpit spec (#12) will absorb** the Andy-facing weekly social-DM activity digest (parked Q7 idea). Cross-flag noted.
- **Customer-facing conversation digest** (other parked Q7 idea) — revisit post-launch with behaviour data. Not tracked as a build item.
- **Foundations §11 patch** consolidated list for Phase 3.5 review:
  - `sendEmail({ transport: 'graph' | 'resend' })` extension
  - Notification dispatcher primitive
  - `classification_corrections` as a shared learning-loop primitive (available to any classifier in the platform, not just inbox)

---

**End of spec. Locked 2026-04-13.**

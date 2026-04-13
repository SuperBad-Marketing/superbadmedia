# Phase 3 — Unified Inbox — Handoff Note

**Date:** 2026-04-13
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/unified-inbox.md`
**Status:** Locked, 13 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for the Unified Inbox — the centralised comms surface that replaces Andy's Outlook as his primary work email client. 13 questions asked, all locked. This is the last major data-schema-defining spec in Phase 3 — the `messages` + `threads` tables defined here are what five already-locked specs reference abstractly.

Two significant mid-brainstorm redirects from Andy that reshaped the spec:

1. **Q2 — Email scope.** I proposed a two-address model where Lite manages a new platform address while Andy's existing Gmail stays separate. Andy's redirect: he wants to migrate everything work-related through the CRM. `andy@superbadmedia.com.au` and `support@superbadmedia.com.au` both function through Lite. Outlook drops to worst-case backup. This turned a "platform comms inbox" into a full email client migration — much bigger scope, but the right call for the platform's "everything operational lives in Lite" goal.

2. **Q7 — Noise filtering.** Andy added unprompted scope: a more effective version of Outlook's Focused Inbox, plus auto-delete of unread/unimportant email after a period. He also caught a flaw in my outbound hybrid-delivery proposal — suggested a weekly digest instead of per-reply email echo for social DM channels. This led to the **passive vs active channel principle** (saved as a new feedback memory) and the full signal/noise + auto-delete system documented in Q12.

---

## 2. Key decisions summary

### Email architecture
- **Staged M365 migration.** Phase 1 (this spec): Lite connects to existing M365 mailbox via Microsoft Graph API as another email client; Outlook keeps working unchanged. Phase 2 (deferred): DNS migration, Lite replaces M365 as the mailbox. The staging preserves Outlook as a safety net during the riskiest adoption period.
- **Two addresses, one inbox:** `andy@` + `support@` unified. Ticket overlay (status + Claude-assigned type chip) on `support@` threads only.
- **Microsoft Graph API via OAuth delegated permissions** — `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.Read`, `User.Read`, `offline_access`.

### Three parallel classification passes per inbound
All three fire in parallel on every inbound, all read from a shared `classification_corrections` table as few-shot context:
1. **Inbound router** (Haiku) — resolves contact, classifies sender type: match-existing / new-lead / non-client / spam. Creates contacts on new-lead and non-client with appropriate `relationship_type`.
2. **Notification triage** (Haiku) — classifies interruption priority: urgent / push / silent.
3. **Signal/noise classifier** (Haiku) — classifies content priority: signal / noise / spam, with noise sub-classification (transactional / marketing / automated / update) that determines auto-delete window.

### Threading
- Topic threads (RFC header primary, subject-similarity fallback, LLM merge suggestions require Andy confirmation).
- Per-contact Conversation view flattens all threads chronologically — serves both Andy's "state of this relationship" cognitive mode and Client Context Engine reads.
- Cross-channel threads stay separate records; contact-level view unifies.

### Reply drafting
- **Always-drafted for client-facing threads** (Opus). Cached on thread when inbound arrives, zero-click when Andy opens it.
- **Refine-chat sidecar** for instruction-based rewrites.
- **Voice learning** via retrieval of past Andy-sent messages to similar contacts as few-shot examples.
- **Never auto-sends** — policy, not capability.
- Both perpetual contexts injected (Brand DNA + Client Context) per `project_two_perpetual_contexts`.

### Outbound channel routing (passive vs active rule)
- **Passive channels** (portal chat, task feedback) → echo to email for delivery assurance.
- **Active channels** (IG, FB, SMS, WhatsApp, etc.) → native transport only, no email echo.
- Clean test: does the channel push-notify the customer on its own? If yes, don't echo.
- Saved as new feedback memory `feedback_passive_vs_active_channels.md`.

### Compose-new
- Single composer with optional AI draft via "Draft this for me" + one-line intent.
- Contact-aware picker with inline new-contact resolution via Q5 router on send.
- Subject optional (auto-generates if blank). CC/BCC behind toggle.

### Notifications
- Claude-triaged three-tier priority (urgent/push/silent), shared dispatcher across all system events.
- Morning digest at 8am local summarising everything silenced overnight — skipped on quiet mornings.
- Web Push + PWA Push transports. Setup wizard handles permission prompt.
- Ambient correction loops via thread-open behaviour + dismissals.

### History import
- **12-month window** imported on setup via background job with progress checkpoints.
- Older history retrievable on-demand per thread ("Load older messages from Outlook").
- Post-import contact routing review is a setup wizard step.

### Signal/noise + auto-deletion
- Signal threads: never auto-delete.
- Noise threads: 30 days general, 180 days transactional/receipts.
- Spam: 7 days.
- **Keep pin** overrides (never deletes).
- **Keep-sender promotion** after 3 manual pins from same sender.
- Thread-level `keep_until` is MAX of message-level values — one signal message rescues the whole thread.
- Pre-purge trash bin: 14 days before hard delete.
- Engagement signals (reply, pin, open >15s, forward) reset the decay clock.

### Mobile (PWA)
- Read + quick reply + triage focus. Claude drafts pre-loaded, tap-edit, swipe actions.
- Compose-new available but discouraged with a nudge sheet.
- Outlook mobile stays as escape hatch throughout Phase 1.

---

## 3. New memory

**`feedback_passive_vs_active_channels.md`** — Cross-channel message delivery rule. Email-echo only for passive channels (portal chat, task feedback); active channels with native push (IG, FB, SMS, WhatsApp) deliver through their own transport with no echo. Rationale: echoing to email when the customer already got a push notification is spammy, presumptuous (they chose that channel), and creates double-threading risk. Applies beyond this spec to any future cross-channel message delivery logic.

---

## 4. Sprinkle bank updates

Claimed for later content mini-session (§12 of spec):

- Morning digest email subject + body voice (skipped on quiet mornings)
- Low-confidence chip copy tone
- "Continue in your portal" email echo footer
- Compose-new mobile nudge sheet copy
- Focus/Noise/All/Trash/Spam empty-state copy
- Trash-bin hygiene preview copy
- Setup wizard Graph-API consent step copy (most technical step in the platform — needs reassurance)
- Post-import routing-review copy
- Keep-sender promotion chip copy
- Weekly inbox hygiene celebration line for Daily Cockpit
- Browser tab title for inbox ("Inbox — 3 waiting" vs "Inbox — all quiet")
- "Send & Close ticket" button voice
- Signature default templates (2 variants per address)

---

## 5. Cross-spec flags (consolidated)

### 5.1 Foundations patches owed (Phase 3.5 patch list)

- **`sendEmail()` gains transport + classification parameters** — `sendEmail({ from, to, subject, body, classification: 'transactional' | 'outreach', transport: 'graph' | 'resend' })`. Andy-authored replies route via Graph; system emails (morning digest, SaaS receipts, notifications) continue via Resend.
- **Notification dispatcher primitive** — new shared module in Foundations §11. Every callsite fires `enqueueNotification(user_id, payload, priority_hint)`; central dispatcher runs Q10 classifier and fires the right transport.
- **`classification_corrections` as shared primitive** — available to any classifier across the platform, not just inbox. Feedback loop infrastructure.

### 5.2 Client Management (LOCKED)
- `contacts` gains 4 columns: `relationship_type` enum, `inbox_alt_emails` json, `notification_weight` int, `always_keep_noise` bool
- `createThreadFromPortalChat()` integration point — Client Management calls on escalation
- AI chatbot cancel flow uses inbox threads for Andy-escalation
- Portal menu "Messages" section reads inbox threads scoped to contact

### 5.3 Task Manager (LOCKED)
- `createThreadFromTaskFeedback()` integration point — Task Manager calls on rejection feedback
- Task due + rejection notifications route through shared dispatcher
- Task rejection feedback already designed with `source='task_rejection'` — this spec formalises the integration contract

### 5.4 Lead Generation (LOCKED)
- `attachMessageToInboxThread()` integration point for outreach replies
- Outreach campaign_id custom header preserved in `messages.headers` for fallback threading
- Reply intelligence classifier continues to own reply routing; inbox surfaces the resulting thread

### 5.5 Content Engine (LOCKED)
- `createThreadFromNewsletterReply()` integration point — subscriber replies land in inbox
- Content Engine unreviewed draft notifications route through shared dispatcher
- `origin_context: 'newsletter_reply'` tag on thread

### 5.6 SaaS Subscription Billing (LOCKED)
- Support@ thread `ticket_type` chips include billing categorisation; customer context panel reads subscription tier + cadence + usage
- Payment failure notifications route through shared dispatcher
- AI chatbot cancel flow uses inbox threads for max-escalation to Andy

### 5.7 Brand DNA Assessment (LOCKED)
- Brand DNA profile injected as system context in reply drafter
- No schema change

### 5.8 Client Context Engine (LOCKED)
- Reads `messages` + `threads` directly via `contact_id` FK — one query, cross-channel, chronological
- Classification outputs are signals: `priority_class`, `notification_priority`, `router_classification`
- `engagement_signals` array provides behavioural data
- **This spec concretises the abstract `messages` schema that Context Engine referenced.** No retrofit needed; Context Engine's spec can be re-read with the unified-inbox tables in mind and any gaps surfaced at Phase 3.5 review.

### 5.9 Onboarding + Segmentation (LOCKED)
- Graph API connection is a new setup wizard step (not in existing onboarding flow)
- Post-import contact routing review is a wizard step
- Noise-folder initial cleanup offer is a wizard step
- Cross-spec flag: Onboarding spec may need a patch to absorb these wizard steps, OR they live in a standalone Inbox setup flow triggered once on first connection. Phase 3.5 call.

### 5.10 Sales Pipeline (LOCKED)
- Deal pages can render "Recent messages" sidebar reading from inbox via `contact_id` join
- No schema change

### 5.11 Quote Builder + Branded Invoicing (LOCKED)
- Quote/invoice send emails continue via Resend (transactional classification, no change)
- Client replies re quote/invoice land in inbox as standard client threads
- No schema change

### 5.12 Intro Funnel (LOCKED)
- No direct integration — funnel outputs become lead contacts normally, which then receive inbound via the standard pipeline

### 5.13 Surprise & Delight (PRE-WRITTEN)
- Sprinkle claims listed in §4
- Hidden egg suppression on compose surface (drafting a customer reply is not the moment)
- Standard suppression on setup wizard and on payment/billing-adjacent threads

### 5.14 Daily Cockpit (#12, next session)
- Reads inbox aggregates: unread counts, waiting-on-Andy, open support tickets, tickets waiting >48h, silenced-digest preview, hygiene stats
- Anomaly detection (drop in response rate, unusual reply sentiment cluster)
- Andy-facing weekly social-DM activity digest (absorbed from Q7's parked idea) — Cockpit's domain

---

## 6. New data

### 6.1 New tables: 9
- `threads` — topic-scoped conversation containers with ticket status and keep_until aggregate
- `messages` — per-message records, direction + channel + classifications + engagement signals
- `message_attachments` — R2 storage, inline preview flags
- `message_calendar_invites` — .ics parsed events linked to native calendar
- `message_delivery_attempts` — per-transport delivery status tracking
- `notifications` — shared across inbox + all system notifications
- `classification_corrections` — shared learning-loop primitive read by all three classifiers
- `inbox_signature_settings` — per-address signature
- `graph_api_state` — OAuth tokens, webhook subscription, import progress

### 6.2 New columns on existing tables
- `contacts.relationship_type` (enum)
- `contacts.inbox_alt_emails` (json array)
- `contacts.notification_weight` (integer, adjusted by ambient correction)
- `contacts.always_keep_noise` (boolean, flipped on keep-sender promotion)

### 6.3 `activity_log.kind` gains ~18 values
See spec §11.3.

### 6.4 `scheduled_tasks.task_type` gains 5 values
`inbox_draft_reply`, `inbox_hygiene_purge`, `inbox_morning_digest`, `inbox_graph_subscription_renew`, `inbox_initial_import`

---

## 7. New integrations (2)

- **Microsoft Graph API** — OAuth app registration in Azure AD, delegated Mail scopes, webhook subscriptions (auto-expire in 3 days → renewal task), SendAs on both addresses. Setup wizard handles admin consent flow. Technically the most complex surface in this spec.
- **PWA Push** — service worker registration, Web Push API, iOS 16.4+ and Android support. PWA manifest + icons + install prompt is a Phase 5 build item.

---

## 8. Claude prompts (4)

- 1 Opus: `inbox.draft_reply` — full perpetual-context draft with low-confidence flagging, reads Brand DNA + Client Context + thread history + retrieved voice examples
- 3 Haiku: `inbox.router` (Q5), `inbox.notifier` (Q10), `inbox.signal_noise` (Q12)
- Support@ `ticket_type` classifier is a sub-prompt within the router pipeline, not a separate named job

All routed via LLM model registry per `project_llm_model_registry`.

---

## 9. Build-time disciplines (14 new: 51–64)

Key ones:

51. Graph API token lifecycle + subscription renewal are non-negotiable scheduled tasks.
52. Three classifiers run in parallel, not serial.
53. Drafts are never auto-sent — policy-level enforcement at send button.
54. All classifier corrections write to one shared table.
55. Email echo for passive channels only; dispatch-layer enforcement.
56. Thread-level `keep_until` is MAX of message-level values.
57. `createThreadFrom*()` integration functions are inbox module's entry points.
58. Multi-tenant isolation scaffolded from day one (user_id scope, solo for now).
59. Graph webhook replay handling: idempotent on `graph_message_id`.
60. Draft invalidation protects in-progress Andy edits.
61. Outbound state transitions handle Outlook-mobile-sent messages (during Phase 1 migration).
62. No auto-merge across threads without explicit user action.
63. Noise classifier errs conservative (signal bias when uncertain).
64. Spam silent-archive still audits — `inbox_routed` with reason.

---

## 10. Content mini-session scope

**Large.** Dedicated creative session with `superbad-brand-voice` + `superbad-visual-identity` skills loaded. Surface list in §12 of spec, ~14 voice-treated surfaces + setup wizard narrative + signature default templates + browser tab titles. Most sensitive surface: Graph API consent step copy, because it's the most technical moment in the platform and the voice needs to reassure without explaining.

Must run before Phase 5 Unified Inbox sessions C (inbox UI) and E (notifications + digest).

---

## 11. Phase 5 sizing

8 sessions:
- **A.** Graph API integration + OAuth + webhook + inbound pipeline (large)
- **B.** Data model + threading + contact routing + 12-month import (large, depends on A)
- **C.** Inbox UI + compose + Conversation view (large, depends on B)
- **D.** Reply drafting + refine-chat + voice learning (medium, depends on C + Brand DNA feature shipped + Context Engine shipped)
- **E.** Notifications + PWA + morning digest (medium, depends on C)
- **F.** Signal/noise classifier + auto-delete + Keep pin (medium, depends on B)
- **G.** Support@ ticket overlay + classification + state transitions (small-medium, depends on B; can launch without customer context panel before SaaS Billing ships)
- **H.** Cross-spec integration surfaces — portal chat / task feedback / outreach replies / newsletter replies / Context Engine reads / Cockpit aggregates (medium, sprinkled through later sessions as dependent specs ship)

**Foundation-layer sequencing:** A + B must land very early in Phase 5 — likely the second and third build sessions after the infrastructure foundation session. The `messages` + `threads` tables defined in B are depended on by Client Management, Task Manager, Lead Gen, Content Engine, Client Context Engine, and Daily Cockpit. Phase 4's Build Plan should treat the inbox foundation as infrastructure, not a feature in queue.

---

## 12. What the next session should know

### 12.1 Next recommended spec: Daily Cockpit (#12)

The operator's morning surface — the first page Andy sees when he opens Lite. This spec consumes signals from every locked spec. Task Manager already defined the locked Must Do / Should Do / If Time column rules that Cockpit inherits — **do not re-derive them**. Client Context Engine already exposes `getSignalsForAllContacts()` and aggregated action items. Unified Inbox exposes aggregates (unread, waiting, open tickets, silenced digest preview, hygiene stats).

Cockpit is where spec discipline gets tested. The temptation will be to invent new data primitives; resist. Cockpit mostly aggregates what's already locked. The real design questions are: what counts as a morning-attention event vs a passive count, how does the narrative brief read on a quiet day vs a fire day, what goes above the fold vs below, what should push-interrupt Andy during the day vs wait for morning surface, and how does the cockpit handle the "fleet view" of SaaS subscribers (for Andy as solo operator of his own retainer clients + as fleet operator of Content Engine subscribers).

Also: Andy-facing weekly social-DM activity digest (Q7 parked idea from this session) is Cockpit's to absorb.

### 12.2 Things easily missed

- **The inbox is now a full email client replacement, not a "platform comms surface."** Andy's expectation is to stop opening Outlook daily. Every design decision should be tested against: "would this make Andy reach for Outlook instead?"
- **Three classifiers per inbound = three Haiku calls.** Cost is negligible at Andy's volume. Latency is sub-2s in parallel. Don't accidentally serialize them in Phase 5 build — discipline 52.
- **Drafts are cached on the thread, not regenerated per-open.** One draft per inbound. Invalidation on new inbound or on send. Discipline 60 protects in-progress Andy edits during invalidation.
- **Keep-until rolls up to thread level.** Message-level `keep_until` is the classification-driven expiry; thread-level is the MAX. One signal message rescues the whole thread. Don't accidentally do message-level purges — it would delete signal messages buried in otherwise-noise threads.
- **The staged M365 migration means Outlook keeps working.** During Phase 1, Andy can still send from Outlook mobile. Graph webhook catches it, inbox threads stay coherent, ticket auto-transitions fire correctly. Discipline 61 — test this case specifically in Session A.
- **The passive-vs-active channel rule is a platform principle, not just an inbox rule.** New memory saved. When future channels or notification surfaces are added, apply the same test: does this channel push-notify natively? If yes, no email echo.
- **Foundations §11 has three patches owed.** `sendEmail()` extension, notification dispatcher primitive, `classification_corrections` shared primitive. Phase 3.5 review must consolidate.
- **Setup wizard is the highest-technical-debt moment in the platform.** Azure AD app registration + admin consent is genuinely fiddly. Content mini-session must give this step the warmest, most reassuring copy in the platform. It's where users give up on tools.
- **Graph API subscription auto-expires in 3 days max.** Renewal is a scheduled task. If it fails, inbound pipeline silently stops. Monitoring + Daily Cockpit banner when the subscription lapses.
- **The multi-classifier correction loop isn't magic.** All three classifiers read from the same corrections table as few-shot examples. First month of behaviour leans toward generic defaults; by month two, Andy's patterns are learned. Don't expect immediate voice-fit on drafts or perfect routing on day one.

---

## 13. Backlog state

**Phase 3 spec backlog: 17 total, 14 locked, 3 remaining.**

Locked: Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel, Quote Builder, Branded Invoicing, Surprise & Delight (pre-written), Task Manager, Brand DNA Assessment, Onboarding + Segmentation, Client Context Engine, Client Management, SaaS Subscription Billing, Content Engine, **Unified Inbox** (this session).

Remaining: Daily Cockpit (#12), Setup Wizards (#13), Hiring Pipeline (#14), Finance Dashboard (#17).

Next recommended: **Daily Cockpit (#12).**

---

**End of handoff.**

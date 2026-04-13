# Client Management — Feature Spec

**Phase 3 output. Locked 2026-04-12. 33 questions resolved.**

> **Prompt files:** `lib/ai/prompts/client-management.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

Client Management is the profile layer — the page where everything Lite knows about a person or company comes together. It is the primary consumer of the Client Context Engine (summary tile, action items, draft drawer), and it also surfaces Brand DNA status, deliverables (via Task Manager — not forked), billing (via Branded Invoicing), onboarding progress, one-click data export, and the client portal with AI chat. Every client-facing surface says "SuperBad", never "SuperBad Lite."

Client Management has two audiences:
1. **Andy (admin)** — company profiles, contact profiles, clients index, global search. All at `/lite/`.
2. **Clients (portal)** — individual per-contact portals at `/portal/[token]`. Chat-first, bartender-voiced, SuperBad-branded.

---

## 1. The 33 locks (quick-reference table)

| # | Decision | Lock |
|---|----------|------|
| 1 | Primary unit | Dual entry — both companies and contacts are first-class, linked. Company = account view, contact = person view |
| 2 | URL structure | `/lite/companies/[id]`, `/lite/contacts/[id]` (admin). `/portal/[token]` (client portal) |
| 3 | Company profile tabs | 7 tabs: Overview / Deliverables / Billing / Brand DNA / Comms / Portal Chat / Activity |
| 4 | Contact profile tabs | 5 tabs: Overview / Comms / Brand DNA / Portal Chat / Activity |
| 5 | Contact Overview layout | Two-column: left = Context Engine summary tile, right = deal snapshot + action items + tasks. Below both = private notes full-width. Draft drawer slides from right edge |
| 6 | Private notes vs activity log | Private notes on Overview (clean, focused). Activity tab interleaves `activity_log` + private notes with lock icons |
| 7 | Portal content | Full experience: chat home + menu with Deliverables, Invoices, Brand DNA, Package, Messages, Gallery, Data Export. "What's Next" as bartender opening line |
| 7a | AI chat capability | Read-only Q&A + escalation to Andy + limited safe actions (approve/reject deliverable, trigger data export, view invoice/quote) |
| 7b | AI chat voice | Bartender register from S&D spec — unnamed, warm, knows your name, never pitches. Honest about being AI if asked |
| 7c | Chat persistence | Persistent per client. Escalations to comms inbox. Full chat log viewable by Andy on admin profiles |
| 8 | Chat placement | Full-page chat as portal home + persistent bottom-right bubble on all other portal pages |
| 9 | Portal navigation | Chat is home. Menu bubble → full-page clean overlay menu. First-visit tour (3 steps, bartender voice). Fallback: chat unavailable → Pixieset gallery → SuperBad-branded error page with dry voice |
| 10 | Client portal actions | Read-only everywhere except: approve/reject deliverables, pay invoices (inline Payment Element), update payment method (Stripe Billing Portal) |
| 11 | Data export mechanism | Background generation via `scheduled_tasks`, cockpit notification with download link. ZIP auto-expires after 7 days |
| 12 | Client-triggered export | Via AI chat — bartender handles the request as a limited safe action. Same export job, download link in chat |
| 13 | Admin discovery | Dedicated "Clients" in main nav (`/lite/clients`) + global search (`Cmd+K` / header click) |
| 14 | Clients index layout | Two-tier: summary cards at top (active clients, monthly revenue, needing attention, overdue invoices) + compact list with health score dots |
| 15 | External links | Typed categories (Google Drive, Frame.io, Pixieset Gallery, Dropbox, Other) with auto-reference in automated emails |
| 16 | Package tab | Summary card with contextual quick actions + quote history timeline below |
| 17 | Billing tab | Invoice list + payment summary cards (invoiced, paid, outstanding, overdue) + payment method section with "Manage billing" for Stripe clients |
| 18 | Deliverables tab | Grouped by status (In Progress / Awaiting Approval / Delivered+Done) with progress bar. Click opens Task Manager drawer. "New deliverable" button pre-fills entity link |
| 19 | Brand DNA tab | Company blend as hero (or solo profile), individual profiles listed below with completion status + "Send reminder" for incomplete |
| 20 | Company Comms tab | Threaded by conversation (`thread_id`), newest thread first. Draft drawer accessible from any thread |
| 21 | Contact Comms tab | Same threaded view, filtered to this contact. AI chat log lives separately |
| 22 | Contact Portal Chat tab | Dedicated tab showing full chat log, read-only, newest first, escalated messages flagged |
| 23 | Company Portal Chat tab | Same pattern, aggregated across all contacts, grouped by contact |
| 24 | Global search | `Cmd+K` / header click. Searches entities by name + documents by reference/number + tasks by title. Results grouped by type. Recents on empty state. Mouse-first |
| 25 | Won → client transition | Automatic and invisible. Won deal = company appears in clients index immediately. No ceremony, no setup gate |
| 26 | Clients index filtering | Filterable by relationship stage: Active (default) / Completed / Churned. Churned clients retain full profiles |
| 27 | Multi-contact portals | Individual portals, isolated per contact. Shared company data visible (deliverables, invoices, package). Chat, Brand DNA, opening line scoped to the individual |
| 28 | Voice & delight | Browser tab titles claimed. No hidden eggs on admin profiles or portal. Ambient S&D slots apply. Portal chat IS the delight surface |
| 29 | Real-time portal notifications | Email on deliverable status change + "new" badge on portal menu (checked on load) + real-time toast via WebSocket/SSE if portal tab is open |
| 30 | Data model | 1 new table (`portal_chat_messages`), 2 new columns on `contacts` |
| 31 | Claude prompts | 3 prompts: bartender opening line (Haiku), chat responses (Opus), escalation summary (Haiku). 1 static content item (tour copy) |
| 32 | Cross-spec flags | Verified against all 10 locked specs — see §16 |
| 33 | Phase 5 sizing | 4 sessions: A (admin profiles + search), B (portal chat), C (portal sections + notifications), D (export + migration + cancel flow) |

---

## 2. Admin profiles — company

### 2.1 URL and access

`/lite/companies/[id]` — admin-only, behind auth. Numeric ID, not slug.

### 2.2 Tab structure

Seven tabs in this order:

1. **Overview** — package summary card, contacts list with role/title, external links (typed categories), onboarding status (derived from primitives — see Onboarding spec §10), general notes.
2. **Deliverables** — Task Manager filtered view. See §5.
3. **Billing** — invoices, payment summary, payment method. See §6.
4. **Brand DNA** — company blend + individual profiles. See §7.
5. **Comms** — threaded conversations across all contacts at this company. See §8.
6. **Portal Chat** — AI chat logs from all contacts, grouped by contact. See §9.
7. **Activity** — full `activity_log` filtered to this company, interleaved with private notes (lock icon on notes). Chronological, newest first.

### 2.3 Overview tab content

- **Package summary card** — package type (retainer/project), accepted quote reference + link, monthly value, billing mode (Stripe/manual), commitment period, next invoice date, subscription state (canonical 13-value enum per FOUNDATIONS.md §12). Contextual quick actions: "Create new quote" (navigates to Quote Builder), "View invoices" (jumps to Billing tab), "Pause subscription" / "Resume" (Stripe-billed SaaS only — hidden for retainers and hidden unless `deals.subscription_state = 'active_current'` AND `today < deals.committed_until_date` AND `deals.pause_used_this_commitment = false`; retainers cannot pause per FOUNDATIONS.md §12), "Create invoice" (manual-billed only, routes to Branded Invoicing). Below the card: quote history timeline — all quotes sent to this company chronologically, with status badges, each linking to the quote web view.
- **Contacts list** — all contacts linked to this company. Name, role/title, email, phone, preferred channel, health score dot. Click navigates to the contact profile.
- **External links** — typed categories: Google Drive, Frame.io, Pixieset Gallery, Dropbox, Other. Each has a category icon, label, and URL. Andy can add, edit, and remove. Links are available as variables in automated email templates — when a deliverable is marked "uploaded", the email auto-includes the relevant gallery/folder link by category. Links also surface on the client portal menu.
- **Onboarding status** — derived from primitives (Brand DNA completion, Revenue Segmentation completion, practical setup steps). Visual indicator of where the client is in the onboarding sequence. Not a dedicated state table — composed at read time from the underlying data.

---

## 3. Admin profiles — contact

### 3.1 URL and access

`/lite/contacts/[id]` — admin-only, behind auth. Numeric ID.

### 3.2 Tab structure

Five tabs in this order:

1. **Overview** — Context Engine surfaces + private notes + deal snapshot + tasks. See §4.
2. **Comms** — threaded conversations with this specific contact. See §8.
3. **Brand DNA** — individual Brand DNA profile. See §7.
4. **Portal Chat** — this contact's AI chat log. See §9.
5. **Activity** — full `activity_log` filtered to this contact, interleaved with private notes (lock icons). Chronological, newest first.

### 3.3 Overview tab layout

Two-column layout with full-width section below.

**Left column — Context Engine summary tile:**
- Narrative paragraph (Haiku-generated from `assembleContext()`) on the left side of the tile.
- Structured facts sidebar on the right side of the tile: health score label, last contact date, deal stage, preferred channel, key signals.
- Draft drawer trigger button. Clicking opens the right-side drawer (slides from right edge, overlays the right column). Consistent with Task Manager's drawer pattern.

**Right column — operational state:**
- **Deal snapshot card** (compact) — current stage, deal value, next step, won outcome if applicable. Click navigates to the deal on the pipeline.
- **Action items panel** — from Context Engine's `getActionItems()`. Two groups: "You owe" (Andy's commitments) and "They owe" (contact's commitments). Sorted by urgency. Inline single-click actions (complete, dismiss, edit). These are auto-extracted conversational commitments — separate from tasks.
- **Linked tasks** — from Task Manager, filtered by `entity_type` + `entity_id` for this contact. Shows `client_deliverable` and `client_task` kinds. Compact list with title, due date, status badge. Click opens the Task Manager detail drawer. "New task" button pre-fills the entity link.

**Below both columns — full-width:**
- **Private notes** — Andy's working notes about this person. Chronological feed with note content, timestamp, and "Visible to AI" toggle (default on) on the note-writing input. Notes with "Visible to AI" off show a crossed-eye icon. Add note input at the top of the section. The Context Engine has no import path to private notes (module boundary enforced) — notes with "Visible to AI" toggled on are read through a separate, explicit query path, not through the engine's module.

**Draft drawer (right-side overlay):**
- Opens from the right edge when triggered. Contains the Context Engine's draft generation UI: channel selector (auto-picked from `preferred_channel`, one-click switcher), draft content area, nudge field (reuses Content Engine's rejection-chat primitive for "make it more direct" / "add the invoice reference" style refinements), send button. Auto-saves unsent drafts (one per contact, persists until sent or discarded). Subtle indicator on the contact profile when an unsent draft exists.

---

## 4. Private notes and activity log coexistence

Two distinct surfaces for two distinct purposes:

**Overview tab — private notes section:**
- Clean, focused surface for Andy's working notes.
- Add note input with "Visible to AI" toggle (default on).
- Chronological feed showing only private notes.
- This is where Andy writes and reads daily working notes.

**Activity tab — unified timeline:**
- Full chronological interleaving of `activity_log` entries and private notes.
- Private notes marked with a lock icon to visually distinguish them from system-generated audit entries.
- Provides the complete story of a relationship — what happened, in what order, including Andy's annotations.
- Read-only here — Andy writes notes on the Overview tab.

---

## 5. Deliverables tab (company profile)

Filtered view of Task Manager. **No separate deliverables data model.** All data comes from the `tasks` table via Task Manager's exported functions.

### 5.1 Layout

- **Progress bar** at top — "6 of 9 deliverables complete this month." Counts tasks with `kind IN ('client_deliverable', 'client_task')` linked to this company.
- **Three status groups:**
  - **In Progress** — tasks with `status = 'in_progress'` or `status = 'todo'`.
  - **Awaiting Approval** — tasks with `status = 'awaiting_approval'`. These are deliverables waiting on the client.
  - **Delivered / Done** — tasks with `status IN ('delivered', 'done')`.
- Each item shows: title, due date, priority, checklist progress (if applicable), status badge.
- Click opens the Task Manager detail drawer — all editing happens there.
- **"New deliverable" button** — opens the Task Manager drawer pre-filled with `kind = 'client_deliverable'` and the company pre-linked via `entity_type = 'company'` and `entity_id`.

### 5.2 Data access

```
getTasksForEntity('company', companyId, { kind: ['client_deliverable', 'client_task'] })
```

Approval workflow uses `approveDeliverable()` from `lib/tasks/approve.ts`. No forks.

---

## 6. Billing tab (company profile)

### 6.1 Payment summary cards

Four cards at the top:
- **Total Invoiced** — sum of all non-void invoices for this company.
- **Total Paid** — sum of all paid invoices.
- **Outstanding** — sum of sent + overdue invoices.
- **Overdue** — sum of overdue invoices only.

Scoped to this company. Same pattern as `/lite/invoices` standalone index but filtered.

### 6.2 Invoice list

Filterable list: invoice number, date issued, amount (inc GST), due date, status badge (draft / sent / overdue / paid / void). Click navigates to the invoice detail view. Sortable by date and amount.

### 6.3 Payment method section

- **Billing mode** — manual or Stripe. Read-only display.
- **Payment terms** — `companies.payment_terms_days` (default 14). Editable inline.
- **For manual-billed clients:** bank transfer details on file (if recorded), reference format.
- **For Stripe-billed clients:** payment method on file (card last four, expiry), "Manage billing" button that opens Stripe Billing Portal in a new tab.
- **GST applicable** — `companies.gst_applicable` boolean. Read-only display.

### 6.4 Quick actions

- **"New invoice"** (manual-billed) — navigates to Branded Invoicing's manual trigger.
- **"View in Stripe"** (Stripe-billed) — opens the Stripe customer record in a new tab.

---

## 7. Brand DNA tab

### 7.1 Company profile — Brand DNA tab

**Multi-stakeholder companies:**
- **Hero section** — company blend profile. Prose portrait, tag cloud, first impression paragraph. Generated by Claude from individual profiles (see Brand DNA spec §10).
- **Divergence flags** — where stakeholder profiles meaningfully disagree, flagged visually on the blend.
- **Individual profiles list** — below the blend. Each shows: contact name, completion status (complete / in progress / not started), completion date. Click navigates to the contact's Brand DNA tab.
- **"Send reminder" button** next to incomplete profiles — fires the Brand DNA invite link via the channel adapter (`classification: 'transactional'`).

**Solo operators:**
- No blend needed. The tab shows their individual profile directly as the hero section, same layout.

### 7.2 Contact profile — Brand DNA tab

- The individual's full Brand DNA profile: prose portrait, tag cloud, first impression paragraph, section-by-section tag breakdown.
- Retake history — if the profile has been retaken, show version dates with "Compare" link to the side-by-side view (owned by Brand DNA spec).
- Link to take/retake the assessment.

---

## 8. Comms tabs

### 8.1 Company Comms tab

All conversations with all contacts at this company. Threaded by conversation using `thread_id` from the Unified Inbox schema. Newest thread first.

Each thread shows: participants (contact names), last message preview, channel icon (email/SMS), timestamp, unread indicator.

Click expands the thread inline or opens in a side panel showing the full exchange. Draft drawer (from Context Engine) accessible from any message — click reply, drawer opens with context loaded for that contact.

### 8.2 Contact Comms tab

Same threaded view, filtered to threads involving this specific contact only. Identical interaction pattern. The AI chat log does NOT appear here — it lives on the Portal Chat tab (see §9).

### 8.3 Abstract reference

Comms data comes from the `messages` table defined by the Unified Inbox spec (#11). Client Management consumes thread queries filtered by company or contact. If the Unified Inbox spec isn't locked before Client Management builds, the abstract schema reference is: `messages` with `id`, `contact_id`, `direction`, `channel`, `subject`, `body`, `thread_id`, `sent_at`, `created_at`.

---

## 9. Portal Chat tabs (admin view)

### 9.1 Contact Portal Chat tab

Full conversation log between this contact and the portal AI bartender. Read-only on the admin side. Newest messages first (or chronological with scroll-to-bottom — Phase 5 implementation decision).

Each message shows: role (client / assistant), content, timestamp. Escalated messages flagged with a distinct badge ("Escalated to inbox"). Messages where the AI performed a limited action show the action taken ("Approved deliverable: March logo pack").

### 9.2 Company Portal Chat tab

Aggregated across all contacts at this company. Grouped by contact — each contact's conversations in a collapsible section with their name as the header. Same read-only display. Gives Andy the "what are people at this company asking the AI?" view.

---

## 10. Client portal

### 10.0 Pre-retainer rendering mode (added 2026-04-13 Phase 3.5 per Six-Week Plan Generator patch)

The same `/portal/[token]` shell renders three lifecycle modes:

| Mode | Trigger | Active sections | Rate limits |
|---|---|---|---|
| **Pre-retainer** | Trial-shoot non-converter portal (Intro Funnel §14 / P2/P4) | Chat (bartender, plan-aware), Deliverables (photos, video, 6-week plan PDF), optionally Brand DNA if assessment taken. All other sections (Invoices, Package, Data Export, Messages) **locked** with a short voice-treated "available on retainer" card | `portal.chat_calls_per_day_pre_retainer` (settings key, Opus-gated) |
| **Retainer** (default) | `deals.stage = 'won'` + active subscription | All sections active | `portal.chat_calls_per_day_retainer` (higher ceiling) |
| **Archived** | 60 days post-shoot for non-converters (Intro Funnel P2) | Portal route returns a minimal offline page — 6-week plan PDF link still delivered via final email. Deliverables gallery link retained while Pixieset hosts it | Chat offline |

Mode determined at render time from `deals.stage` + `subscription_state` + shoot completion + archive scheduled-task state. Migration from pre-retainer → retainer is automatic on first retainer payment (`deals.stage` → `'won'`). Migration from pre-retainer → archived is driven by the `portal_archive_non_converter` scheduled task seeded by Intro Funnel at shoot completion.

### 10.1 Identity and access

- URL: `/portal/[token]` — token-based access, no sign-in required for initial onboarding. Magic link for ongoing auth (locked in Onboarding spec).
- Every surface says **"SuperBad"**, never "SuperBad Lite."
- Each contact gets their own individual portal. Portals are isolated per contact — chat, Brand DNA, and the bartender opening line are scoped to the individual. Shared company data (deliverables, invoices, package) is visible but presented as "your" deliverables, "your" invoices.
- Portal feel: the client's own private space with SuperBad (`feedback_individual_feel`). Not a dashboard. Not a shared platform.

### 10.2 Portal home — full-page chat

The portal opens on a full-page chat interface. Nothing else on the screen except:
- The conversation thread (persistent history from previous visits).
- The chat input with a subtle pulsing glow around the box.
- A contextual bartender-register opening line generated fresh each visit from `assembleContext()` + Brand DNA. Not a generic greeting — reads the client's current state (pending deliverables, recent invoices, onboarding progress) and picks the right opener. The bartender already knows what they drink.
- The menu bubble (bottom-left or top-right — Phase 5 layout decision) that expands into the full-page menu overlay.

The chat is the concierge. The client asks questions, gets instant answers, requests actions, or gets handed off to Andy. The "What's Next" information is delivered conversationally as the bartender's opening line rather than as a static summary card.

### 10.3 AI chat — capabilities

**Read-only Q&A:**
- Answers questions about the client's account using `assembleContext()`, Brand DNA profile, deliverables, invoices, quotes, onboarding status.
- Knowledge boundary: only what Lite knows about this specific contact and their company. Never other clients' data, never internal pipeline state, never private notes (module boundary enforced).
- Voice: bartender register from S&D spec. Warm, observational, knows your name, never pitches. Honest about being AI if asked directly ("No — but Andy is. Want me to get him?").

**Escalation to Andy:**
- When the client asks something the AI can't answer or requests an action outside its scope, it drafts a concise summary and drops it into the comms inbox as an inbound message with `source = 'portal_chat_escalation'`.
- The client sees acknowledgement in bartender voice.
- Andy sees the escalation in the comms inbox threaded with the contact, with full context.

**Limited safe actions:**
- Approve or reject a deliverable awaiting their approval (routes through `approveDeliverable()` from Task Manager).
- Trigger their own data export (same background job as admin export, download link delivered in chat).
- Navigate to a specific invoice or quote (provides the token URL link in chat).
- Update payment method (provides Stripe Billing Portal link).
- **Explain a week or task in the Six-Week Plan** (added 2026-04-13 Phase 3.5 per Six-Week Plan Generator patch). When the plan is an active deliverable (pre-retainer mode), the bartender reads the plan JSON alongside the Client Context Engine and can return Opus-generated clarifications scoped to the plan — "what do you mean by week 3's offer push?", "can you expand on the Instagram hook idea?". Answers are grounded in the plan, not free-wheeling advice. Plan awareness persists into retainer mode — the plan is the baseline retainer brief.

**NOT in scope for the AI chat:**
- Profile editing (name, email, company details). Escalates to Andy.
- Rescheduling shoots or appointments. Escalates to Andy.
- Cancelling subscriptions. Escalates to Andy.
- Discussing other clients, internal pricing, or business strategy.
- General marketing advice or creative brainstorming (that's a future D-level feature).

### 10.4 AI chat — prompts

**Prompt 1: Bartender opening line** (Haiku)
- System: SuperBad Brand DNA profile (voice) + client's Brand DNA profile (personalisation) + `assembleContext()` output (current state) + deliverable/invoice/quote status summary.
- Instruction: generate a single warm, contextual opening line in bartender register. Acknowledge what's current without recapping. Never pitch. If nothing notable is happening, a simple warm greeting.
- Cached on `context_summaries` row, regenerated on portal visit if underlying data has changed since last generation.

**Prompt 2: Chat responses** (Opus)
- System: SuperBad Brand DNA profile + client's Brand DNA profile + `assembleContext()` output + deliverable list + invoice list + quote list + onboarding status + available actions schema.
- User: client's message.
- Instruction: answer in bartender register. Use context to answer account questions directly. If the client requests an action from the available actions list, execute it and confirm. If the question is outside knowledge boundary or available actions, escalate to Andy with a concise summary. Never hallucinate data. Never pitch. Never break character. Short responses preferred — bartender efficiency, not chatbot verbosity.
- Passes brand-voice drift check (§11.5) reading SuperBad's Brand DNA.

**Prompt 3: Escalation summary** (Haiku)
- System: client's message + bartender's response + reason for escalation.
- Instruction: draft a concise, factual summary for Andy. Internal voice (not bartender). Include what the client asked, what the AI couldn't help with, and any relevant context. One paragraph maximum.
- Output written to `messages` table with `source = 'portal_chat_escalation'`.

**Static content (content mini-session):**
- First-visit tour copy — 3 steps, bartender voice. Same for everyone. Not Claude-generated at runtime.

### 10.5 Chat persistence and privacy

- Chat messages stored in `portal_chat_messages` table.
- Persistent per contact — client can scroll back through previous conversations on subsequent visits.
- Escalated messages ALSO written to the `messages` table (Unified Inbox schema) so they thread into comms naturally.
- **Client experience:** feels private — their own chat, their own history.
- **Admin visibility:** Andy can see the full chat log on the contact's Portal Chat tab and aggregated on the company's Portal Chat tab.
- The client is not explicitly told Andy can see the log. It's operational visibility, same as Andy seeing their comms and invoices.

### 10.6 Menu bubble and overlay

- Persistent menu bubble visible on the chat home page and on all other portal pages.
- Tap/click expands into a **full-page overlay menu** — very clean, minimal UI. The SuperBad wordmark at top, then a simple list of sections:
  - Chat (returns to home)
  - Deliverables
  - Invoices
  - Brand DNA
  - Package
  - Messages (thread with Andy)
  - Gallery (Pixieset)
  - Download My Data
- Tap/click a section → overlay closes, section loads.
- The chat bubble (bottom-right) persists on all non-chat portal pages as a shortcut back to the chat.

### 10.7 First-visit tour

Runs once on a contact's first portal visit. Three steps, bartender voice:

1. **The chat** — "This is your space. Ask me anything about your account."
2. **The menu** — highlight the menu bubble. "Everything else is in here."
3. **Done** — dismissal in bartender register.

Tour copy authored in the content mini-session. Static, not Claude-generated. Stored as a viewed flag on the contact record (or in `portal_chat_messages` as a system message).

### 10.8 Fallback chain

If the AI chat is unavailable (Anthropic API down, latency timeout):
1. **First fallback:** client's Pixieset gallery via the Pixieset API integration (from Intro Funnel spec). A real, valuable, personal content surface — not a degraded experience.
2. **Second fallback:** SuperBad-branded "something went wrong" page with a dry/humorous comment in bartender register. Contact email for Andy. Static page, no API dependency.

### 10.9 Portal sections (via menu)

**Deliverables:**
- Filtered view of tasks with `kind IN ('client_deliverable', 'client_task')` linked to this contact's company, via `getTasksForClientPortal()`.
- Shows: title, status, due date, checklist progress.
- Client can approve or reject deliverables with `status = 'awaiting_approval'` (routes through `approveDeliverable()`).
- All other statuses are read-only.

**Invoices:**
- Read-only list of invoices for this contact's company.
- Status badges, amounts, dates. "View" links to the token-URL invoice web view (Branded Invoicing).
- "Pay online" available for sent/overdue invoices with Stripe payment enabled.
- No edit, no create, no mark-as-paid from the portal.

**Brand DNA:**
- Read-only view of this contact's individual Brand DNA profile.
- If a company blend exists, shown below with a label ("Your company's combined profile").
- Link to retake the assessment (12-month retake nudge per Onboarding spec).

**Package:**
- Read-only view of the current package: type, value, commitment period, next invoice date.
- For Stripe-billed clients: "Update payment method" button opens Stripe Billing Portal.
- Subscription management: links to `/lite/portal/subscription` for pre-term and post-term cancel flow pages (consuming Quote Builder's defined flows — see Quote Builder spec §9).

**Messages:**
- Thread view with Andy (from Unified Inbox `messages` table filtered to this contact).
- Client can send messages. Messages are real comms, not AI chat — they appear in Andy's inbox.

**Gallery:**
- Embedded Pixieset gallery for this client (via Pixieset API, using the external link URL stored on the company profile).
- If no gallery linked, the section shows an empty state in bartender voice.

**Download My Data:**
- Also accessible via the AI chat as a limited action.
- Triggers the same background export job as the admin-side export. Download link delivered in the chat thread.

### 10.10 Real-time notifications

Three notification layers:

1. **Email** — sent via the channel adapter (`classification: 'transactional'`) when a deliverable status changes to `delivered` or `awaiting_approval`. Includes the relevant deliverable title and a link to the portal.
2. **Portal badge** — "new" indicator on the Deliverables section in the menu when there are changes since the client's last portal visit. Checked on page load using `contacts.portal_last_visited_at`. Not a live push — computed at render time.
3. **Real-time push** — WebSocket/SSE connection while the portal tab is open. If a deliverable status changes while the client is on the portal, a subtle toast appears in bartender voice ("something just landed for you"). Same channel can serve future real-time portal features (invoice paid confirmation, new messages) without additional plumbing.

### 10.11 Multi-contact isolation

Each contact at a company gets their own portal token, their own chat history, their own bartender opening line, their own Brand DNA tab. They share company-level data (deliverables, invoices, package) because that's company data, presented as "your" deliverables. No visibility into other contacts' portal chat or Brand DNA profiles.

---

## 11. Clients index (`/lite/clients`)

### 11.1 Navigation

Dedicated "Clients" item in the main Lite nav. Not behind the pipeline — a first-class section.

### 11.2 Summary cards

Four cards at the top:
- **Active Clients** — count of companies with at least one active deal.
- **Monthly Revenue** — sum of monthly values from active retainers + subscriptions.
- **Needing Attention** — count of companies with health score `at_risk` or `stale` (from Context Engine).
- **Overdue Invoices** — count of overdue invoices across all clients.

### 11.3 Client list

Compact rows (not cards). Each row shows:
- Company name
- Primary contact name
- Health score dot (green = healthy, amber = cooling, orange = at_risk, red = stale)
- Package type (retainer / project)
- Monthly value
- Last contact date
- Next action (single most useful thing — next deliverable due, overdue invoice, pending approval, etc.)

Default sort: health score ascending (worst first — at_risk and stale at top), then last contact date descending.

### 11.4 Filters

- **Relationship stage** — Active (default) / Completed / Churned. Derived from deal and subscription state:
  - Active = at least one Won deal with active quote/subscription.
  - Completed = all Won deals with no active quote/subscription (project finished, retainer ended naturally).
  - Churned = explicit cancellation via Quote Builder's cancel flow.
- **Billing mode** — Stripe / manual / all.
- **Vertical** — from company industry data.
- **Health score** — healthy / cooling / at_risk / stale.
- Search within the list by company or contact name.

### 11.5 Won → client transition

Automatic and invisible. When a deal moves to the Won stage (via Stripe webhook or manual drag), the company immediately appears in the `/lite/clients` index under the Active filter. No ceremony, no setup gate, no action required. The deal stays on the pipeline in the Won column. Onboarding orchestration (welcome email, Brand DNA gate, practical setup) is handled by the Onboarding spec — not by Client Management.

---

## 12. Global search

### 12.1 Trigger

`Cmd+K` keyboard shortcut or click on the search icon in the Lite header. Opens a search modal overlay. Mouse-first — the header click is the primary affordance, `Cmd+K` is a power-user shortcut.

### 12.2 Scope

Searches across:
- **Companies** — by name.
- **Contacts** — by name, email.
- **Deals** — by company name, contact name.
- **Invoices** — by invoice number (e.g. `SB-INV-2026-0012`).
- **Quotes** — by quote reference (e.g. `SB-2026-0042`).
- **Tasks** — by title.

### 12.3 Results

Grouped by type: People / Companies / Deals / Invoices / Quotes / Tasks. Each result shows the entity name/reference + a one-line context snippet. Click navigates to the entity. Keyboard-navigable (arrow keys + enter) but designed for mouse-first use.

### 12.4 Empty state

When the search input is empty, show recent items — the last 5-10 entities Andy navigated to. Quick jump back to recently visited profiles without typing.

---

## 13. One-click data export

### 13.1 Admin trigger

"Export everything" button on the company profile Overview tab. Fires a `scheduled_tasks` job with `task_type = 'client_data_export'`.

### 13.2 Client trigger

Via portal AI chat. The bartender handles "can I get a copy of everything?" / "download my data" / "export" as a limited safe action. Fires the same `scheduled_tasks` job. Download link delivered in the chat thread.

### 13.3 Job execution

Background job via the `scheduled_tasks` worker:
1. Query all data for the company: contacts, deals, comms, deliverables (tasks), invoices, quotes, action items, Brand DNA tags + prose.
2. Generate CSVs for tabular data.
3. Render PDFs for every invoice and quote via the shared Puppeteer pipeline (`lib/pdf/render.ts`).
4. Generate a Brand DNA prose portrait PDF (formatted, branded).
5. Generate a manifest file listing external links (Google Drive, Frame.io, galleries) by label and URL.
6. Bundle into ZIP via JSZip.
7. Store temporarily (7-day expiry).
8. Notify: cockpit notification for admin-triggered exports, chat message for client-triggered exports.

### 13.4 ZIP contents

- `contacts.csv` — all contacts at this company.
- `deals.csv` — deal history.
- `communications.csv` — comms history (subject, date, direction, channel — no full body for privacy).
- `deliverables.csv` — tasks with `kind IN ('client_deliverable', 'client_task')`.
- `invoices.csv` — all invoices with status, amounts, dates.
- `action-items.csv` — open and completed action items.
- `brand-dna-tags.csv` — Brand DNA signal tags.
- `brand-dna-profile.pdf` — prose portrait, formatted and branded.
- `invoices/` — folder of invoice PDFs.
- `quotes/` — folder of quote PDFs.
- `manifest.txt` — external link labels and URLs.

### 13.5 Filename

`superbad-[company-name-slugified]-export-[YYYY-MM-DD].zip`

---

## 14. Intro Funnel portal migration

When a deal transitions to Won, the prospect's Intro Funnel portal must be migrated to the real client portal. This is a background job triggered by the Won transition.

### 14.1 Migration job

1. Fired as a `scheduled_tasks` job with `task_type = 'intro_funnel_portal_migration'`.
2. Copies relevant data from the Intro Funnel portal to the client record:
   - Deliverables reference (Pixieset gallery URL → stored as external link with category "Pixieset Gallery").
   - Questionnaire answers (preserved for reference — stored as a JSON snapshot on the deal or as activity log entries).
   - Brand DNA signals (if the prospect started or completed Brand DNA during the trial shoot flow, the profile is already in `brand_dna_profiles` — no migration needed, just verified).
3. Intro Funnel portal status set to `archived_migrated`.
4. Old Intro Funnel magic link now redirects to the new client portal URL.
5. Activity log entry: `intro_funnel_portal_migrated`.

### 14.2 Graceful handling

If the migration job fails, it retries via the `scheduled_tasks` exponential retry mechanism. The client portal still works (it reads from the client's own data) — the migration just ensures Intro Funnel artifacts are preserved, not that the portal functions. No data loss risk — Intro Funnel data is not deleted during migration, only archived.

---

## 15. Data model

### 15.1 New table: `portal_chat_messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer PK | Auto-increment |
| `contact_id` | integer FK → contacts | The client contact |
| `role` | enum: `client` / `assistant` | Who sent the message |
| `content` | text | Message content |
| `escalated_to_inbox` | boolean (default false) | Whether this exchange was escalated to Andy's comms inbox |
| `tool_action` | text, nullable | Records when the AI performed a limited action (e.g. `approve_deliverable:task_id`, `trigger_export`) |
| `created_at` | integer (UTC epoch ms) | Timestamp |

### 15.2 New columns on `contacts`

| Column | Type | Description |
|--------|------|-------------|
| `portal_chat_last_seen_at` | integer, nullable (UTC epoch ms) | When the client last viewed the chat. Used for "new messages" indicators |
| `portal_last_visited_at` | integer, nullable (UTC epoch ms) | When the client last visited any portal page. Used for "new deliverables" badge logic |

### 15.3 Tables referenced (not created by this spec)

- `contacts`, `companies`, `deals` — Sales Pipeline
- `tasks` — Task Manager
- `invoices` — Branded Invoicing
- `quotes` — Quote Builder
- `brand_dna_profiles`, `brand_dna_answers`, `brand_dna_blends` — Brand DNA Assessment
- `context_summaries`, `action_items`, `private_notes` — Client Context Engine
- `activity_log` — Foundations
- `messages` — Unified Inbox
- `scheduled_tasks` — Quote Builder (shared primitive)

### 15.4 New `scheduled_tasks.task_type` values

- `client_data_export` — background ZIP generation
- `intro_funnel_portal_migration` — post-Won migration job

### 15.5 New `activity_log.kind` values (8)

- `portal_chat_message_sent` — client sent a message to the AI chat
- `portal_chat_escalated` — AI chat escalated a request to Andy
- `portal_chat_action_taken` — AI chat performed a limited action (deliverable approval, export trigger)
- `data_export_requested` — export job created (admin or client-triggered)
- `data_export_completed` — export ZIP ready for download
- `external_link_added` — external link added to company profile
- `external_link_removed` — external link removed from company profile
- `client_profile_viewed_by_admin` — Andy viewed a client profile (for activity log completeness)

---

## 16. Cross-spec flags

### 16.1 Flags FROM locked specs (this spec fulfils)

**Client Context Engine (LOCKED):**
- Contact Overview embeds summary tile (§14.1 of Context Engine spec), action items panel (§14.2), draft drawer trigger (§14.3). ✓
- Profile page renders `private_notes` alongside `activity_log` in Activity tab with lock icon. ✓
- "Visible to AI" toggle on note-writing UI on Overview. ✓
- Client Management owns the browser tab title. ✓

**Task Manager (LOCKED):**
- Deliverables tab uses `getTasksForClientPortal()` and entity-filtered queries. No separate deliverables table. ✓
- Approval workflow via `approveDeliverable()` from `lib/tasks/approve.ts`. No forks. ✓
- Portal shows `client_deliverable` and `client_task` kinds only. Never `personal`, `admin`, or `prospect_followup`. ✓

**Branded Invoicing (LOCKED):**
- Company profile Billing tab with payment terms, invoice list, "New invoice" button. ✓
- Client portal invoice list (read-only + pay-online via Branded Invoicing's token-URL web view). ✓

**Quote Builder (LOCKED):**
- "My invoices" page for manual-billed clients accessible from Q16 confirmation screen footer link → routes to Billing tab. ✓
- Subscription state displayed on company profile (Package section on Overview). ✓
- Portal owes `/lite/portal/subscription` with pre-term and post-term cancel branches (§9 of Quote Builder), pause-status page, and paid-exit confirmation screens. ✓

**Brand DNA Assessment (LOCKED):**
- Company profile shows Brand DNA completion status — individual + blend for multi-stakeholder. ✓
- Contact profile shows individual Brand DNA profile. ✓

**Onboarding + Segmentation (LOCKED):**
- Company profile shows onboarding completion status (derived from primitives). ✓
- Portal includes Brand DNA retake nudge card (12-month threshold). ✓

**Intro Funnel (LOCKED):**
- Fork-at-Won migration job preserves deliverables/questionnaire/Brand DNA signals. ✓
- Archived Intro Funnel portal redirects to new client portal. ✓

**Sales Pipeline (LOCKED):**
- Won deals graduate to Client Management — company appears in clients index immediately. ✓

### 16.2 Flags TO unlocked specs

**Unified Inbox (#11):**
- Must provide the `messages` table + thread queries filterable by company and contact.
- Must support portal chat escalation messages as inbound messages with `source = 'portal_chat_escalation'`.
- Must support `linked_task_id` nullable column (already flagged by Task Manager for rejection feedback with `source = 'task_rejection'`).

**Daily Cockpit (#12):**
- Should surface: new client onboarded alerts, churned client alerts, stale portal chat escalations (unanswered > 24h), data export failures.

**Content Engine (#10):**
- No direct dependency. Blog generation can read aggregated client signals for topic relevance (already flagged by Context Engine).

**Setup Wizards (#13):**
- External links setup during onboarding practical setup steps should write to the company's external links data.
- First-visit portal tour is NOT a setup wizard — it's a one-time overlay, not a multi-step configuration.

**SaaS Subscription Billing (#9):**
- Portal subscription management pages (`/lite/portal/subscription`) consume the cancel flow definitions from Quote Builder. SaaS billing spec must define its own cancel flow variant if it diverges from retainer cancel flows.

### 16.3 WebSocket/SSE infrastructure

The portal real-time push introduces a lightweight event channel. This is new infrastructure not defined in any prior spec. Requirements:
- Scoped to portal sessions (one connection per active portal tab).
- Fires on: deliverable status change, invoice status change, new message from Andy.
- Connection opens on portal page load, closes on tab close.
- No background resource drain — client must be on the portal.
- Same channel available for future real-time portal features.

Phase 5 implementation decision: SSE (simpler, HTTP-based, sufficient for server-to-client push) vs WebSocket (bidirectional, more complex). SSE recommended for v1 — the portal only needs server-to-client events.

---

## 17. Voice & delight treatment

### 17.1 Admin surfaces

Working tools. No hidden eggs on company or contact profiles — they're operational surfaces where voice would be noise. Ambient S&D slots apply automatically: empty states, loading copy, error states get `generateInVoice()` treatment per the S&D spec.

### 17.2 Portal surfaces

The AI chat IS the delight surface. The bartender voice is the portal's personality. Hidden eggs would compete with the bartender — suppressed on all portal surfaces.

Portal error page (fallback chain terminal) gets a dry one-liner — authored in the content mini-session.

### 17.3 Browser tab titles (CLAIMED)

Admin pages:
- `/lite/clients` — `"SuperBad Lite — [count] clients"` (dry variant when zero: `"SuperBad Lite — just you for now"`)
- `/lite/companies/[id]` — `"SuperBad Lite — [Company Name]"`
- `/lite/contacts/[id]` — `"SuperBad Lite — [Contact Name]"`

Portal pages (client-facing — "SuperBad", never "Lite"):
- Portal home (chat) — `"SuperBad — chat"`
- Portal sections — `"SuperBad — Deliverables"`, `"SuperBad — Invoices"`, etc.

---

## 18. Content mini-session scope

Small — most copy is Claude-generated at runtime. Can fold into another spec's content session:

- First-visit portal tour copy (3 steps, bartender voice)
- Portal error page dry one-liner (fallback chain terminal)
- Empty state copy for: no clients yet, no deliverables, no invoices, no comms, no external links, no Brand DNA
- Loading state copy for: AI chat warming up, export generating, gallery loading
- "New deliverable" notification email template
- Portal menu section labels (if anything beyond the plain names — probably not, keep it clean)

---

## 19. Out of scope for v1

1. **No client-self-serve profile editing.** Contact/company detail changes route through the bartender chat → escalation to Andy.
2. **No client-to-client visibility.** No shared directories, no "other clients" surfaces. Every portal is individually isolated.
3. **No separate deliverables data model.** Task Manager owns the table. Client Management and the portal display deliverables via Task Manager's exported functions, never direct table queries.
4. **No invoice generation from profiles.** Branded Invoicing owns generation. Billing tab displays and links.
5. **No quote creation from profiles.** "Create new quote" quick action navigates to Quote Builder, doesn't embed drafting.
6. **No portal analytics in v1.** No tracking of visit frequency, section usage, time spent. Future consideration.
7. **No multi-company contacts.** One contact belongs to one company. Dual-business clients are two contacts.
8. **No custom portal theming per client.** Portal uses SuperBad's brand, not the client's Brand DNA colours.
9. **No permanent client deletion.** Churned clients filtered from default index view but retain full profiles accessible via filter.
10. **No scheduled recurring exports.** One-click or chat-triggered only. No auto-export cadence.
11. **No encrypted/password-protected ZIPs.** Plain ZIP in v1.
12. **No selective-field export UI.** Full export only.

---

## 20. Open questions (for Phase 5 to resolve)

1. **Menu bubble placement** — bottom-left vs top-right on the portal. Depends on how the chat input and bubble coexist visually.
2. **Portal chat log display order** — newest-first (reverse chronological) vs chronological with scroll-to-bottom on the admin Portal Chat tab.
3. **SSE vs WebSocket** — for portal real-time push. SSE recommended (simpler, sufficient for server-to-client).
4. **Tour viewed flag storage** — dedicated column on contacts vs system message in `portal_chat_messages` vs browser localStorage. Dedicated column most reliable.
5. **External link categories** — the locked set (Google Drive, Frame.io, Pixieset Gallery, Dropbox, Other) may need extension. Phase 5 treats the list as a soft enum — new categories can be added without schema migration.

---

## 21. Risks

1. **Portal AI chat is a cost centre.** Every client message triggers an Opus call. At 20 active clients averaging 5 messages/week, that's ~400 Opus calls/month. Manageable at current scale but needs the `llm_usage_log` tracking (Context Engine spec) to monitor. Caching the opening line per visit reduces one call per visit to a conditional regeneration.
2. **Bartender voice consistency.** The chat must sound like the same person across days and clients. The brand-voice drift check (§11.5) helps, but Opus response variance is real. The content mini-session should establish 3-5 reference exchanges as calibration anchors for the prompt.
3. **Fallback chain user experience.** If both the chat and Pixieset gallery are down simultaneously, the client hits the error page on what's meant to be their home surface. Rare (requires both Anthropic and Pixieset to be down), but jarring. The error page must be good enough to not feel like a failure.
4. **Real-time push infrastructure.** SSE/WebSocket is new infrastructure for Lite. Keep it minimal — scoped to portal sessions only, no admin-side real-time. If it's unreliable in Phase 5, fall back to badge-on-load only and defer real-time push.
5. **Multi-stakeholder portal isolation.** Two people at the same company seeing different chat histories but the same deliverables could create confusion ("the AI told me X but my colleague says Y"). The bartender must give consistent factual answers regardless of which contact asks. Shared data queries ensure this; only the voice and greeting personalise.

---

## 22. Build-time disciplines

34. **No direct `tasks` table queries from Client Management.** All deliverable/task access via Task Manager's exported functions (`getTasksForEntity()`, `getTasksForClientPortal()`, `approveDeliverable()`). No `SELECT * FROM tasks` in Client Management code.
35. **No direct `messages` table queries from Client Management.** All comms access via Unified Inbox's exported functions (thread queries by company/contact). Abstract reference until Inbox spec locks.
36. **Portal chat knowledge boundary enforced at prompt level.** The chat response prompt receives only this contact's data + their company's data. Never cross-client data, never internal pipeline state, never private notes. Enforced by what `assembleContext()` returns + explicit scoping in the prompt's system instructions.
37. **Every portal action routes through an existing primitive.** Deliverable approval → `approveDeliverable()`. Export → `scheduled_tasks` job. Invoice view → Branded Invoicing token URL. No new action primitives defined in Client Management — it composes, never forks.

---

## 23. Reality check

### What's hardest

The **portal AI chat** is the highest-risk, highest-reward piece. Getting the bartender voice right, keeping responses fast (Opus latency on every message), handling edge cases (client asks about something Lite doesn't track, client gets frustrated, client tests the AI's limits), and maintaining consistent personality across thousands of interactions — that's the challenge. The fallback chain helps, but the chat IS the portal. If it's mediocre, the portal is mediocre.

### What could go wrong

- Opus latency makes the chat feel sluggish. Mitigation: stream responses.
- The bartender voice drifts or sounds different on different days. Mitigation: drift check + calibration anchors in the prompt.
- Clients try to use the chat for things it can't do and get frustrated. Mitigation: escalation is fast and graceful — "I've passed that to Andy" within seconds, not a dead end.
- The real-time push infrastructure is more complex than estimated. Mitigation: it's a progressive enhancement — portal works without it (badges on load cover the same use case, just not instantly).

### Is this doable

Yes. The admin profiles are pure composition — every data source already exists in a locked spec. The portal is genuinely new but scoped: one chat interface, one menu, a handful of read-only sections, and one background export job. The AI chat is the only novel technical challenge, and it builds on primitives the Context Engine already defines. Four build sessions is realistic with the dependency ordering noted.

---

## 24. Phase 5 sizing

**4 sessions:**

- **Session A: Admin profiles + global search.** Create `portal_chat_messages` table + contact columns. Build company profile (7 tabs wired to existing data sources). Build contact profile (5 tabs with Context Engine embedding). Build `/lite/clients` index with summary cards, list, filters. Build global search (`Cmd+K` + header). External links CRUD. Medium-large.

- **Session B: Portal — chat.** Portal home full-page chat UI. Bartender opening line prompt. Chat response prompt (Opus, streaming). Escalation prompt. Limited actions (approve deliverable, trigger export, navigate to invoice/quote, Stripe Billing Portal link). Conversation persistence. Menu bubble + full-page overlay menu. First-visit tour. Fallback chain (gallery → error page). Large — the chat is the most complex piece.

- **Session C: Portal — sections + notifications.** Deliverables view (via `getTasksForClientPortal()`). Invoices view (via Branded Invoicing token URLs). Brand DNA view (read-only). Package view + subscription management links. Messages view (via Unified Inbox). Gallery embed (Pixieset). Email notifications on deliverable status change. "New" badges on portal menu. Real-time push (SSE). Medium.

- **Session D: Data export + migration + cancel flow.** One-click ZIP export via `scheduled_tasks` + Puppeteer PDF rendering + JSZip bundling. Client-triggered export (chat integration). Intro Funnel fork-at-Won migration job. `/lite/portal/subscription` pre-term and post-term cancel flow pages (consuming Quote Builder §9). Medium.

**Dependencies:** A before B (admin profiles needed for Portal Chat tab). B before C (chat must exist before sections reference it). D can parallel B or C.

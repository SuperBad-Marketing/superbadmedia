# Client Context Engine — Feature Spec

**Phase 3 output. Locked 2026-04-12. 31 questions resolved.**

> **Prompt files:** `lib/ai/prompts/client-context-engine.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

The "where you are in the conversation" companion to Brand DNA's "who they are at their core." A per-contact always-on Claude engine that invisibly stores all relevant context, maintains a living summary on the profile, auto-extracts action items with ownership, and on-demand produces channel-aware draft follow-ups and replies.

Every client-facing LLM call in Lite reads **two** perpetual contexts together — Brand DNA and this engine's output. Neither alone is sufficient. See `project_two_perpetual_contexts` and `project_brand_dna_as_perpetual_context` memories.

---

## 1. The 31 locks (quick-reference table)

| # | Decision | Lock |
|---|----------|------|
| 1 | Context storage pattern | Compose at read time from source tables; no dedicated `context_events` table |
| 2 | Summary cache shape | Sectioned — narrative, signals (computed on read), draft fields inline |
| 3 | Material event triggers | Explicit closed event list, each mapped to which sections regenerate |
| 4 | Action items storage | Dedicated `action_items` table, first-class queryable data |
| 5 | Health score | Rule-based composite: `healthy` / `cooling` / `at_risk` / `stale`, no Claude call |
| 6 | Regeneration timing | Background via `scheduled_tasks` worker; signals recomputed on read |
| 7 | Draft prompt composition | Cached summary + last 3 messages + Brand DNA + action items + metadata; context as silent system knowledge, reply targets latest message only, no recapping |
| 8 | Raw messages in draft prompt | Last 3 messages in the thread |
| 9 | Action item extraction trigger | Background task per message, processed before summary regeneration |
| 10 | Action item ownership | Message direction as primary signal; ambiguous defaults to "you" (Andy) |
| 11 | Channel adapter | `preferred_channel` enum on contact + adapter interface; auto-updates on send/receive |
| 12 | Draft panel UI | Right-side drawer, consistent with Task Manager pattern; auto-saves unsent drafts |
| 13 | Action items display | Two groups ("You owe" / "They owe"), sorted by urgency, inline single-click actions |
| 14 | Unsent draft persistence | Persists until sent or discarded; one per contact; subtle profile indicator |
| 15 | Privacy boundary | Separate `private_notes` table; "visible to AI" toggle (default on); engine has no import path to private table |
| 16 | Cold prospect fallback | SuperBad-voiced drafts from enrichment data; nudge field fills gaps |
| 17 | Summary tile layout | Narrative paragraph (left) + structured facts sidebar (right) |
| 18 | Summary voice | Flat factual — working tool, not a personality surface |
| 19 | Signal emissions for cockpit | Fixed signal set, computed cheaply, typed contract |
| 20 | Integration API surface | Exported function library in `lib/context-engine/`; typed imports |
| 21 | Cost architecture | Per-action token caps + daily usage logging; no hard kill-switch in v1 |
| 22 | Regeneration coalescing | Deduplication at enqueue time; skip if pending task exists for same contact |
| 23 | `context_summaries` schema | One row per contact; nullable draft fields inline; signals computed on read |
| 24 | `action_items` schema | Dedicated table with owner/source/status enums; dismissed = soft status |
| 25 | Event-to-section mapping | Messages → extraction + summary; stage/action-item changes → summary only; invoices/quotes/deliverables/Brand DNA → signals only (no Claude call) |
| 26 | Voice & delight | Existing ambient slots (empty states, loading copy) apply; no new sprinkle claims |
| 27 | Unified Inbox dependency | Abstract reference to `messages` table shape; Inbox spec fulfils |
| 28 | Browser tab title | Deferred to Client Management spec (owns the page) |
| 29 | `activity_log.kind` values | 11 new values |
| 30 | `scheduled_tasks.task_type` values | 2 new values |
| 31 | Claude prompts | 5 total: 3 Haiku, 2 Opus |

---

## 2. Architecture overview

### 2.1 The two perpetual contexts

Every LLM-generated artefact on behalf of a contact reads both:

1. **Brand DNA profile** — who they are at their core. Psychological, taste, voice, quirks.
2. **Client Context Engine summary** — where you are in the conversation right now. Comms, action items, deal state, deliveries, invoices, relationship health.

Brand DNA alone = beautifully voiced drafts disconnected from reality.
Context Engine alone = situationally aware drafts that sound like a generic CRM.
Both together = drafts that are authentically *them* AND in the real current context.

### 2.2 Single primitive, two audiences

The engine serves prospects AND clients through a single primitive. The moment a prospect replies, they have comms history worth summarising. When Deal → Won, context history transfers with zero work — same table underneath. Lead Gen's "generate email" button is a special case of this primitive with an empty-history cold fallback.

### 2.3 Compose at read time

The engine does **not** maintain its own copy of source data. When a summary needs regenerating or a draft needs writing, it queries existing source tables directly — `messages`, `activity_log`, `deals`, `tasks`, `invoices`, `brand_dna_profiles` — assembles the context window, and calls Claude. The summary output is cached in `context_summaries`, but the raw context is always read fresh.

This means the context is always accurate by definition. No dual-write obligation on other features. No silent drift when a feature forgets to write to a secondary store.

### 2.4 Engine posture

- **Active summaries** — regenerate automatically on material events. Fast cheap model (Haiku). Background task via `scheduled_tasks` worker.
- **Reactive drafts** — strictly human-initiated. Andy clicks a button, Opus generates. Never proactive.
- **Signals feed cockpit** — the engine emits structured signals (health score, action item counts, days since contact). The Daily Cockpit consumes these. The engine does **not** raise its own attention flags. One attention surface, many data sources.

---

## 3. Context assembly

### 3.1 The `assembleContext()` function

Lives in `lib/context-engine/assemble.ts`. The single place where source data is gathered for any Claude call. All privacy enforcement happens here.

**Data sources read:**
- `messages` — conversation history (via abstract Unified Inbox schema reference, §10)
- `activity_log` — stage changes, outreach sends, mutations (WHERE `is_private = false` — though private notes live in a separate table, the activity log may have its own private flag for future use)
- `action_items` — auto-extracted and manual commitments
- `deals` — current stage, value, dates
- `tasks` — deliverable status, approval state (filtered by `entity_type='contact'` or `entity_type='client'`)
- `invoices` — outstanding, paid, overdue
- `brand_dna_profiles` — structured tags JSON + prose portrait (if exists)
- `companies` — company metadata, Revenue Segmentation data

**Data sources explicitly excluded:**
- `private_notes` table — the engine module has **no import path** to this table. Physical separation, not logical filtering. See §7.

### 3.2 Context variants

`assembleContext()` accepts a `purpose` parameter that controls what's assembled:

- `purpose: 'summary'` — full breadth, compressed for Haiku. Used by the summary regeneration prompt.
- `purpose: 'extraction'` — single message + direction metadata only. Used by the action item extraction prompt.
- `purpose: 'draft'` — cached narrative summary + last 3 raw messages + Brand DNA + open action items + deal/invoice metadata. Used by the draft generation prompt.

---

## 4. Summary system

### 4.1 Sectioned cache

The `context_summaries` table stores one row per contact with independently-managed sections:

- **`conversation_summary`** — the flat factual narrative paragraph. 2–4 sentences. Haiku-generated. Describes the current state of the relationship without personality, opinion, or dry wit. A working tool, not a voice surface. Example: *"Discussing a rebrand for three cafe locations. Quote sent April 3, accepted April 7. First deliverables due April 18. Two action items open — both yours. Last message from them was April 9, asking about the timeline."*

- **Signals** — NOT stored. Computed on read by `computeHealthScore()` and `getSignalsForContact()`. Always fresh, zero regeneration cost.

- **Draft fields** — nullable columns for unsent draft persistence (§6.4).

### 4.2 Material event list (closed)

Events that trigger a `context_summary_regenerate` background task (regenerates `conversation_summary`):

| Event | Triggers extraction? | Triggers summary? |
|-------|----------------------|-------------------|
| New inbound email | Yes (per-message) | Yes |
| New outbound email | Yes (per-message) | Yes |
| Deal stage change | No | Yes |
| Action item completed | No | Yes |

Events that affect signals only (no Claude call — `computeHealthScore()` picks them up on next read):

- Invoice sent, paid, or overdue
- Quote sent, accepted, or expired
- Deliverable status change (submitted, approved, rejected)
- Brand DNA profile completed or retaken
- Contact added or removed from a company

**Result:** most events trigger zero Claude calls. Only "the conversation moved" events trigger Haiku regeneration. Extraction runs only on new messages.

### 4.3 Background regeneration

Material events enqueue a `context_summary_regenerate` task into the `scheduled_tasks` table with `run_at = now`. The shared cron worker picks it up within seconds.

**Deduplication at enqueue time:** before inserting a new task, check if a pending (unprocessed) `context_summary_regenerate` task already exists for the same `contact_id`. If yes, skip the enqueue. The existing pending task will read fresh source data when it executes — compose at read time (§2.3) guarantees it reflects all events up to execution.

**Extraction before summary:** `context_action_item_extract` tasks are processed before `context_summary_regenerate` tasks. When the summary regenerates, freshly extracted action items are already in the `action_items` table and reflected in the output.

### 4.4 Summary voice

Flat factual. Short sentences. No personality, no dry wit, no opinion. The summary is a working tool — Andy reads it to get oriented before acting. Personality adds processing overhead. The draft is where voice matters (client-facing); the summary behind the curtain is invisible infrastructure.

Exempt from the brand-voice drift check (Foundations §11.5) — internal surface only.

---

## 5. Action items

### 5.1 Auto-extraction

Every new inbound or outbound message enqueues a `context_action_item_extract` background task. The Haiku extraction prompt receives:

- The message body (text only)
- `direction: 'inbound' | 'outbound'`

**Ownership rules:**
- In an **inbound** message: first-person ("I'll send", "we'll have") = `them`. Second-person ("can you", "could you send") = `you`.
- In an **outbound** message: the reverse. First-person = `you`. Second-person = `them`.
- **Ambiguous defaults to `you`** (Andy). Better to surface a false "you owe this" than to let a real commitment slip.

**Due date inference:** the prompt extracts explicit dates ("by Tuesday", "next Friday") and maps them to actual dates using the message timestamp as anchor. Vague references ("soon", "when you get a chance") produce `due_date = null`.

### 5.2 Manual add

Andy can manually add action items from the contact profile for offline commitments (phone calls, coffee meetings). Manual items have `source = 'manual'` and `source_message_id = null`.

### 5.3 Display

Two groups on the contact profile, below the narrative summary tile:

- **"You owe"** — Andy's open action items for this contact, sorted by due date (overdue first, then soonest due, then no-date items)
- **"They owe"** — the contact's open commitments, same sort

Each item shows:
- One-line description
- Due date (if any, rendered via `formatTimestamp()`)
- Subtle source indicator (extracted vs manual)

Three inline actions per item:
- **Done** (checkmark) — marks `status = 'done'`, sets `completed_at`
- **Dismiss** (X) — marks `status = 'dismissed'`, for misreads
- **Edit** (pencil) — inline edit for description and due date

Completed and dismissed items collapse into a "Past items" toggle at the bottom, hidden by default.

### 5.4 Lifecycle

Action items use soft status. Dismissed items stay in the table with `status = 'dismissed'` — preserves extraction history for prompt tuning and respects the audit discipline (Foundations §11.1). `logActivity()` records every status transition.

---

## 6. Draft system

### 6.1 Prompt architecture

When Andy clicks "Generate draft," the engine assembles context and calls Opus. The prompt is layered to prevent recapping:

**System context (silent — informs the output, never narrated):**
- Cached `conversation_summary` (the narrative paragraph — compressed history)
- Brand DNA profile (structured tags + prose portrait; falls back to SuperBad's own Brand DNA for prospects without a profile)
- Open action items (both owners)
- Current deal stage + value
- Outstanding invoice status
- Contact metadata (company, role, channel preference)

**Explicit instruction:**
"Reply to the message below. Don't recap the conversation. Don't reference context unless the reply naturally requires it. Just respond the way a person who knows all of this would."

**Reply target:**
The last 3 messages in the thread (both directions). Gives Claude conversational momentum without pulling in old tangents. If fewer than 3 messages exist, uses what's available.

**Result:** context shapes *what* to say and *how* to say it. The reply reads like a human who just happens to know everything.

### 6.2 Nudge field

Below the generated draft: a single "nudge it" text box, normally subdued. Andy types a natural-language instruction ("less formal", "mention the shoot on Thursday", "shorter") and the engine regenerates with the nudge as added context. Previous draft + nudge history preserved so Claude understands the refinement direction.

**Reuses the Content Engine's rejection-chat primitive** — same UI component, same chat persistence model, zero new infrastructure.

### 6.3 Channel handling

Each contact has a `preferred_channel` column (enum: `email`, later `sms`) auto-updated on every successful send/receive. New contacts default to `email`.

When Andy clicks "Generate draft," the engine reads `preferred_channel` and formats accordingly. A one-click channel switcher on the draft drawer reformats the content for the new channel without losing nudge context — calls `reformat-draft-for-channel.ts` (Haiku, cheap transformation).

**v1 is email-only.** When Twilio lands, `sms` is added to the enum, the Twilio adapter implements the same interface, and the switcher lights up. Zero refactoring.

**Adapter interface:**
- `formatDraft(content, channel)` — adjusts length, tone, sign-off for the channel
- `sendDraft(content, channel, recipient)` — routes to Resend for email, Twilio for SMS

### 6.4 Unsent draft persistence

Closing the draft drawer without sending preserves the draft. Stored as nullable fields on the `context_summaries` row:

- `draft_content` — the draft text
- `draft_channel` — channel it was formatted for
- `draft_nudge_history` — JSON array of nudge inputs so regeneration preserves context
- `draft_generated_at` — timestamp

**One draft per contact, max.** Generating a new draft replaces the old one. A subtle "unsent draft" indicator on the profile tile shows when a draft is waiting.

Drafts persist until explicitly sent or discarded. No TTL. An interrupted draft (phone rings, Andy navigates away) is always recoverable.

### 6.5 Cold prospect fallback

When a contact has zero messages and no Brand DNA, the draft prompt receives:
- SuperBad's own Brand DNA profile as the voice substrate
- Whatever enrichment data Lead Gen found (company website, industry, Meta ad activity, location, team size)
- No conversation summary (there is none)

The system prompt tells Claude: "This is a first-touch cold outreach. You have no prior relationship." Andy can use the nudge field to add specifics he knows ("mention I met her at the Melbourne event last week").

### 6.6 Drift check

Every generated draft (initial + nudge regenerations) passes through the brand-voice drift check (Foundations §11.5) before being shown to Andy. Reads the relevant Brand DNA profile — the contact's own for client-facing output, SuperBad's own for cold prospects.

---

## 7. Privacy boundary

### 7.1 Architecture

Private notes live in a dedicated `private_notes` table. The Context Engine module (`lib/context-engine/`) has **no import path** to this table. Physical separation, not logical filtering.

### 7.2 UI

The note-writing UI has a "visible to AI" toggle, defaulting to **on**:
- **On** — note stored in `activity_log` as normal. The engine can read it.
- **Off** — note stored in `private_notes`. The engine cannot see it. Ever.

The profile UI renders both tables into one unified timeline with a visual indicator (lock icon) on private notes. Andy sees everything. Claude sees only the public table.

### 7.3 Editing visibility after creation

Flipping a note from public to private (or reverse) moves the row between tables in a single transaction — delete from one, insert into the other. Rare operation, straightforward code.

### 7.4 Rationale

Even with strict system-prompt instructions, private observations about a contact ("this guy is a pain to work with") could subtly colour Claude's draft tone. Query-layer exclusion (WHERE `is_private = false`) relies on every future developer remembering the filter. Physical separation means the engine literally cannot access the data — if someone tries to import the private notes table into the engine module, it's a code review catch, not a runtime bug.

---

## 8. Health score

### 8.1 Rule-based computation

`computeHealthScore(contactId)` returns a numeric score (0–100) and a label:

| Label | Score range | Meaning |
|-------|-------------|---------|
| `healthy` | 75–100 | Recent contact, no overdue items, deal progressing |
| `cooling` | 50–74 | Getting stale — last contact 7–14 days ago, or minor overdue items |
| `at_risk` | 25–49 | Needs attention — last contact 14+ days, overdue action items, stuck deal |
| `stale` | 0–24 | Relationship dormant — 30+ days since contact, no activity |

**Input factors:**
- Days since last contact (either direction)
- Number of Andy's overdue action items for this contact
- Number of their overdue action items
- Deal stage velocity (time in current stage vs expected)
- Outstanding invoice age
- Deliverable approval status (anything waiting too long)

Each factor has a weight. The formula is deterministic, cheap (pure SQL/arithmetic), and always explainable. Computed on read — never cached, never triggers a Claude call.

Weights and thresholds tunable post-launch based on what actually correlates with deals going cold.

---

## 9. Signal emissions for Daily Cockpit

### 9.1 Fixed signal set

The engine exports a typed signal object per contact:

```
{
  health_label: 'healthy' | 'cooling' | 'at_risk' | 'stale'
  days_since_last_contact: number
  overdue_action_items_you: number
  overdue_action_items_them: number
  total_open_action_items: number
  has_unsent_draft: boolean
  last_contact_direction: 'inbound' | 'outbound'
  deal_stage: string
  outstanding_invoice: boolean
}
```

### 9.2 Access functions

- `getSignalsForContact(contactId)` — returns the signal object for one contact
- `getSignalsForAllContacts()` — batch variant for cockpit morning brief aggregation

Both compute signals on read. No caching, no Claude call, pure queries + arithmetic.

The Cockpit spec decides how to weight, sort, filter, and surface these signals. The engine provides clean data, the cockpit provides interpretation.

---

## 10. Dependencies

### 10.1 Unified Inbox (abstract reference)

The engine assumes a `messages` table with at minimum:

| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `contact_id` | FK → contacts | |
| `direction` | enum: `inbound` / `outbound` | |
| `channel` | enum: `email` (later `sms`) | |
| `subject` | text, nullable | |
| `body` | text | |
| `thread_id` | nullable | For grouping into conversations |
| `sent_at` | timestamp | |
| `created_at` | timestamp | |

The Unified Inbox spec (#11) is free to add columns, rename, or restructure — as long as these fields are queryable, the engine works. If the Inbox spec defines a different shape, `assembleContext()` adapts.

### 10.2 Brand DNA Assessment (locked)

Reads `brand_dna_profiles` for tiered downstream injection:
- **Draft prompts (Opus):** full profile — structured tags JSON + prose portrait
- **Summary prompts (Haiku):** tags only (cheaper, sufficient for factual summaries)

Graceful degradation when profile is absent: use SuperBad's own Brand DNA profile as fallback for voice conditioning, or omit if neither exists (cold prospect pre-Brand-DNA).

### 10.3 Sales Pipeline (locked)

Reads `deals`, `contacts`, `companies`, `activity_log`. The activity log's append-only event substrate is the primary input for the narrative summary.

### 10.4 Shared scheduled_tasks worker (from Quote Builder)

Handler map gains 2 entries:
- `context_summary_regenerate` — regenerate the narrative summary for a contact
- `context_action_item_extract` — extract action items from a single message

Same retry, idempotency, heartbeat, exponential backoff behaviour as all other task types.

---

## 11. Integration API surface

### 11.1 Exported function library

Lives in `lib/context-engine/`. Every consuming spec imports what it needs. No API routes for inter-feature calls — server-side function imports within the same Next.js monolith.

```
// Summary + signals
getContextSummary(contactId) → { conversation_summary, summary_generated_at }
getSignalsForContact(contactId) → SignalSet
getSignalsForAllContacts() → Map<contactId, SignalSet>
getActionItems(contactId, filters?) → ActionItem[]

// Drafting
generateDraft(contactId, options?) → Draft
regenerateDraft(contactId, nudge, previousDraft) → Draft
reformatDraft(draft, newChannel) → Draft

// Health
computeHealthScore(contactId) → { score, label }

// Active strategy artefact (see §11.3)
getActiveStrategy(clientId) → ActiveStrategy | null
setActiveStrategy(clientId, payload, { origin, status }) → ActiveStrategy
markActiveStrategyReviewed(clientId) → ActiveStrategy   // flips pending_refresh_review → live
```

Draft UI calls `generateDraft` and `regenerateDraft` via Server Actions.

### 11.2 Consuming specs

| Spec | What it calls | How |
|------|--------------|-----|
| **Lead Generation** | `generateDraft()` with cold-prospect fallback | "Generate email" button on prospect profile |
| **Client Management** | `getContextSummary()`, `getActionItems()`, `generateDraft()`, `getActiveStrategy()` | Profile summary tile, action items panel, draft drawer, portal-chat bartender context |
| **Daily Cockpit** | `getSignalsForAllContacts()`, `getActionItems(*, { owner: 'you', status: 'open' })`, `getActiveStrategy()` | Morning brief aggregation, attention flags, brief context |
| **Sales Pipeline** | `getContextSummary()` | Card hover summary on pipeline board |
| **Six-Week Plan Generator** | `setActiveStrategy()`, `markActiveStrategyReviewed()` | Migrate approved plan into active_strategy on `deal_won`; flip to live after Andy's refresh-review |
| **Content Engine** | `getActiveStrategy()` | Weekly content brief generation reads the live strategy as part of perpetual context |

### 11.3 The `active_strategy` artefact

A first-class Context Engine artefact representing **what we're currently doing for this client**. Distinct from the conversational summary (what's been said) and action items (next moves). Sits alongside Brand DNA in the perpetual LLM context — Brand DNA answers "who they are", `active_strategy` answers "what we're running".

**Origin and lifecycle:**
- Created by **Six-Week Plan Generator** when a Deal transitions to `won` (the `deal_won_portal_migration` job copies the approved plan's `{intro, weeks_json, chosen_primitives, theme_arc}` into the artefact). `origin = 'six_week_plan'`, `status = 'pending_refresh_review'`.
- Andy reviews the strategy at `/lite/clients/[clientId]/strategy/refresh-review` (route owned by Client Management). `markActiveStrategyReviewed()` flips `status → 'live'`.
- While `status = 'pending_refresh_review'`, downstream consumers (Content Engine briefs, portal chat, cockpit brief) treat it as **draft context** — readable but flagged as not-yet-ratified. Once `live`, it's authoritative.
- Future origins (`origin: 'manual_strategy'`, `'retainer_renewal'`) are additive — same shape, different provenance. Out of scope for v1.

**Read discipline:** every client-facing LLM call that already reads Brand DNA must also read `active_strategy` if present. Per `project_two_perpetual_contexts.md`, reading only one when both exist is a regression. `assembleContext()` (§3.1) handles this — consumers don't fan in manually.

---

## 12. Data model

### 12.1 `context_summaries` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `contact_id` | text (FK → contacts, unique) | One row per contact |
| `conversation_summary` | text, nullable | Haiku-generated flat factual narrative |
| `summary_generated_at` | integer (UTC epoch ms), nullable | Last regeneration timestamp |
| `draft_content` | text, nullable | Unsent draft text |
| `draft_channel` | text, nullable | `'email'` or later `'sms'` |
| `draft_nudge_history` | text (JSON), nullable | Array of nudge inputs |
| `draft_generated_at` | integer (UTC epoch ms), nullable | |
| `created_at` | integer (UTC epoch ms) | |
| `updated_at` | integer (UTC epoch ms) | |

### 12.2 `action_items` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `contact_id` | text (FK → contacts) | |
| `description` | text | One-line commitment |
| `owner` | text | Enum: `'you'` / `'them'` |
| `due_date` | integer (UTC epoch ms), nullable | Null if no explicit date |
| `source` | text | Enum: `'claude_extract'` / `'manual'` |
| `source_message_id` | text (FK → messages), nullable | Populated for extractions, null for manual |
| `status` | text | Enum: `'open'` / `'done'` / `'dismissed'` |
| `created_at` | integer (UTC epoch ms) | |
| `completed_at` | integer (UTC epoch ms), nullable | |

### 12.3 `private_notes` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `contact_id` | text (FK → contacts) | |
| `content` | text | Note body |
| `created_by` | text (FK → users) | |
| `created_at` | integer (UTC epoch ms) | |
| `updated_at` | integer (UTC epoch ms) | |

**Module boundary enforcement:** the `private_notes` table is defined in `lib/private-notes/` (or equivalent). The `lib/context-engine/` module has no import path to this module. Enforced at code review — any `import` from `lib/private-notes/` inside `lib/context-engine/` is a rejected PR.

### 12.4 `llm_usage_log` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `call_type` | text | e.g. `'summary_regeneration'`, `'action_item_extraction'`, `'draft_generation'`, `'draft_nudge'`, `'draft_reformat'` |
| `contact_id` | text (FK → contacts), nullable | |
| `model` | text | `'haiku'` or `'opus'` |
| `input_tokens` | integer | |
| `output_tokens` | integer | |
| `created_at` | integer (UTC epoch ms) | |

Feeds the admin Settings usage dashboard. Also serves the Phase 4 Autonomy Protocol token-budget monitoring.

### 12.5 `active_strategies` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | |
| `client_id` | text (FK → clients, unique) | One row per client |
| `origin` | text | Enum: `'six_week_plan'` (v1). Future: `'manual_strategy'`, `'retainer_renewal'` |
| `source_id` | text, nullable | FK back to origin row (e.g. `six_week_plans.id`); null for `manual_strategy` |
| `status` | text | Enum: `'pending_refresh_review'` / `'live'` / `'archived'` |
| `payload_json` | text (JSON) | `{ intro, weeks_json, chosen_primitives, theme_arc }` — shape mirrors source |
| `pending_refresh_review` | integer (boolean) | Mirrors `status = 'pending_refresh_review'` for fast filter; redundancy is intentional |
| `created_at` | integer (UTC epoch ms) | |
| `updated_at` | integer (UTC epoch ms) | |
| `reviewed_at` | integer (UTC epoch ms), nullable | Set when `markActiveStrategyReviewed()` runs |

**Read consumers:** Content Engine (weekly brief), Daily Cockpit (morning brief context), Client Management portal-chat bartender, any future LLM call routed through `assembleContext('client_facing')`.

**Audit:** all writes log via `logActivity()` with `kind` ∈ `{ 'active_strategy_created', 'active_strategy_reviewed', 'active_strategy_updated', 'active_strategy_archived' }`. Add to `activity_log.kind` enum (sales-pipeline.md §authoritative list).

### 12.6 New column on `contacts`

| Column | Type | Notes |
|--------|------|-------|
| `preferred_channel` | text | Enum: `'email'` (later `'sms'`). Default `'email'`. Auto-updated on send/receive. |

---

## 13. Claude prompts

### 13.1 `summarise-contact-context.ts` (Haiku)

**Trigger:** background task on material events (new message, stage change, action item completed).
**Input:** assembled context via `assembleContext('summary')` — recent messages, activity log entries, action items, deal state, invoice status, Brand DNA tags (if available).
**Input cap:** ~4k tokens.
**Output:** flat factual narrative paragraph, 2–4 sentences. Short sentences. No personality, no opinion. What's happening, what's pending, who owes what.
**Drift check:** exempt (internal surface).

### 13.2 `extract-action-items.ts` (Haiku)

**Trigger:** background task per new message (inbound or outbound).
**Input:** message body + `direction: 'inbound' | 'outbound'`.
**Input cap:** ~2k tokens.
**Output:** array of `{ description, owner, due_date }` objects. Zero or more per message.
**Ownership rules:** first-person in inbound = `them`, first-person in outbound = `you`. Ambiguous = `you`.
**Due date rules:** explicit dates mapped using message timestamp as anchor. Vague = `null`.
**Drift check:** exempt (internal extraction).

### 13.3 `generate-draft.ts` (Opus)

**Trigger:** Andy clicks "Generate draft" or "Generate reply" on a contact profile.
**System context (silent):** cached `conversation_summary` + Brand DNA profile (contact's own, or SuperBad's for cold prospects) + open action items + deal stage + invoice status + contact metadata.
**Reply target:** last 3 messages in thread.
**Explicit instruction:** "Reply to the message below. Don't recap the conversation. Don't reference context unless the reply naturally requires it. Just respond the way a person who knows all of this would."
**Input cap:** ~8k tokens.
**Output:** channel-formatted draft text.
**Drift check:** yes (client-facing output, §11.5).

### 13.4 `regenerate-draft-with-nudge.ts` (Opus)

**Trigger:** Andy types in the nudge field and submits.
**Input:** same as §13.3, plus previous draft text + nudge instruction + nudge history.
**Input cap:** ~10k tokens.
**Output:** revised channel-formatted draft text.
**Drift check:** yes.

### 13.5 `reformat-draft-for-channel.ts` (Haiku)

**Trigger:** Andy clicks the channel switcher on the draft drawer.
**Input:** existing draft text + target channel.
**Input cap:** ~2k tokens.
**Output:** reformatted draft (email → SMS: shorter, no sign-off; SMS → email: expanded, add greeting + sign-off).
**Drift check:** yes (still client-facing).

---

## 14. UI surfaces

### 14.1 Profile summary tile

Located on the contact profile page (owned by Client Management spec). Two-part layout:

**Left / main area:** the `conversation_summary` narrative paragraph. Flat factual, 2–4 sentences.

**Right / sidebar strip:** structured facts computed on read:
- Last contact: relative time ("3 days ago")
- Health: coloured label (`healthy` green / `cooling` amber / `at_risk` orange / `stale` red)
- Open action items: "2 yours, 1 theirs"
- Deal stage: current stage name
- Unsent draft indicator (if applicable)

### 14.2 Action items panel

Below the summary tile. Two groups:
- **"You owe"** — Andy's open items, sorted: overdue first → soonest due → no-date
- **"They owe"** — contact's open items, same sort

Per-item display: description, due date (via `formatTimestamp()`), source indicator.
Per-item actions: Done (checkmark), Dismiss (X), Edit (pencil — inline).
Past items: collapsed toggle at bottom, hidden by default.

Manual "Add action item" button at the bottom of the panel.

### 14.3 Draft drawer

Right-side slide-out drawer, triggered by "Generate draft" / "Generate reply" button. Consistent with Task Manager's drawer pattern.

**Contents:**
- Generated draft in an editable text area
- Channel indicator + one-click switcher
- Nudge field below the draft (subdued by default)
- "Send" button
- "Discard" link
- Loading state while Opus generates (uses existing ambient loading copy from S&D closed list)

**Behaviour:**
- Profile stays visible underneath for reference
- Closing without sending auto-saves (§6.4)
- Reopening restores the unsent draft
- "Generate new" replaces the existing draft

### 14.4 Empty states

When a contact has no summary, no action items, and no messages:
- Summary tile: empty state copy (from S&D ambient closed list, e.g. "nothing here yet. they're a stranger.")
- Action items panel: hidden entirely (no empty list — the panel appears only when items exist or Andy manually adds one)

### 14.5 Motion spec (added 2026-04-13 Phase 3.5)

Motion is universal — no surface opens or mutates without a spring. All motion uses the locked Framer Motion `houseSpring` preset (`mass:1, stiffness:220, damping:25`) unless noted.

**Summary tile (§14.1):**
- Mount: fade-in 180ms ease-out after data resolves. No slide.
- Regeneration: soft 300ms crossfade between old and new content (content is opaque flat-factual, so a slide would feel theatrical).
- Loading shimmer: locked `SkeletonTile` primitive pulse (design system §9).
- Section expand/collapse within tile: `houseSpring` height animation.

**Action items panel (§14.2):**
- Mount: staggered item fade + 8px rise, 40ms per-item stagger, houseSpring.
- Item status change (open → done): item crossfades to struck-through + 100ms fade-down-out after 600ms settle.
- Manual "Add action item" opens an inline input that height-animates in with houseSpring.

**Draft drawer (§14.3) — Tier 2 moment (claims 1 of this spec's Tier 2 budget):**
- Open: slide-from-right 340ms houseSpring, overlay dim fades to 40% opacity in parallel.
- Close: slide-to-right 280ms houseSpring, overlay fades out 200ms.
- Generate-draft loading: the draft text area pulses with a subtle warm-tint wash while Opus streams; streamed tokens fade-in per chunk (100ms houseSpring, no slide) so reading feels live.
- Generate-new (replacement): old draft content crossfades to new over 240ms; text area height settles with houseSpring if length changes.
- Nudge resubmission: nudge field collapses + draft text area pulses warm-tint while regenerating.

**Unsent-draft indicator (§6.4):**
- On profile page mount, if an unsent draft exists, the "Generate draft" CTA shows a pulse dot in the top-right corner that breathes at 2.4s cycle (opacity 0.4 → 1 → 0.4, houseSpring eased). The pulse uses `--brand-pink` at 60% alpha — one of the few justified pink uses on admin surfaces (unsent-draft is an active customer-warmth reminder).
- Pulse stops once drawer is opened OR draft is discarded.

**Reduced-motion:** all houseSprings drop to 0.01s linear crossfades; pulse indicator becomes a static dot at full opacity. Feature stays usable.

---

## 15. Cost architecture

### 15.1 Per-action token caps

| Call type | Model | Input cap | Estimated cost per call |
|-----------|-------|-----------|------------------------|
| Summary regeneration | Haiku | ~4k tokens | ~$0.001 |
| Action item extraction | Haiku | ~2k tokens | ~$0.0005 |
| Draft generation | Opus | ~8k tokens | ~$0.12 |
| Draft nudge | Opus | ~10k tokens | ~$0.15 |
| Draft reformat | Haiku | ~2k tokens | ~$0.0005 |

If assembled context exceeds the cap, truncation is applied: oldest messages dropped first, structured metadata preserved.

### 15.2 Usage logging

Every Claude call logs to `llm_usage_log`: timestamp, call type, contact ID, model, input tokens, output tokens. Admin Settings page shows daily/weekly/monthly spend dashboard.

No hard kill-switch in v1. At current scale (dozens of contacts), monthly spend is well under $100. If costs spike, Andy sees it and investigates. Adding a budget ceiling later is a one-line change.

### 15.3 Scale projection

At 50 active contacts with ~5 messages/day average:
- Summary regenerations: ~5/day × $0.001 = $0.005/day
- Action item extractions: ~5/day × $0.0005 = $0.0025/day
- Drafts: ~5–10/day × $0.12 = $0.60–1.20/day
- **Monthly estimate: $20–40**

Scales linearly with activity. Part of the Autonomy Protocol (Phase 4) token-budget monitoring.

---

## 16. Voice & delight treatment

### 16.1 Ambient voice

The Context Engine's surfaces are working tools. The summary is deliberately flat factual (Q18). The action items panel is a task list. The draft drawer is focused on output.

Existing S&D ambient closed-list slots that apply:
- **Empty states** — summary tile and action items when a contact has no history
- **Loading copy** — while a draft is generating (Opus takes a few seconds)

No new ambient surface categories introduced.

### 16.2 Sprinkle bank

No items claimed from `docs/candidates/sprinkle-bank.md`. The working-tool posture of these surfaces conflicts with decorative voice.

### 16.3 Hidden eggs

None on these surfaces. Draft generation, action item management, and profile review are "Andy is trying to get work done" moments. S&D suppression rules (mid-task, first session, active workflow) would gate eggs here regardless.

---

## 17. Cross-spec flags

### 17.1 Client Management (#8)
- Profile page embeds the summary tile (§14.1), action items panel (§14.2), and draft drawer trigger (§14.3).
- Profile page renders `private_notes` alongside `activity_log` in a unified timeline with lock icon indicator.
- Client Management owns the page — including the browser tab title.
- "Visible to AI" toggle on note-writing UI.

### 17.2 Lead Generation (LOCKED)
- "Generate email" button calls `generateDraft(contactId)` with cold-prospect fallback (§6.5).
- Enrichment data (company website, industry, Meta ad activity) feeds the cold draft prompt.

### 17.3 Daily Cockpit (#12)
- Consumes `getSignalsForAllContacts()` for morning brief aggregation.
- Consumes `getActionItems(*, { owner: 'you', status: 'open' })` for Andy's cross-contact action item view.
- Health labels (`at_risk`, `stale`) surface as attention signals.
- Unsent drafts older than 48 hours optionally surfaced as low-priority signal (Cockpit spec decides).

### 17.4 Sales Pipeline (LOCKED)
- Card hover surfaces `getContextSummary(contactId)` as primary text.
- `contacts` table gains `preferred_channel` column.

### 17.5 Unified Inbox (#11)
- Must provide a `messages` table fulfilling the abstract schema in §10.1.
- Inbound message webhook must enqueue `context_action_item_extract` and (if not deduplicated) `context_summary_regenerate` tasks.

### 17.6 Quote Builder (LOCKED)
- Quote acceptance/expiry/send events are in the material event list (signals-only — no Claude call, no summary regeneration).

### 17.7 Branded Invoicing (LOCKED)
- Invoice sent/paid/overdue events are in the material event list (signals-only).

### 17.8 Brand DNA Assessment (LOCKED)
- Profile completion/retake events are in the material event list (signals-only).
- Profile is a required input for draft prompts (tiered injection: full for Opus, tags for Haiku).

### 17.9 Task Manager (LOCKED)
- Deliverable status changes are in the material event list (signals-only).
- Action items and Task Manager tasks are separate tables — action items are auto-extracted conversational commitments, tasks are operational work items. No overlap.

### 17.10 Onboarding + Segmentation (LOCKED)
- Welcome email reads Context Engine summary as prompt input (via `getContextSummary()`).

### 17.11 Content Engine (#10)
- Blog generation prompts can read Context Engine signals aggregated across all active clients for "topics currently relevant to our client base."

### 17.12 Surprise & Delight (LOCKED)
- Hidden-egg suppression applies on the draft drawer and action items panel (§16.3).

### 17.13 `activity_log.kind` gains 11 values
- `context_summary_regenerated`
- `action_item_extracted`
- `action_item_manual_created`
- `action_item_completed`
- `action_item_dismissed`
- `action_item_edited`
- `draft_generated`
- `draft_nudged`
- `draft_sent`
- `draft_discarded`
- `draft_channel_switched`

### 17.14 `scheduled_tasks.task_type` gains 2 values
- `context_summary_regenerate`
- `context_action_item_extract`

### 17.15 Foundations
- All draft sends route through `sendEmail()` with `classification: 'transactional'` (these are direct replies, not outreach).
- All generated drafts pass through the brand-voice drift check (§11.5).
- All mutations logged via `logActivity()` (§11.1).
- All timestamps via `formatTimestamp()` (§11.3).

---

## 18. Content mini-session scope

Minimal — most output is generated at runtime. Content session produces:

- Extraction prompt calibration: test against ~10 real email samples covering edge cases (vague commitments, shared ownership, no commitments, rapid back-and-forth)
- Summary prompt calibration: test against contacts at various history depths (1 message, 10 messages, 50+ messages)
- Draft prompt calibration: test cold prospect, warm prospect, active client, and cooling client scenarios
- Empty state copy for summary tile and action items panel
- Loading copy for draft generation wait state

Can fold into another spec's content mini-session — this is prompt tuning, not creative copy.

---

## 19. Open questions

### 19.1 Cross-contact action item view
The Cockpit will aggregate action items across all contacts. Whether that's a dedicated "My action items" page or integrated into the cockpit's column layout is a Cockpit spec decision. The engine provides the data via `getActionItems()` with appropriate filters.

### 19.2 Action item deduplication across messages
If a client says "I'll send the brief by Tuesday" in one email and "just confirming — brief coming Tuesday" in a follow-up, the extraction prompt may create two identical action items. Mitigation: the extraction prompt receives existing open action items for the contact and is instructed to skip duplicates. Adds ~200 tokens to the extraction input. Decide during content mini-session prompt calibration.

### 19.3 Thread detection for "last 3 messages"
The draft prompt needs the last 3 messages in the *thread* (not the last 3 messages with the contact globally). This depends on the Unified Inbox's `thread_id` implementation. If threading isn't available, fall back to last 3 messages by `sent_at` with the same contact.

---

## 20. Risks

1. **Action item false positive rate.** If too high, Andy stops trusting the panel. Calibration during content mini-session is critical. The dismiss button is the safety valve.
2. **Summary staleness perception.** Background regeneration means a few seconds of stale summary after material events. In practice invisible, but could erode trust if Andy notices even once. Mitigation: the summary tile could show "updated 3 seconds ago" in tiny text — decide during build.
3. **Draft voice quality.** Downstream of Brand DNA profile quality. If SuperBad's own Brand DNA isn't well-calibrated (the Phase 5 milestone), cold prospect drafts inherit the miscalibration. Mitigated by the drift check.
4. **Prompt size growth over time.** Active clients accumulate long histories. The compose-at-read approach with token caps and intelligent truncation (oldest first) handles this, but the summary prompt may need periodic refinement if truncation produces incoherent summaries.
5. **Private notes table discipline.** The physical separation is strong, but only as strong as the code review culture. A careless import could breach the boundary. Build-time discipline #30 (below) makes this a build-plan review checklist item.

---

## 21. Build-time disciplines

Additions to the Foundations build-time disciplines list:

30. **No `import` from `lib/private-notes/` inside `lib/context-engine/`.** The physical separation is the privacy guarantee. Any such import in a PR is an automatic rejection. Enforced at code review; a breach found in Phase 5 spawns an immediate fix.
31. **Every feature that writes a material event must verify it's in the event list (§4.2).** If a new feature introduces a state change that should trigger regeneration, the event list is updated explicitly — not silently missed. Build-plan review checklist item.
32. **`assembleContext()` is the only path to Claude for contact context.** No feature may query source tables directly and pass them to a Claude prompt for contact-related output. All context assembly routes through the single function. Prevents privacy boundary bypasses and ensures consistent context composition.
33. **Draft prompts always read both Brand DNA and Context Engine summary.** A draft prompt that reads only one context is a code-review rejection. See `project_two_perpetual_contexts` memory.

---

## 22. Reality check

### Hardest parts

1. **The action item extraction prompt.** Distinguishing real commitments from conversational filler, assigning correct ownership, and inferring due dates from vague language — all in a single Haiku call per message. This prompt makes or breaks trust in the engine. Content mini-session must test exhaustively.
2. **The "no recap" draft instruction.** Getting Opus to write a reply that sounds like a natural continuation of the conversation — informed by deep context but never narrating it — is a prompt engineering challenge. The layered architecture (context in system, reply targets latest message) is the structural answer, but the exact wording needs calibration.
3. **Module boundary enforcement for private notes.** Not technically hard, but culturally load-bearing. One careless import and the privacy guarantee is broken. Must be a code review discipline from day one.

### What could go wrong

- Action items panel becomes noisy with false positives → Andy ignores it → layer goes unused → value collapses. Mitigation: aggressive prompt calibration + easy dismiss.
- Summary reads as machine-generated for thin-history contacts → undermines trust. Mitigation: flat factual voice is designed to be unsurprising; thin input = short summary, not padded output.
- Draft recapping despite the prompt instruction → Andy has to manually delete recap paragraphs every time. Mitigation: explicit anti-recap instruction + calibration during content session.

### Is this doable

Yes. The engine is architecturally simple — compose at read time, cache the output, background regeneration, typed function exports. No new infrastructure patterns. The complexity is in prompt quality, which is a calibration problem solved during the content mini-session. Three Phase 5 build sessions, sequential, no parallelism.

---

## 23. Phase 5 sizing

3 sessions:

- **Session A:** Data model (`context_summaries`, `action_items`, `private_notes`, `llm_usage_log`, `preferred_channel` column on contacts) + `assembleContext()` + `computeHealthScore()` + signal computation functions + scheduled task handler registration + module boundary setup.
- **Session B:** Summary regeneration prompt + action item extraction prompt + background task pipeline + deduplication logic + usage logging + event-to-section mapping.
- **Session C:** Draft drawer UI + draft generation/nudge/reformat prompts + channel switcher + action items panel + profile summary tile + empty states + loading states + unsent draft persistence.

A before B. B before C. No parallelism — each layer depends on the previous.

---

**End of spec.**

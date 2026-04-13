# Phase 3 — Client Context Engine — Handoff Note

**Date:** 2026-04-12
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/client-context-engine.md`
**Status:** Locked, 31 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for the Client Context Engine — the "where you are in the conversation" companion to Brand DNA's "who they are at their core." 31 questions asked, all locked. Five structural decisions were pre-locked from the 2026-04-12 mini-brainstorm (see `sessions/phase-3-context-engine-scope-patch-handoff.md`).

One mid-brainstorm redirect from Andy:

1. **Q7 — Draft prompt composition.** Andy flagged that the proposed approach (cached summary + recent messages in the prompt) risked producing drafts that constantly recap the conversation history instead of naturally replying to the latest message. This led to a key prompt architecture decision: context goes into the **system instructions** as silent background knowledge, and the **reply target** is only the latest message. Claude knows everything but doesn't narrate it. Locked as a structural constraint on all draft prompts.

No other corrections needed — Andy accepted recommendations on all other questions.

**Spec structure (23 sections):**
1. The 31 locks (quick-reference table)
2. Architecture overview (two perpetual contexts, single primitive, compose at read time, engine posture)
3. Context assembly (`assembleContext()` function, data sources, purpose variants)
4. Summary system (sectioned cache, material event list, background regeneration, voice)
5. Action items (auto-extraction, manual add, display, lifecycle)
6. Draft system (prompt architecture, nudge field, channel handling, unsent persistence, cold fallback, drift check)
7. Privacy boundary (separate table, "visible to AI" toggle, module enforcement)
8. Health score (rule-based, four labels, input factors)
9. Signal emissions for Daily Cockpit (fixed signal set, access functions)
10. Dependencies (Unified Inbox abstract reference, Brand DNA, Sales Pipeline, scheduled_tasks)
11. Integration API surface (exported function library, consuming specs)
12. Data model (4 new tables + 1 new column)
13. Claude prompts (5 prompts: 3 Haiku + 2 Opus)
14. UI surfaces (profile tile, action items panel, draft drawer, empty states)
15. Cost architecture (per-action caps, usage logging, scale projection)
16. Voice & delight treatment
17. Cross-spec flags
18. Content mini-session scope
19. Open questions
20. Risks
21. Build-time disciplines (30–33)
22. Reality check
23. Phase 5 sizing

---

## 2. Key decisions summary

- **Compose at read time.** No dedicated `context_events` table. Engine queries source tables directly when assembling context. Summary output cached, but raw context always fresh. No dual-write obligation on other features.
- **Sectioned summary cache.** Narrative paragraph (Haiku-generated), signals (computed on read — no storage), draft fields (inline on same row). Each regenerates independently.
- **Explicit closed material event list.** New messages trigger extraction + summary. Stage/action-item changes trigger summary only. Invoices/quotes/deliverables/Brand DNA trigger signals only (no Claude call).
- **Dedicated `action_items` table.** Ownership via message direction (`you` / `them`), ambiguous defaults to `you`. Soft status (dismissed items preserved). Source provenance back to originating message.
- **Rule-based health score.** Four labels (`healthy` / `cooling` / `at_risk` / `stale`), computed from days-since-contact + overdue items + deal velocity + invoice age. No Claude call. Deterministic, cheap, explainable.
- **Background regeneration via scheduled_tasks.** Deduplication at enqueue time — skip if pending task exists for same contact. Extraction tasks processed before summary tasks.
- **Draft prompt: context as silent system knowledge.** Summary, Brand DNA, action items, deal state go into the system prompt. Reply targets only the latest message (or last 3 in thread). Explicit anti-recap instruction. Context shapes what to say; the reply reads like a human who happens to know everything.
- **Separate `private_notes` table with no engine import path.** Physical module boundary. "Visible to AI" toggle on note-writing UI (default on). Profile UI renders both tables in one timeline with lock icon on private notes.
- **Right-side draft drawer.** Consistent with Task Manager's drawer pattern. Auto-saves unsent drafts (one per contact). Nudge field reuses Content Engine's rejection-chat primitive.
- **Exported function library in `lib/context-engine/`.** No API routes for inter-feature calls. Typed imports. Server Actions for UI calls.
- **Per-action token caps + usage logging.** No hard kill-switch in v1. Monthly cost estimated at $20–40 at current scale.
- **Flat factual summary voice.** Working tool, not personality surface. Exempt from drift check.

---

## 3. No new memories

No new principles surfaced. The spec applied existing memories (`project_two_perpetual_contexts`, `project_brand_dna_as_perpetual_context`, `feedback_individual_feel`, `feedback_no_content_authoring`, `feedback_no_lite_on_client_facing`) without needing new ones.

---

## 4. Sprinkle bank updates

No items claimed. The engine's surfaces are working tools — flat factual summary, task-list-style action items, draft-focused drawer. Existing S&D ambient slots (empty states, loading copy) apply automatically. No sprinkle fit.

---

## 5. Cross-spec flags (consolidated)

### 5.1 Client Management (#8)
- Profile page embeds summary tile, action items panel, draft drawer trigger.
- Profile page renders `private_notes` alongside `activity_log` in unified timeline with lock icon.
- "Visible to AI" toggle on note-writing UI.
- Client Management owns the page and the browser tab title.

### 5.2 Lead Generation (LOCKED)
- "Generate email" button calls `generateDraft(contactId)` with cold-prospect fallback.

### 5.3 Daily Cockpit (#12)
- Consumes `getSignalsForAllContacts()` for morning brief.
- Consumes `getActionItems()` for Andy's cross-contact action item view.
- Health labels surface as attention signals.
- Unsent drafts > 48h optionally surfaced (Cockpit spec decides).

### 5.4 Sales Pipeline (LOCKED)
- Card hover uses `getContextSummary()`.
- `contacts` gains `preferred_channel` column.

### 5.5 Unified Inbox (#11)
- Must provide `messages` table with: `id`, `contact_id`, `direction`, `channel`, `subject`, `body`, `thread_id`, `sent_at`, `created_at`.
- Inbound message webhook must enqueue extraction + regeneration tasks.

### 5.6 Quote Builder (LOCKED)
- Quote events (sent/accepted/expired) in signals-only event list.

### 5.7 Branded Invoicing (LOCKED)
- Invoice events (sent/paid/overdue) in signals-only event list.

### 5.8 Brand DNA Assessment (LOCKED)
- Profile completion/retake in signals-only event list.
- Profile is required input for draft prompts (tiered injection).

### 5.9 Task Manager (LOCKED)
- Deliverable status changes in signals-only event list.
- Action items and tasks are separate tables with no overlap.

### 5.10 Onboarding + Segmentation (LOCKED)
- Welcome email reads `getContextSummary()` as prompt input.

### 5.11 Content Engine (#10)
- Blog generation can read aggregated signals for topic relevance.

### 5.12 `activity_log.kind` gains 11 values
- `context_summary_regenerated`, `action_item_extracted`, `action_item_manual_created`, `action_item_completed`, `action_item_dismissed`, `action_item_edited`, `draft_generated`, `draft_nudged`, `draft_sent`, `draft_discarded`, `draft_channel_switched`

### 5.13 `scheduled_tasks.task_type` gains 2 values
- `context_summary_regenerate`, `context_action_item_extract`

---

## 6. New tables

- `context_summaries` — one row per contact, narrative + draft fields, signals computed on read
- `action_items` — per-item with owner/source/status, FK to messages for provenance
- `private_notes` — physically separate from engine module, "visible to AI" toggle
- `llm_usage_log` — token usage tracking per Claude call

New column on `contacts`: `preferred_channel` (enum, default `'email'`).

---

## 7. New build-time disciplines

30. No `import` from `lib/private-notes/` inside `lib/context-engine/`.
31. Every feature writing a material event must verify it's in the event list.
32. `assembleContext()` is the only path to Claude for contact context.
33. Draft prompts always read both Brand DNA and Context Engine summary.

---

## 8. Content mini-session scope

Small — prompt calibration, not creative copy. Can fold into another spec's session:
- Extraction prompt calibration against ~10 real email samples
- Summary prompt calibration at various history depths
- Draft prompt calibration across cold/warm/active/cooling scenarios
- Empty state copy for summary tile and action items panel
- Loading copy for draft generation wait state

---

## 9. Phase 5 sizing

3 sessions, sequential:
- **Session A:** Data model + `assembleContext()` + `computeHealthScore()` + signal functions + scheduled task handlers + module boundary setup
- **Session B:** Summary + extraction prompts + background regeneration pipeline + deduplication + usage logging + event-to-section mapping
- **Session C:** Draft drawer UI + draft generation/nudge/reformat prompts + channel switcher + action items panel + profile summary tile + empty/loading states

A before B. B before C. No parallelism.

---

## 10. What the next session should know

### 10.1 Next recommended spec: Client Management (#8)

The primary consumer of the Context Engine. Profile surfaces embed the summary tile, action items panel, and draft drawer — reference the primitives, don't re-implement. Also covers: client portal (rolled in until/unless split), deliverables tab (references Task Manager — do not fork), billing tab (references Branded Invoicing), one-click data export, Brand DNA completion status, onboarding progress display.

### 10.2 Things easily missed

- **The "no recap" draft constraint is architectural.** If a future spec proposes a draft-generation prompt that puts conversation history in the user section of the prompt (rather than the system section), it will produce recapping drafts. The layered prompt architecture in §6.1 is load-bearing.
- **Action items and tasks are separate tables.** Action items are auto-extracted conversational commitments ("she said she'd send the brief Tuesday"). Tasks are operational work items ("deliver the logo pack"). Both surface on the contact profile, but they're different data with different lifecycles. Client Management must display both — action items from Context Engine, tasks from Task Manager — without conflating them.
- **Private notes timeline integration.** Client Management owns the profile timeline that renders both `activity_log` and `private_notes` with lock icons. The Context Engine doesn't touch this rendering — it just provides the module boundary that keeps private notes out of Claude's context.
- **`preferred_channel` is a new column on `contacts`.** Auto-updates on every send/receive. New contacts default to `email`. Client Management may want to expose a manual override on the contact profile.
- **The engine is a primitive, not a page.** It has no routes of its own. Every UI surface lives inside another spec's pages (Client Management profile, Lead Gen prospect card, Pipeline hover card, Cockpit dashboard).

---

## 11. Backlog state

**Phase 3 spec backlog: 17 total, 10 locked, 7 remaining.**

Locked: Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel, Quote Builder, Branded Invoicing, Surprise & Delight (pre-written), Task Manager, Brand DNA Assessment, Onboarding + Segmentation, **Client Context Engine** (this session).

Next recommended: Client Management (#8).

---

**End of handoff.**

# Call Notes — Feature Spec

**Locked:** 2026-04-27 (Phase 5 addition)
**Reference:** Protraxx Discovery Call HTML (~/Downloads/protraxx-discovery-call.html)

---

## User story

Andy has a sales conversation (phone, video, in-person) with a prospect or client. Before the call, Lite generates a briefing from everything it knows about the deal — company shape, past calls, activity history, enrichment data. During the call, Andy takes structured notes in stage-appropriate sections with "listen for" signals that coach him in real time. After the call, Andy answers 3–4 quick debrief questions, and the platform synthesises a summary with prioritised next actions and a recommended stage transition. Each next step is a one-click action wired to the platform (open quote builder, transition stage, set follow-up snooze).

---

## Three-act flow

### Act 1 — Pre-call prep

LLM-generated briefing displayed before the call begins. Reads:
- Company record (shape, industry, revenue range, team size, location)
- Deal record (stage, value, source, history)
- All past call notes on this deal
- Recent activity log entries (emails, quotes, stage changes)
- Brand DNA profile if one exists
- Enrichment data from lead generation (if sourced via lead-gen)

**Outputs:**
- Situation summary (2–3 sentences)
- Last call recap (if previous calls exist)
- Unresolved items from previous calls
- 3–5 context-specific talking points (pinned above template during live notes)
- 2–3 LLM-generated custom questions injected into the template

### Act 2 — Live structured notes

Full-page note-taking surface at `/lite/admin/deals/[id]/call/[callId]`.

Structure follows the Protraxx pattern, elevated to SuperBad design:
- **Collapsible sections** with numbered headers, progress counts per section
- **Questions** within each section, each with:
  - Checkbox to mark as covered
  - Question text (bold key phrase)
  - "Listen for" signals, colour-coded: green (positive), amber (neutral/probe), red (concern)
  - Free-form notes textarea
- **Global progress bar** — X of Y questions covered
- **LLM talking points** pinned at top (from pre-call prep)
- **LLM custom questions** injected into relevant sections (visually distinct from template questions)
- **Auto-save** on every keystroke/checkbox change (debounced server action)

### Act 3 — Post-call debrief

Triggered when Andy clicks "End Call". Two phases:

**Phase 1 — Quick outcome capture (Andy answers):**
1. Overall temperature: Hot / Warm / Cool / Cold (single-click pill selector)
2. Agreed next step (free text)
3. Follow-up date (date picker)
4. Any blockers or concerns (free text, optional)

**Phase 2 — LLM synthesis (platform generates):**
Reads all in-call notes + debrief answers + deal context. Produces:
- Concise call summary (3–5 sentences)
- Prioritised next actions (each with a one-click action button)
- Recommended stage transition (if warranted)
- Spotted opportunities / risk flags from the notes

**One-click actions on next steps:**
- "Send quote" → navigates to `/lite/admin/deals/[id]/quotes/new`
- "Move to [stage]" → calls `transitionDealAction`
- "Follow up on [date]" → sets `snoozed_until_ms` on the deal
- "Draft follow-up email" → opens unified inbox compose with pre-filled context (v1.1 — for now, navigates to deal detail)

---

## Five stage templates

Each template has 4–6 sections with 2–4 questions per section. Sections are ordered by natural conversation flow.

### 1. Contacted (first response call)
Lightweight qualifying template. 2 sections, 4–5 questions.
- **Section 1: Context & qualification** — How they found you, what triggered the enquiry, basic business overview
- **Section 2: Next step alignment** — What they're looking for, timeline, decision process, agree on next step

### 2. Conversation (discovery call)
Full discovery template modelled on Protraxx reference. 6 sections.
- **Section 1: Rapport & context-setting** — Origin, urgency, business overview
- **Section 2: Goals & success criteria** — 6/12 month goals, priority service, job value, sales cycle
- **Section 3: Current marketing & channels** — Past marketing, social, lead sources, paid ads
- **Section 4: Audience & positioning** — Dream client, competition, objections
- **Section 5: Assets, content & operations** — Media assets, enquiry handling, capacity
- **Section 6: Budget, decision-making & next steps** — Budget, decision-makers, timeline, competitors, lock in follow-up

### 3. Trial Shoot (pre-shoot + post-shoot)
Split into two modes selected at call start:
- **Pre-shoot** (3 sections): Logistics confirmation, expectations & brief recap, what to watch for during the shoot
- **Post-shoot** (3 sections): How it went (their reaction, energy, engagement), deliverables & timeline discussion, retainer angle & next steps

### 4. Quoted (quote follow-up)
4 sections focused on quote reaction and objection handling.
- **Section 1: Quote reception** — Have they reviewed it, first reaction, questions
- **Section 2: Value alignment** — Which elements resonated, which didn't, comparison to other quotes
- **Section 3: Objection handling** — Price, scope, timing, trust objections
- **Section 4: Decision & close** — Decision timeline, other stakeholders, what would make this a yes, lock in next step

### 5. Negotiating (closing call)
3 sections, tight and direct.
- **Section 1: Final objections** — What's still unresolved, what would change their mind
- **Section 2: Terms & logistics** — Payment terms, start date, onboarding expectations
- **Section 3: Close or next step** — Ask for the commitment, handle last-minute hesitation, confirm next action

---

## Ad-hoc notes

A persistent "Add note" button on the deal detail page. Opens a minimal form:
- Note text (required, textarea)
- Temperature update (optional, same hot/warm/cool/cold pills)
- Follow-up date (optional, date picker)

Creates an `adhoc_note_added` activity log entry. The LLM picks up ad-hoc notes in the next pre-call briefing alongside structured call notes.

---

## Temperature tracking

Each call log and ad-hoc note can carry a temperature reading. Displayed as:
- **Per-call badge** on the call history tab (colour-coded pill)
- **Trend line** on the deal detail page (last 5 readings as dots)
- **Alerts**: Two consecutive "cool" or "cold" readings flag the deal on the daily cockpit as "stalling". A jump of 2+ levels in either direction flags as "momentum shift".

---

## Data model

### `call_logs` table

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| deal_id | text FK → deals | cascade delete |
| company_id | text FK → companies | cascade delete |
| contact_id | text FK → contacts | set null |
| stage_at_time | text | Pipeline stage when call was started |
| template_type | text | contacted / conversation / trial_shoot_pre / trial_shoot_post / quoted / negotiating |
| status | text | prep / active / debrief / complete |
| temperature | text | hot / warm / cool / cold (null until debrief) |
| agreed_next_step | text | Free text from debrief |
| follow_up_date_ms | integer | Timestamp from debrief date picker |
| blockers | text | Free text from debrief |
| sections_data | text (JSON) | All section/question state: checkboxes, notes |
| llm_briefing | text (JSON) | Pre-call prep output |
| llm_custom_questions | text (JSON) | Generated questions injected into template |
| llm_synthesis | text (JSON) | Post-call summary, next actions, stage recommendation |
| created_at_ms | integer | Call started |
| updated_at_ms | integer | Last save |
| completed_at_ms | integer | Debrief finished |

### Activity log kinds (new)

- `call_started` — when a new call flow begins
- `call_completed` — when debrief finishes (meta includes temperature, summary)
- `adhoc_note_added` — when an ad-hoc note is added outside a call

---

## LLM jobs

| Job slug | Tier | Purpose |
|----------|------|---------|
| `call-pre-briefing` | opus | Generate situation summary, talking points, unresolved items |
| `call-custom-questions` | haiku | Generate 2–3 deal-specific questions with signals |
| `call-post-synthesis` | opus | Generate call summary, next actions, stage recommendation |

---

## UI description

### Route: `/lite/admin/deals/[id]/call/[callId]`

Full-page experience within the admin shell. Three phases rendered based on `call_logs.status`:

**Prep phase (`status = prep`):**
- Header: deal title, company name, current stage badge, date
- LLM briefing card (situation summary, last call recap, unresolved items, talking points)
- Template preview (collapsed sections showing what the call will cover)
- Primary CTA: "Start Call" → transitions to active phase

**Active phase (`status = active`):**
- Sticky header: deal name, progress bar, timer (elapsed since call started)
- Pinned talking points card (collapsible, from LLM prep)
- Section accordion (Protraxx pattern): numbered sections, collapsible, per-section progress
- Questions with checkboxes, signals, notes areas
- LLM-generated questions visually distinct (subtle accent border)
- Sticky footer: "End Call" button

**Debrief phase (`status = debrief`):**
- Quick capture form: temperature pills, next step text, follow-up date, blockers
- "Generate Summary" CTA → calls LLM synthesis
- Synthesis card: summary, next actions with one-click buttons, stage recommendation, flags
- "Complete" CTA → marks call as complete, navigates back to deal

### Route: `/lite/admin/deals/[id]/call/new`

Template selector + call start. Shows available templates for the deal's current stage. For trial_shoot stage, offers pre-shoot vs post-shoot choice.

### Deal detail page additions

- **Call History tab** — chronological list of completed calls with: date, template type, temperature badge, one-line summary, expand for full notes
- **Ad-hoc Note button** — persistent in the page header area
- **Temperature trend** — last 5 readings as coloured dots near the deal stage badge

### Pipeline board additions

- **"Start Call" quick action** on deal cards (conversation, trial_shoot, quoted, negotiating stages only)

---

## Success criteria

1. Andy can start a call from a deal, see a useful pre-call briefing, take structured notes, and get synthesised next steps — all without leaving the platform
2. The pre-call briefing references specific details from past calls and deal history (not generic)
3. Each pipeline stage has a distinct, stage-appropriate template
4. One-click actions from the debrief successfully trigger platform operations (stage transition, snooze, quote builder navigation)
5. Ad-hoc notes appear in subsequent pre-call briefings
6. Temperature trend is visible on deal detail

## Out of scope

- Voice recording / transcription (v1.1)
- Quick-add from pipeline board or cockpit (v1.1 — component designed for reuse)
- "Draft follow-up email" action (requires unified inbox compose — v1.1)
- Call scheduling / calendar integration
- Template editing UI (templates ship as code; editing is a code change)
- Cockpit integration for temperature alerts (v1.1 — data model supports it from day one)

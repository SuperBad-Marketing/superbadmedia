# Brand Voice Settings

**Status:** locked (2026-04-24)
**Owner:** this spec
**Consumers:** lead-generation (outreach drafts), quote-builder (send emails), branded-invoicing (send emails), future voice-dependent surfaces

---

## User story

Andy opens Settings → Brand Voice and sees a single page with surface-specific sections. At the top, a prominent card links to SuperBad's own Brand DNA assessment (take it or retake it). Below that, expandable sections for each surface where AI generates copy — starting with Outreach. Each section holds an example bank: hand-written reference emails the AI uses as voice anchors when generating copy for that surface. Andy can add, edit, reorder, and delete examples. Future sections (Quote Emails, Portal Chat, etc.) can be added without structural changes.

---

## UI description

### Route: `/lite/admin/settings/brand-voice`

**Header:** Standard admin page chrome — breadcrumb, display heading, narrative tagline.

**Brand DNA card (top):** Full-width card showing SuperBad's current Brand DNA status (complete / not started / in progress). If complete, shows the prose portrait snippet and a "Retake assessment" link. If not started, shows a "Take assessment" CTA. Links to the existing Brand DNA assessment flow for `subject_type = 'superbad_self'`.

**Surface sections (below card):** Collapsible sections, one per surface. Each section:
- Section header with surface name + example count badge
- Example bank: ordered list of examples, each showing title + preview snippet
- Click to expand/edit an example (inline, not modal — keep context)
- Add new example button at bottom of the list
- Drag-to-reorder (or up/down arrows for mouse-first)

**Example fields:**
- Title (short label, e.g. "First touch — café owner")
- Body (the full example email/copy in markdown)
- Surface (auto-set from the section, not user-editable)

**Initial surfaces (v1):**
- `outreach` — cold/warm outreach emails
- *(future: `quote_email`, `portal_chat`, `invoice_email`, etc. — no UI until needed)*

---

## Data model

### Table: `brand_voice_examples`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | UUID |
| `surface` | text NOT NULL | Enum: `outreach`, extensible |
| `title` | text NOT NULL | Short label |
| `body_markdown` | text NOT NULL | The full example content |
| `sort_order` | integer NOT NULL | For manual reordering |
| `created_at_ms` | integer NOT NULL | |
| `updated_at_ms` | integer NOT NULL | |

Index on `surface` + `sort_order`.

---

## Integration points

### Outreach draft generator (`lib/lead-gen/draft-generator.ts`)

`buildSystemPrompt()` currently injects `brandProfile.voiceDescription` and `brandProfile.toneMarkers`. After this build:
- Query `brand_voice_examples` where `surface = 'outreach'` ordered by `sort_order`
- Inject them into the system prompt as a `VOICE EXAMPLES` section
- Each example rendered as: `### {title}\n{body_markdown}`
- If no examples exist, the prompt falls back to the current voice description only (no regression)

### Model registry

No new LLM jobs. Existing `lead-gen-outreach-draft` (Opus) consumes the enriched prompt.

### Settings index page

Add Brand Voice card to the settings index grid at `/lite/admin/settings/page.tsx`.

---

## Success criteria

- Brand Voice appears in Settings index and loads without error
- Brand DNA card shows correct status and links to the assessment
- Examples can be created, edited, reordered, and deleted
- Outreach draft generator includes examples in its system prompt
- Deleting all examples doesn't break draft generation (graceful fallback)

---

## Out of scope

- Voice examples for surfaces other than outreach (added when those surfaces need them)
- AI-generated example suggestions (manual authoring only)
- Voice drift threshold configuration (lives in existing settings)

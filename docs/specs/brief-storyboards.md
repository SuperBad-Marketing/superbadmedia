# Brief Storyboards & Shotlists

> Locked: 2026-04-26. Owner: Andy Robinson.

Auto-generated storyboards and production shotlists for structured briefs. When a structured brief is submitted, the system generates a scene-by-scene visual narrative (storyboard) and a location-grouped production checklist (shotlist). Both live as tabs on the brief detail page with an inline chat panel for AI-assisted revisions.

---

## §1 What This Is

A brief describes *what the client wants*. A storyboard translates that into *what the viewer sees* — scene by scene, with shot types, camera movements, and mood notes. A shotlist regroups those scenes into *what the crew shoots* — ordered by location and setup to minimise rig changes on the day.

Both are internal production tools. Clients never see them.

---

## §2 Generation Trigger

### §2.1 Structured Briefs — Auto-Generate
When a structured brief is submitted (from any source — public, portal, admin), the system kicks off storyboard + shotlist generation as a background job immediately after the brief and auto-task are created.

### §2.2 Lean Briefs — Manual Trigger
Lean briefs have minimal context (description + delivery date). A "Generate storyboard" button appears on the brief detail page with a note: *"Add more detail for better results."* Clicking triggers the same generation flow.

### §2.3 Regeneration
A "Regenerate" button on the storyboard tab wipes the current storyboard, shotlist, and chat history, then re-runs generation from the brief fields. Confirmation required ("This will replace the current storyboard and chat history.").

---

## §3 Surfaces

### §3.1 Brief Detail — Storyboard Tab
New tab on the brief detail page: **Details | Storyboard | Shotlist**

The storyboard tab shows:
- **Status indicator** while generating (progress bar or spinner with "Generating storyboard…")
- **Scene cards** in narrative order once ready. Each card:
  - Scene number (1, 2, 3…)
  - Description — what the viewer sees in this moment
  - Shot type — wide / medium / close-up / detail / aerial / POV
  - Camera movement — static / pan / tilt / track / handheld / crane / drone
  - Audio/dialogue notes — music cues, voiceover, dialogue, ambient sound
  - Estimated duration — seconds
  - Mood/reference note — emotional tone, visual reference, lighting direction
- **Chat panel** on the right side (see §4)

### §3.2 Brief Detail — Shotlist Tab
Same brief detail page, third tab. Shows:
- **Setup groups** — scenes grouped by location + camera rig. Each group:
  - Group header: location name, setup description, equipment notes
  - Ordered list of scenes within this setup (showing scene number, shot type, description)
  - Estimated time for this setup group
- **Total estimated shoot time** at the top
- **Chat panel** on the right side (shared thread with storyboard tab)

### §3.3 Master Briefs Database
The briefs table gains a "Storyboard" status column:
- Empty for briefs with no storyboard
- "Generating" spinner while in progress
- "Ready" green badge when complete
- "Failed" red badge on error

### §3.4 Company Detail — Briefs Tab
Same storyboard status badge visible in the company's briefs list. Click-through goes to the brief detail storyboard tab.

---

## §4 Chat Feedback

### §4.1 Layout
A narrow chat column on the right side of the storyboard and shotlist tabs. Same thread for both tabs — switching tabs doesn't reset the chat.

### §4.2 How It Works
1. Andy types feedback: "make scene 3 more dramatic" or "swap the close-up in scene 5 for a wide" or "the whole thing needs more energy"
2. System sends to LLM (`brief-storyboard-revise`, Opus) with:
   - The current storyboard scenes JSON
   - The current shotlist JSON
   - The original brief fields
   - Full chat history
   - Andy's new message
3. LLM returns updated scenes JSON (only changed scenes, merged into the full set)
4. UI updates the affected scene cards with a brief highlight animation
5. Shotlist auto-regenerates from the updated scenes (re-grouped by location)

### §4.3 Chat History
Stored as a JSON array on the `brief_storyboards` row. Each message:
```json
{ "role": "user" | "assistant", "content": "string", "timestamp_ms": number }
```

Assistant messages include a `changes_summary` field: a one-line description of what changed ("Updated scenes 3 and 5 — more dramatic framing, wider shot on scene 5").

---

## §5 Storyboard Scene Schema

Each scene is a JSON object:
```json
{
  "number": 1,
  "description": "Camera opens on the café exterior at golden hour. A hand-painted sign catches the warm light.",
  "shot_type": "wide",
  "camera_movement": "static",
  "audio_notes": "Ambient street sounds, gentle score begins",
  "duration_seconds": 4,
  "mood_note": "Warm, inviting, establishes place and time of day"
}
```

Shot types: `wide` | `medium` | `close_up` | `detail` | `aerial` | `pov`
Camera movements: `static` | `pan` | `tilt` | `track` | `handheld` | `crane` | `drone`

---

## §6 Shotlist Group Schema

Each setup group is a JSON object:
```json
{
  "group_number": 1,
  "location": "Café exterior — front entrance",
  "setup_description": "Camera on tripod, 35mm, natural light",
  "equipment_notes": "Tripod, 35mm prime, reflector for fill",
  "estimated_minutes": 20,
  "scenes": [
    { "scene_number": 1, "shot_type": "wide", "description": "Exterior establishing shot" },
    { "scene_number": 4, "shot_type": "medium", "description": "Owner walks out, looks up at sign" }
  ]
}
```

---

## §7 Data Model

### §7.1 `brief_storyboards` Table
```
id                  TEXT PK
brief_id            TEXT FK → briefs.id NOT NULL UNIQUE
status              TEXT NOT NULL DEFAULT "generating"
                    -- "generating" | "ready" | "failed"
scenes_json         TEXT (JSON array of scene objects, see §5)
shotlist_json       TEXT (JSON array of setup group objects, see §6)
chat_history_json   TEXT (JSON array of chat messages, see §4.3)
error_message       TEXT (nullable — populated on failure)
generated_at_ms     INTEGER (nullable — set when status → "ready")
created_at_ms       INTEGER NOT NULL
updated_at_ms       INTEGER NOT NULL
```

One storyboard per brief (UNIQUE on `brief_id`). Regeneration replaces the existing row's content.

---

## §8 LLM Integration

### §8.1 Generation
Job slug: `brief-storyboard-generate` (Opus)

Prompt receives:
- All brief fields (description, project title, brief kind, style references, key messages, target audience, deliverables breakdown, location details, talent notes, budget range, additional notes)
- Brand DNA context (SuperBad's production style)
- Instructions: generate a scene-by-scene storyboard as a JSON array, then regroup into a shotlist JSON array

Returns: `{ scenes: Scene[], shotlist: SetupGroup[] }`

### §8.2 Revision
Job slug: `brief-storyboard-revise` (Opus)

Prompt receives:
- Current scenes JSON
- Current shotlist JSON
- Original brief fields
- Full chat history
- New user message

Returns: `{ updated_scenes: Scene[], changes_summary: string }`

The shotlist is re-derived from the updated scenes after each revision (Opus, same call or chained).

### §8.3 Model Registry Entries
```
"brief-storyboard-generate": "opus"
"brief-storyboard-revise": "opus"
```

---

## §9 Generation Flow

1. Structured brief submitted → `submitBrief()` creates brief + auto-task
2. After commit, enqueue `generateStoryboard(briefId)`
3. `generateStoryboard()`:
   a. Insert `brief_storyboards` row with status `"generating"`
   b. Load brief fields from DB
   c. Load Brand DNA context
   d. Call LLM (`brief-storyboard-generate`)
   e. Parse response, validate scene/shotlist JSON
   f. Update row: `scenes_json`, `shotlist_json`, status → `"ready"`, `generated_at_ms`
   g. On error: status → `"failed"`, `error_message` populated
4. Activity log: `"storyboard_generated"` (or `"storyboard_failed"`)

---

## §10 Activity Log Kinds

Add to `ACTIVITY_LOG_KINDS`:
```
"storyboard_generated"
"storyboard_failed"
"storyboard_revised"
"storyboard_regenerated"
```

---

## §11 Cross-Spec Impacts

- **`docs/specs/briefs.md`** — brief detail page gains two new tabs (Storyboard, Shotlist). Structured brief submission triggers storyboard generation.
- **`lib/ai/models.ts`** — two new model registry entries (`brief-storyboard-generate`, `brief-storyboard-revise`).
- **`lib/db/schema/activity-log.ts`** — four new activity log kinds.

---

## §12 Success Criteria

1. Structured brief submission auto-generates a storyboard within 30 seconds
2. Storyboard contains 5–15 scenes with all fields populated
3. Shotlist regroups scenes by location with equipment notes
4. Chat feedback revises specific scenes without regenerating the entire storyboard
5. Chat history persists across page loads
6. Lean briefs show manual "Generate storyboard" button, not auto-generation
7. Regeneration replaces storyboard, shotlist, and chat history after confirmation
8. Failed generation shows error state with retry option
9. Storyboard status badge visible in master briefs database and company briefs tab

---

## §13 Non-Goals

- Client-facing storyboard (internal only — clients see deliverables, not production docs)
- AI-generated storyboard images/thumbnails (text-based scene descriptions only in v1)
- Export to PDF (v1.1 if needed — storyboard lives in-app)
- Storyboard templates or presets (each storyboard is generated fresh from the brief)
- Shotlist scheduling or calendar integration (shoot day logistics are manual in v1)

---

## §14 Build Order

1. Schema: `brief_storyboards` table + migration
2. Model registry: add two job slugs
3. Activity log: add four kinds
4. Generation logic: `lib/briefs/generate-storyboard.ts`
5. Revision logic: `lib/briefs/revise-storyboard.ts`
6. Submission hook: trigger generation after structured brief creation
7. Brief detail UI: storyboard tab + shotlist tab + chat panel
8. Brief list UI: storyboard status badge column
9. Manual trigger: "Generate storyboard" button for lean briefs

---

## §15 Files This Spec References

- `docs/specs/briefs.md`
- `lib/db/schema/briefs.ts`
- `lib/db/schema/activity-log.ts`
- `lib/ai/models.ts`
- `lib/briefs/submit-brief.ts`

# Talking Head Script Studio — Feature Spec

**Brainstormed 2026-04-26. All decisions locked in conversation.**

> **Prompt files:** `lib/ai/prompts/talking-head-scripts.md` — authoritative reference for every Claude prompt in this spec.

Andy films talking head videos from the SuperBad studio — red backdrop, burnt yellow armchair, teleprompter (transparent, camera behind it), A/B cam setup. He's uncomfortable on camera. This feature generates teleprompter-ready scripts, manages filming session batches, and produces edit briefs + publishing metadata for the full pipeline from script to post.

Lives in the Content section as a new tab: **Script Studio**.

---

## 1. Locked decisions

| # | Decision |
|---|----------|
| Q1 | **Formats:** short-form (30–90s, ~100–200 words) and mid-form (2–5 min, ~400–800 words). Selectable per script. |
| Q2 | **Purpose weighting:** heavy on brand personality (A) + authority positioning (B), with occasional soft conversion (C). Not every video sells — most build recognition and trust. |
| Q3 | **Topic strategy:** six content pillars (see §2) supplemented by signal-driven topics from platform activity. Pillars are the backbone; signals are the riffs. |
| Q4 | **Filming cadence:** fortnightly batch. 3–5 scripts per session. Minimises time in the chair. |
| Q5 | **Session pack management:** fully managed with veto. System picks pillar mix, generates scripts, presents the pack. Andy approves or skips each script; skipped ones auto-replace. |
| Q6 | **Energy override:** session-level "low battery" or "feeling it" modifier. Adjusts all scripts — sentence length, pause density, segment size. One decision for the whole batch. |
| Q7 | **Short-form script format:** conversational blocks + inline delivery cues (`[pause]`, `[slower]`). Written for one take. |
| Q8 | **Mid-form script format:** numbered 15–30 second segments, each a self-contained take. B cam cut points marked between segments. Segment joins invisible in edit thanks to A/B cam coverage. |
| Q9 | **Tone:** automatic per pillar, modified by energy level. Each pillar has a locked tone profile. |
| Q10 | **Post-production:** edit brief per script (cut points, B cam switches, text overlays, thumbnail concept) + publishing metadata (caption, hashtags, platform targeting, suggested post time). Pre-filled, one-click queue when edited video lands. |

---

## 2. Content pillars

Six rotating categories. Each has a name, description, tone profile, and purpose weighting.

| # | Pillar | Description | Tone | Purpose |
|---|--------|-------------|------|---------|
| 1 | Things your agency won't say | Industry honesty. Why retainers work the way they do, what agencies actually spend your budget on, why your last campaign didn't work. | Slightly confrontational, measured | Authority |
| 2 | What I see shooting small business | Observations from trial shoots and client work. Patterns only someone behind the camera notices. | Warm, observational | Personality + Authority |
| 3 | Marketing that doesn't work | Specific tactics that are widely recommended and mostly useless. Canva templates, posting three times a day, trying to go viral. | Dry, slightly exasperated | Authority |
| 4 | The uncomfortable truth about [X] | Broader business realities. What marketing actually costs, why cheap photography is expensive, why your mate's nephew can't do your brand. | Direct, occasionally spicy | Authority |
| 5 | If I were [brand] | Unsolicited strategy breakdowns for aspirational clients. Full campaign concepts for real businesses. Demonstrates how Andy thinks without anyone having to pay for it. | Animated, conviction, leaning forward | Authority + Personality |
| 6 | Overheard in marketing | Deadpan observations about the absurdity of the industry and business culture. Not advice — just noticing things. Highly shareable, zero sales pressure. | Bone-dry, almost thrown away | Personality |

Pillar rotation is managed by the system. Session packs vary the mix — no three authority takes in a row. "Overheard in marketing" serves as a palate cleanser between heavier pillars.

---

## 3. Session pack lifecycle

```
Generate → Review → Film → Post-produce → Publish
```

**Generate.** System creates a session pack of 3–5 scripts. Pillar mix is varied. Format mix includes both short and mid-form. Scripts ordered for energy management: start with something easy (Overheard), build to a strategy breakdown, end with something short.

**Review.** Andy sees the pack as a card list. Each script shows: pillar, format, title, opening hook, estimated duration. Actions: approve or skip. Skipped scripts are replaced automatically with a new generation from a different pillar. Energy override ("low battery" / "feeling it") can be set before or during review — changing it regenerates unapproved scripts.

**Film.** Teleprompter mode: full-screen dark display, large text, one block/segment at a time. Manual advance between segments (mid-form) or continuous scroll (short-form). Session pack tracks which scripts have been marked as filmed.

**Post-produce.** Each script has an edit brief: segment cut points (mid-form), B cam switch suggestions, text overlay ideas, caption style, thumbnail concept. This is structured data the editor (or a future automated pipeline) follows.

**Publish.** Publishing metadata pre-filled: caption, hashtags, platform targeting (Instagram Reels, TikTok, YouTube Shorts, LinkedIn), suggested post time. When the edited video file lands, it's one click to queue.

---

## 4. Script structure

### 4.1 Short-form script

Written for one take. Conversational blocks with inline delivery cues.

```json
{
  "format": "short",
  "pillar": "marketing_that_doesnt_work",
  "title": "Stop posting three times a day",
  "hook": "Every marketing guru tells you to post three times a day. They're wrong.",
  "estimated_duration_sec": 55,
  "blocks": [
    { "text": "Every marketing guru tells you to post three times a day.", "cue": null },
    { "text": "They're wrong.", "cue": "pause" },
    { "text": "Here's what actually happens when you do that.", "cue": null },
    { "text": "Your audience sees the first post. Maybe.", "cue": null },
    { "text": "The second one? Algorithm buries it because you just posted.", "cue": "slower" },
    { "text": "Third one? You're talking to yourself.", "cue": "pause" },
    { "text": "Post once. Make it count. Move on.", "cue": null }
  ]
}
```

Delivery cues: `pause` (1–2 second breath), `slower` (reduce pace for emphasis), `land it` (final line, let it sit).

### 4.2 Mid-form script

Numbered segments, each 15–30 seconds. Filmed as individual takes.

```json
{
  "format": "mid",
  "pillar": "if_i_were_brand",
  "title": "If I were LSKD",
  "hook": "LSKD doesn't need Instagram ads. They need a show.",
  "estimated_duration_sec": 195,
  "segments": [
    {
      "number": 1,
      "duration_hint_sec": 25,
      "blocks": [
        { "text": "If I were LSKD, I wouldn't be running Instagram ads.", "cue": null },
        { "text": "I'd be making a show.", "cue": "pause" }
      ],
      "b_cam_after": true
    },
    {
      "number": 2,
      "duration_hint_sec": 30,
      "blocks": [
        { "text": "Get a bunch of athletes together. Rent an Airbnb for a week.", "cue": null },
        { "text": "Film them living, training, cooking, arguing about protein powder.", "cue": null },
        { "text": "That's your content. All of it.", "cue": "slower" }
      ],
      "b_cam_after": false
    }
  ]
}
```

`b_cam_after` marks where the editor should cut to B cam between segments.

---

## 5. Edit brief

Generated alongside each script. Structured data for the editor.

```json
{
  "cut_style": "clean",
  "b_cam_moments": ["Segment 2 opening wide", "Segment 4 — reaction beat after punchline"],
  "text_overlays": [
    { "segment": 1, "text": "If I were LSKD", "style": "title_card" },
    { "segment": 3, "text": "YouTube → Shorts → Ads", "style": "list_pop" }
  ],
  "thumbnail": {
    "concept": "Andy in armchair, bold text: 'If I were LSKD'",
    "style": "dark_bold"
  },
  "music_note": "No music. Room tone only.",
  "pacing_note": "Let the pauses breathe. Don't cut the silences."
}
```

---

## 6. Publishing metadata

```json
{
  "platforms": ["instagram_reels", "tiktok", "youtube_shorts"],
  "caption": "LSKD doesn't need Instagram ads. They need a show. Here's what I'd build.",
  "hashtags": ["marketing", "lskd", "contentstrategy", "superbad"],
  "suggested_post_time": "2026-05-15T09:00:00+10:00",
  "cross_post_notes": "LinkedIn: longer caption, add the full strategy breakdown. YouTube: use as Short with link to full breakdown in description."
}
```

---

## 7. Signal-driven topics

Supplements the pillar rotation when something timely surfaces. Signal sources:

- **Prospect objection patterns** — same objection appears 3+ times in inbox/pipeline → "The uncomfortable truth about [objection]"
- **Client wins** — a retainer client hits a milestone → "What I see shooting small business" angle
- **Industry trend** — detected via content engine research → "Things your agency won't say" or "Marketing that doesn't work"
- **Inbox question** — a question keeps coming up → any pillar that fits

Signal-driven scripts are tagged as signal-sourced in the session pack so Andy can see why the system suggested them. They follow the same approve/skip flow.

Signal detection is a later enhancement — pillars carry the full load at launch.

---

## 8. Energy modifier

Two levels that adjust script generation:

| Level | Sentence length | Pause density | Segment size (mid) | Tone shift |
|-------|----------------|---------------|-------------------|------------|
| Low battery | Shorter, more fragments | More frequent pauses | Shorter segments (15–20s) | Drier, more thrown-away |
| Feeling it | Normal range, room to riff | Natural pauses | Full segments (20–30s) | More animated, conviction |

Default when no override is set: halfway between the two.

---

## 9. Data model

### `talking_head_scripts`

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | ulid |
| session_pack_id | text | FK to session pack |
| pillar_slug | text | One of the six pillar slugs |
| format | text | `short` or `mid` |
| status | text | `generated` → `approved` → `filmed` → `published`; or `skipped` |
| title | text | Script title |
| hook | text | Opening line / hook |
| estimated_duration_sec | integer | |
| script_json | text (json) | Blocks (short) or segments (mid) per §4 |
| edit_brief_json | text (json) | Per §5 |
| publish_meta_json | text (json) | Per §6 |
| energy_level | text | `low_battery`, `feeling_it`, or `default` |
| signal_source | text | null for pillar-driven, description for signal-driven |
| sort_order | integer | Position in session pack |
| created_at_ms | integer | |
| updated_at_ms | integer | |

### `talking_head_session_packs`

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | ulid |
| status | text | `draft` → `ready` → `filming` → `completed` |
| energy_level | text | Session-level override |
| target_date | text | ISO date for the filming session |
| script_count | integer | Target number of scripts (3–5) |
| created_at_ms | integer | |
| updated_at_ms | integer | |

---

## 10. LLM jobs

| Job slug | Tier | Purpose |
|----------|------|---------|
| `talking-head-generate-script` | Opus | Generate a single script from pillar + format + energy level. Brand DNA as system context. |
| `talking-head-generate-edit-brief` | Haiku | Generate edit brief from completed script. |
| `talking-head-generate-publish-meta` | Haiku | Generate publishing metadata from script + edit brief. |

---

## 11. UI

### 11.1 Script Studio tab

New tab in `/lite/content/script-studio`. Content section tab bar entry: "Script Studio".

### 11.2 Session pack view (default)

Shows the current or most recent session pack. If no pack exists, shows a "Generate Session Pack" action.

- Energy selector at top (toggle between low battery / default / feeling it)
- Card per script: pillar badge, format badge (short/mid), title, hook preview, estimated duration
- Approve / Skip actions per card
- Progress indicator: X of Y approved
- When all scripts approved → "Ready to film" state with link to teleprompter mode

### 11.3 Teleprompter mode

Full-screen overlay. Dark background, large cream text, centred.

- Short-form: continuous scroll, all blocks visible, delivery cues highlighted in brand orange
- Mid-form: one segment at a time, manual advance (click or spacebar), segment counter
- Exit button returns to session pack view
- Marks script as "filmed" on exit

### 11.4 Script detail

Expandable from the session pack card. Three tabs:

- **Script** — full formatted script as it appears on the teleprompter
- **Edit brief** — structured edit notes, B cam markers, overlay suggestions, thumbnail
- **Publish** — caption, hashtags, platforms, suggested time

### 11.5 History

Past session packs as a simple list. Click to expand and review old scripts.

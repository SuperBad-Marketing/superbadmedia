---
spec: docs/specs/talking-head-scripts.md
status: active
populated-by: Talking Head brainstorm 2026-04-26
---

# Talking Head Script prompts

## `talking-head-generate-script`
**Tier:** Opus. **Intent:** generate a single teleprompter-ready script for a talking head video. **Input:** pillar definition (slug, label, description, tone) + format (short/mid) + energy level + Brand DNA as system context. **Output:** JSON with title, hook, estimated_duration_sec, and script content (blocks for short-form, segments for mid-form). Each block has text + optional delivery cue. Each segment has number, duration_hint_sec, blocks, and b_cam_after flag.

Voice rules: dry, observational, self-deprecating, slow burn. Written the way Andy talks — contractions, fragments, trailing thoughts. Never sounds like a marketing AI writing "authentic content." Never explains the joke. Short sentences. Leave room for the mutter.

Energy modifier:
- `low_battery`: shorter sentences, more fragments, more frequent pauses, drier delivery, shorter segments (15–20s for mid-form)
- `default`: balanced
- `feeling_it`: more range, room to riff, longer segments (20–30s for mid-form), more conviction

## `talking-head-generate-edit-brief`
**Tier:** Haiku. **Intent:** generate structured edit brief from a completed script. **Input:** script JSON + format. **Output:** JSON with cut_style, b_cam_moments, text_overlays, thumbnail concept, music_note, pacing_note.

## `talking-head-generate-publish-meta`
**Tier:** Haiku. **Intent:** generate publishing metadata from script + edit brief. **Input:** script JSON + edit brief JSON. **Output:** JSON with platforms, caption, hashtags, suggested_post_time, cross_post_notes.

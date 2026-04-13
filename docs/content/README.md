# `docs/content/` — content-authoring output

Every content-authoring mini-session (Intro Funnel copy, Quote Builder emails, Brand DNA prompts, Daily Cockpit brief templates, etc.) commits its output **here** — not into its handoff note.

## Convention

- One file per spec: `docs/content/<spec-name>.md` (e.g. `docs/content/intro-funnel.md`).
- For specs with very large content payloads (e.g. Brand DNA's 30 question banks), use a subfolder: `docs/content/brand-dna/<section>.md`.
- Each file is self-contained. It can be loaded into a Phase 5 build session alongside the spec with no handoff context required.
- Handoff notes are supplementary summaries, not authoritative content.

## Spec cross-reference

Every spec whose copy / prompts / visuals come from a content mini-session has a **"Content source"** heading near the top of the spec pointing at its file(s) here. Phase 3.5 step 3a installs the cross-reference as content lands; Phase 5 build sessions read spec + referenced content file together.

## Status

Convention established 2026-04-13 (Phase 3.5 step 3a batch A). No content mini-sessions have landed at this date — nothing to re-home. First mini-sessions (Intro Funnel copy, Quote Builder emails, Daily Cockpit briefs) run before their respective Phase 5 build sessions.

## LLM prompts are different

Prompt text does NOT live here — prompts live at `lib/ai/prompts/<prompt-name>.md` (prose) or `.ts` (once Phase 4 foundation scaffolding lands). Specs reference those files by path. See Phase 3.5 step 3b.

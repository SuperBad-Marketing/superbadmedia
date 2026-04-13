---
spec: docs/specs/lead-generation.md
status: stub
populated-by: (composed system prompt — spec has strong scaffolding; refinement in content authoring)
---

# Lead Generation prompts

## `lead-gen-outreach-draft`
**Tier:** Opus. **Intent:** draft a per-prospect outreach email end-to-end (no templated copy; see memory `feedback_outreach_never_templated.md`). **System prompt** composes: SuperBad Brand DNA profile + SuperBad business context + viabilityProfile (structured JSON) + prior touches (thread context). **Output:** subject + body, no placeholder variants. **Hard rules:** include Spam Act footer; no invented facts; post-generation sanity check flags hallucinated specifics. Drift-checked. **Current inline location:** spec §8.2.

The system-prompt scaffolding file is eventually at `lib/ai/prompts/lead-gen-outreach-system.ts`; spec §8.2 currently references `lib/lead-gen/prompts/outreach-system.md` — reconcile at Phase 4 foundation session.

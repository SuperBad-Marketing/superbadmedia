---
spec: docs/specs/finance-dashboard.md
status: stub
populated-by: (single prompt — lives in spec until any content authoring touches it)
---

# Finance Dashboard prompts

## `finance-draft-narrative`
**Tier:** Haiku. **Intent:** draft the finance narrative paragraph above the top-level metrics tile. **Input:** `snapshot_today` + `snapshot_compare` (metrics + projection) + `range_label` + callouts. **Output:** structured JSON `{paragraph_text (3–5 sentences, SuperBad dry voice), number_references (array of {token, value_aud, link_path}), callout_used}`. **Guardrails:** every numeric reference must appear in `number_references`; no forward-looking advice. **Current inline location:** spec §6.

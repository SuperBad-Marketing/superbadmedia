---
spec: docs/specs/cost-usage-observatory.md
status: stub
populated-by: Cost & Usage Observatory content mini-session
---

# Cost & Usage Observatory prompts

## `observatory-diagnose-cost-anomaly`
**Tier:** Opus. **Intent:** diagnose a fired cost anomaly. **Input:** anomaly row + last 100 calls for the implicated job/actor + registry entry snapshot + deploy events (24h window) + prompt-version history. **Output:** structured JSON `{hypothesis, confidence, recommended_action, timeline_markdown}`. **Current inline location:** spec §7.

## `observatory-draft-negative-margin-email`
**Tier:** Opus. **Intent:** two draft emails per recommendation card — option 1 "cap conversation", option 2 "renegotiate". Reads Brand DNA + Client Context for the recipient. Drift-checked. **Current inline location:** spec §7.

## `observatory-draft-weekly-digest`
**Tier:** Haiku. **Intent:** Sunday evening email digest. Template-heavy (tier health + top jobs + anomalies + MTD vs projection) with prose glue. Drift-checked. **Current inline location:** spec §7.

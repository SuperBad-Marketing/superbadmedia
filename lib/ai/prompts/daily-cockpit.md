---
spec: docs/specs/daily-cockpit.md
status: stub
populated-by: Daily Cockpit content mini-session
---

# Daily Cockpit prompts

## `cockpit-brief`
**Tier:** Opus. **Intent:** generate brief for slot (morning/midday/evening). **Input:** slot context + SuperBad Brand DNA (perpetual system-role context) + current signals (waiting items, health banners, calendar, pipeline, subscriber count) + slot-specific context (prior prose, event log, tomorrow's context). **Output:** prose + signals snapshot. Routed via LLM model registry. Drift-checked. **Current inline location:** spec §Claude primitives.

Three slot variants (morning / midday / evening) differ by slot-specific context framing + chaining behaviour — see content mini-session for authoritative slot variants + quiet-slot fallback rotation pool.

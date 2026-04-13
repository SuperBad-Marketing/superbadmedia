---
spec: docs/specs/task-manager.md
status: stub
populated-by: (Phase 5 calibration session builds the 30-item fixture suite)
---

# Task Manager prompts

## `task-manager-parse-braindump`
**Tier:** Haiku. **Intent:** parse freeform braindump text into structured tasks. **Input:** raw text + surfaceContext (if provided) + recent contacts/companies/clients + today's date + timezone + SuperBad Brand DNA. **Output:** `ParsedBraindump { tasks[], global_confidence }`. Per-task fields: title, body, kind, priority, due_at_iso, entity_candidates[], checklist, confidence scores. Cached on `braindumps` row. **Calibration:** Phase 5 builds a 30-item fixture suite. **Current inline location:** spec §Claude primitives.

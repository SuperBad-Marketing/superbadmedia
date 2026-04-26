---
spec: docs/specs/task-manager.md
status: stub
populated-by: (Phase 5 calibration session builds the 30-item fixture suite)
---

# Task Manager prompts

## `braindump-parse`
**Tier:** Sonnet. **Intent:** parse freeform braindump text into structured tasks, content ideas (→ Content Studio), and script ideas (→ Script Studio). **Input:** raw text + surfaceContext (if provided) + recent contacts/companies/clients + today's date + timezone + SuperBad Brand DNA + content type definitions + pillar/format definitions. **Output:** `ParsedBraindump { tasks[], content_ideas[], script_ideas[], global_confidence }`. Per-task fields: title, body, kind, priority, due_at_iso, entity_candidates[], checklist, confidence scores. Per-content-idea: brief, content_type, slide_count, confidence. Per-script-idea: topic, pillar, format, angle, confidence. Cached on `braindumps` row. **Calibration:** Phase 5 builds a 30-item fixture suite. **Current inline location:** `lib/ai/parse-braindump.ts`.

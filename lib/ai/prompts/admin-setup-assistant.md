---
spec: docs/specs/setup-wizards.md
status: calibrated
populated-by: CMS-2 content mini-session (2026-04-17)
content-source: docs/content/setup-wizards/admin-setup-assistant-prompt.md
---

# Admin Setup Assistant prompt

**Tier:** Opus. **Registry slug:** `admin-setup-assistant`. **Actor:** `internal`.

Read-only diagnostic chat for Andy when stuck during admin wizard setup. Opens after two consecutive step failures. Thread persists in `admin_support_threads` table.

Full system prompt, calibration scenarios (7 synthetic failures), and thread behaviour rules live in `docs/content/setup-wizards/admin-setup-assistant-prompt.md`.

**Key constraints:**
- Read-only in v1 — explain, don't execute
- Dry, factual tone — Andy wants answers, not company
- Three-section response format: What went wrong / What to try / If that doesn't work
- No preamble, no sign-off
- Link to vendor docs, don't summarise them

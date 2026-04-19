# `PM-7` — LG Queue Edit/Nudge Buttons — Handoff

**Closed:** 2026-04-19
**Type:** UI (small)
**Model tier:** Sonnet

---

## What was done

Added inline draft editing and nudge-chat sidecar to the lead-gen approval queue at `/lite/admin/lead-gen`.

### Edit button

- Clicking "Edit" expands subject + body textareas inline, hides other action buttons (Edit/Nudge/Approve), keeps Reject visible
- "Save edits" calls `updateDraftAction` which runs `classifyEdit` (from `lib/lead-gen/classify-edit.ts`) against original vs submitted
- Clean edits (no change) are no-ops; minor/material edits persist and pre-set `approval_kind` on the draft row
- "Cancel" reverts to original values without persisting

### Nudge button

- Clicking "Nudge" opens a right-side sidecar panel (same pattern as inbox refine-sidecar from UI-7)
- Sidecar has: branded header, current draft display, instruction textarea (500 char limit), turn history (6 turn max), "Re-draft" and "Use this" buttons
- "Re-draft" calls `nudgeRewriteAction` — loads SuperBad's brand profile, sends draft + instruction to Opus via `invokeLlmText` (job: `lead-gen-nudge-rewrite`), returns rewritten body
- "Use this" calls `applyNudgeAction` — persists final body + nudge thread JSON to draft row, logs activity

### Approval kind integration

- `approveDraftAction` now respects pre-set `approval_kind` from edits (`minor_edit_manual` / `edited_manual`) instead of always defaulting to `manual`
- `minor_edit_manual` counts as clean for autonomy streak (per spec §18b.2)
- Nudged drafts still classified as `nudged_manual` (non-clean)

### Files created (1)

- `app/lite/admin/lead-gen/_components/nudge-sidecar.tsx`

### Files edited (4)

- `app/lite/admin/lead-gen/_components/queue-list.tsx` — Edit/Nudge buttons, inline edit state, AnimatePresence for sidecar
- `app/lite/admin/lead-gen/actions.ts` — `updateDraftAction`, `nudgeRewriteAction`, `applyNudgeAction`, approval_kind pre-set logic
- `app/lite/admin/lead-gen/page.tsx` — passes `llmEnabled` from kill switches to QueueList
- `lib/ai/models.ts` — registered `lead-gen-nudge-rewrite` job (opus tier)
- `lib/db/schema/activity-log.ts` — added `outreach_draft_edited`, `outreach_draft_nudged` activity kinds

### PATCHES_OWED marked applied (1)

- `lg_7_edit_nudge_buttons`

## Key decisions

1. **Nudge rewrites in-place** (updates existing draft row) rather than creating a new draft row. Matches spec §8.5: "the new draft replaces the old one, the outreach_drafts row is updated."
2. **Edit classification pre-sets approval_kind on save**, not at approve time. The original body is overwritten by the edit, so classification must happen while both versions are available.
3. **Nudge sidecar reuses refine-draft-limits** (500 chars, 6 turns) for consistency across the platform's LLM-rewrite surfaces.

## What the next session should know

- Wave 13c is now complete (PM-1 through PM-7 all closed).
- The nudge rewrite uses a simpler prompt than the full `generateDraft` pipeline — no viability profile, no drift check on the rewrite. If drift checking nudge rewrites becomes important, a follow-up can add it.
- Pre-existing dev DB issue: `resend_warmup_state` table was missing (created manually for testing). Not related to PM-7.

## Verification

- `npx tsc --noEmit` — 0 new errors (pre-existing `.next/types` duplicates only)
- `npm test` — 218 files, 1833 passed, 0 failures
- Browser: Edit button expands inline fields, Cancel collapses, Nudge opens sidecar with correct branding

## Rollback strategy

**Git-revertable.** No schema migration, no data shape change.

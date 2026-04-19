# SWP-5 Handoff — Portal Plan Surface + PDF Render + Prospect Revision Flow

**Date:** 2026-04-20
**Wave:** 15
**Status:** COMPLETE

## What was built

- **Portal plan page** (`app/lite/portal/[token]/plan/page.tsx` + `components/lite/portal/plan-view.tsx`):
  - Replaced placeholder with full plan surface per spec §6
  - Pre-activation state: intro block with copy from content mini-session, 6 expandable read-only week cards, "Start Week 1" button with subtext, "Download as PDF" link, "This doesn't fit my business" revision link
  - Post-activation state: live tracker mode with task check-off (checkbox toggles), day-of-week indicator on current week, completed/total counts on past weeks, "Opens when Week N wraps" on future weeks
  - Revision reply inline card (regenerate and explain/hand-reject variants) with dismiss
  - One-revision enforcement: revision link replaced with "Email Andy" mailto after first revision

- **Portal plan data layer** (`lib/six-week-plan/portal-queries.ts`):
  - `getPlanForPortal(contactId)` — finds approved/released plan via contact → company → deal → six_week_plans chain, loads task progress

- **Portal plan server actions** (`app/lite/portal/[token]/plan/actions.ts`):
  - `activatePlanAction()` — sets activated_at_ms + activation_path, creates task_progress rows
  - `toggleTaskAction()` — toggles completion on a specific task
  - `submitRevisionAction()` — validates min chars (settings key), writes revision_note + revision_requested_at_ms, logs activity
  - `dismissRevisionReplyAction()` — sets revision_reply_dismissed_at_ms

- **PDF rendering** (`lib/six-week-plan/pdf-template.ts` + `lib/six-week-plan/render-plan-pdf.ts` + `app/api/lite/portal/plan/[planId]/pdf/route.ts`):
  - Full PDF template per spec §6.5 + content mini-session F3.b: cover page (SuperBad mark, business name, date, subtitle), content pages with branded footer, closing page with sprinkle line
  - `renderPlanPdf()` with 24h in-memory cache per plan version, cache invalidation on version change
  - API route at `/api/lite/portal/plan/[planId]/pdf` — portal-session-gated, Content-Disposition with spec filename format
  - Activity log on download: `six_week_plan_pdf_downloaded` with generation_version

- **Revision-review admin surface** (`app/lite/six-week-plans/[planId]/revision-review/` + `lib/six-week-plan/revision-actions.ts`):
  - Two-column layout: plan summary (left) + prospect's note + actions (right) per spec §7.2
  - Three actions: "Regenerate with this note" (enqueues regen), "Draft a reply" (Haiku LLM draft), "Write my own reply" (empty textarea)
  - "Send reply" fires `sendEmail()` with `six_week_plan_revision_explained` classification + updates plan revision fields + logs activity
  - Regenerate path enqueues `six_week_plan_generate` with prospect's note injected

- **Extended `getPlanForReview()` query** to include revision fields (revisionNote, revisionResolution, revisionReplySentAtMs, revisionReplyBody)

## New files

- `lib/six-week-plan/portal-queries.ts`
- `lib/six-week-plan/pdf-template.ts`
- `lib/six-week-plan/render-plan-pdf.ts`
- `lib/six-week-plan/revision-actions.ts`
- `components/lite/portal/plan-view.tsx`
- `app/lite/portal/[token]/plan/actions.ts`
- `app/api/lite/portal/plan/[planId]/pdf/route.ts`
- `app/lite/six-week-plans/[planId]/revision-review/page.tsx`
- `app/lite/six-week-plans/[planId]/revision-review/_components/revision-review-shell.tsx`
- `sessions/swp5-handoff.md`

## Edited files

- `app/lite/portal/[token]/plan/page.tsx` — replaced placeholder with real data-driven page
- `lib/six-week-plan/queries.ts` — extended PlanForReview interface + query with revision fields

## Verification

- `npx tsc --noEmit` — zero source errors
- `npx vitest run` — 223 files, 1846 passed, 1 skipped (unchanged)
- Dev server: portal plan page renders for Fitzroy Florist with all 6 weeks expandable, revision modal opens with character counter, revision-review admin page shows plan + note + 3 actions

## Key decisions

- Week cards are always expandable (even pre-activation) per spec §6.1 "read-only accordion" — they just don't have task check-off until activated
- PDF cache uses in-memory Map (not file/DB) — sufficient for v1.0 single-server; invalidates on generation_version change
- PDF uses zero margins and internal padding for full-bleed cover/closing pages
- Revision actions are in a separate file (`revision-actions.ts`) rather than extending the existing `actions.ts` to keep the admin-review and revision-review concerns separate

## Rollback

- Kill-switch gated: `plan_automations_enabled` (from SWP-3) disables generation
- Feature-flag gated: `features.six_week_plan_enabled` (per spec §19)
- No new migrations — tables already existed from SWP-1
- Git-revertable: no data shape changes

## Next session should know

- SWP-6 through SWP-10 remain: retainer migration, non-converter expiry, Stripe webhook, E2E tests, settings audit
- The superseded-PDF notice (§6.5 "Your plan was updated — download the latest version?" prompt modal) is not yet implemented — it requires detecting generation_version mismatch on page load. Could be added to a future SWP session or handled as a patch
- The `motion:plan_reveal` and `motion:plan_activate` Tier-2 choreographies are registered as candidates but not implemented — they use basic Tier-1 house spring for now per design-system-baseline revisit queue
- The PDF render overlay ("Rendering your plan…" spinner) is not implemented client-side — the download link fires a standard browser download. Could be added as a UX polish item
- Dev env note: `referral.milestone_prompt_cooldown_days` settings key was missing from dev.db seed — had to add manually for portal layout to render

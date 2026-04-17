# `ce-4` — Draft generation scheduled-task handler — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (4 of 13)
**Model tier:** Sonnet (as recommended — medium handler wiring)

---

## What was built

The **`content_generate_draft` scheduled-task handler** — tier-paced automatic blog post generation that self-perpetuates across the month.

**Files created:**

- `lib/scheduled-tasks/handlers/content-generate-draft.ts` — Handler: kill-switch gate → monthly cap check → `generateBlogPost(companyId)` → activity log on success → self-re-enqueue at tier-paced interval. Pacing logic: `interval = 30 days / max_posts_per_month`, floored at 12 hours. Cap-reached delay: ~30 days. `ensureContentGenerationEnqueued(companyId)` bootstrap export (1-hour initial delay so keyword research populates queue first).
- `tests/content-engine/ce4-generate-draft-handler.test.ts` — 13 tests: kill-switch exit, payload validation, successful generation + logging, self-re-enqueue on success, self-re-enqueue on soft failures (no_topic, already_generating), monthly cap enforcement + delay, tier pacing (small/large/extreme), bootstrap enqueue.

**Files edited:**

- `lib/scheduled-tasks/handlers/index.ts` — Added `CONTENT_GENERATE_DRAFT_HANDLERS` import + spread.
- `lib/content-engine/index.ts` — Added `ensureContentGenerationEnqueued` barrel export.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Rolling 30-day window for monthly cap.** Uses `created_at_ms >= (now - 30 days)` rather than calendar month boundaries. Simpler, avoids timezone edge cases, close enough for pacing purposes.
2. **Counts in_review + approved + publishing + published toward cap.** Not just published — an in_review draft is still a slot consumed. Prevents over-generation when review is slow.
3. **12-hour minimum interval floor.** Even at very high tier caps (hypothetical 100 posts/month), the handler won't fire more than twice a day. Prevents hammering.
4. **Self-re-enqueues on ALL outcomes, not just success.** `no_topic` (queue empty) or `already_generating` (discipline #47) are temporary conditions. The next run re-checks. Only `kill_switch` causes the next handler invocation to exit silently, but the task still exists for when the switch flips back.
5. **Bootstrap enqueue delays 1 hour.** Gives keyword research (CE-2's handler) time to populate the topic queue after onboarding wizard completion.
6. **Uses `content.max_posts_per_month` settings key for pacing.** Per-company tier override (from SaaS subscription) is a future wire-up when SaaS billing infra is built. Default of 4 (small tier) applies to all companies until then.

## Verification (G0–G12)

- **G0** — CE-3 and CE-2 handoffs read. Spec `content-engine.md` read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `content_generate_draft` in task_type enum, `generateBlogPost()` exists, `blog_posts` table, `content.max_posts_per_month` settings key, `content_automations_enabled` kill switch — all present.
- **G2** — Files match CE-4 scope (handler + bootstrap + tests).
- **G3** — No motion work. Handler-only session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. `DAYS_PER_MONTH=30` and `MIN_INTERVAL_HOURS=12` are pacing constants, not autonomy thresholds.
- **G5** — Context budget held. Small session.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 157 test files / 1217 passed + 1 skipped (+13 new), clean production build, lint 0 errors (58 warnings baseline).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1217 passed. `npm run build` → success. `npm run lint` → 0 errors, 58 warnings.
- **G9** — No UI changes. Handler-only session.
- **G10** — No browser-verifiable surfaces. Handler behaviours exercised by unit tests.
- **G10.5** — N/A (handler session, no UI).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_4_per_company_tier_lookup`** — `content.max_posts_per_month` is used as a global default for all companies. When SaaS subscription tiers are built, the handler should look up the company's subscription tier and derive the cap from that. Low priority until SaaS billing infra lands.
- **`ce_4_pacing_constants_to_settings`** — `DAYS_PER_MONTH=30` and `MIN_INTERVAL_HOURS=12` are hardcoded. Could be promoted to settings keys if they need tuning. Low priority.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Scheduled-task handler + registry entry
- Bootstrap export from content-engine barrel
- Test file

## What the next session (CE-5) inherits

CE-5 is the visual generation pipeline (social templates + Puppeteer + OpenAI Images). It inherits:

- **Full generation → review → publish pipeline** from CE-3.
- **Automatic tier-paced generation** from CE-4 — posts appear in the review queue on their own.
- **`ensureContentGenerationEnqueued()`** for wiring into onboarding wizard completion.
- **`content_fan_out` task type** registered but no handler yet — CE-6 builds it.
- **No visual assets yet** — CE-5 builds the template system and image generation.

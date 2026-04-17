# `ce-6` — Fan-out scheduled-task handler (social drafts + newsletter rewrite on blog approval) — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (6 of 13)
**Model tier:** Sonnet (as recommended — medium handler wiring)

---

## What was built

The **`content_fan_out` scheduled-task handler** and **newsletter rewrite function** — the post-approval fan-out pipeline that publishes the blog, generates social drafts + visual assets, and rewrites the post for email newsletter format.

**Files created:**

- `lib/content-engine/newsletter-rewrite.ts` — `rewriteForNewsletter(postId, companyId)`: Haiku-tier newsletter rewrite pipeline. Hybrid format: single unsent post → standalone newsletter rewrite, multiple unsent → editorial digest. Loads Brand DNA signal tags as system context for voice matching. `computeNextSendWindow(day, time, tz)` DST-safe send window scheduler using `Intl.DateTimeFormat` (same pattern as UI-4/UI-13). Creates `newsletter_sends` row with `scheduled_for_ms` set to the company's configured send window. Kill-switch-gated on `content_newsletter_enabled`. `getUnsentPosts()` helper finds approved/published posts not yet included in any newsletter send.

- `lib/scheduled-tasks/handlers/content-fan-out.ts` — Handler: kill-switch gate → `publishBlogPost()` → `generateSocialDrafts()` + `generateVisualAssets()` → `rewriteForNewsletter()`. Steps are best-effort and independent: social pipeline failure doesn't block newsletter, and vice versa. Publish failure logs but continues to social + newsletter. Activity logging at each step for observability.

- `tests/content-engine/ce6-fan-out-handler.test.ts` — 15 tests: kill-switch exit, invalid payload, payload validation, full orchestration, publish failure continuation, social pipeline throw continuation, newsletter throw resilience, newsletter skip reason logging, kill-switch skip suppression, visual-asset skip on social non-ok, successful activity logging, send window future assertion, 7-day bound, day-of-week ordering, timezone offset.

**Files edited:**

- `lib/scheduled-tasks/handlers/index.ts` — Added `CONTENT_FAN_OUT_HANDLERS` import + spread into `HANDLER_REGISTRY`.
- `lib/content-engine/index.ts` — Added CE-6 barrel exports: `rewriteForNewsletter`, `computeNextSendWindow`, `NewsletterRewriteResult`.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Best-effort independence between fan-out steps.** Publish, social, and newsletter are wrapped in individual try/catch blocks. A failure in one logs and continues — the fan-out handler never throws from a step failure. This matches the spec's "background via scheduled_tasks" intent and prevents a flaky social template from blocking newsletter rewrite.

2. **Newsletter rewrite collects ALL unsent posts, not just the triggering one.** `getUnsentPosts()` finds every approved/published post for the company not yet included in a newsletter send. This naturally implements the spec's hybrid format: if multiple posts approved between newsletter windows, the next fan-out produces a digest rather than one standalone per post.

3. **Send window scheduling uses `Intl.DateTimeFormat` for DST safety.** Same pattern as `next23MelbourneMs` (UI-4) and `next8amMelbourneMs` (UI-13). Walks forward from "now in local tz" to the next occurrence of the configured day+time.

4. **Publish step runs first.** The blog transitions approved → published before social drafts and newsletter generate. This means the newsletter rewrite has access to the published URL for "read the full post" links, and social drafts reference a live post.

5. **Newsletter rewrite gated on `content_newsletter_enabled`, not `content_automations_enabled`.** The fan-out handler is gated on `content_automations_enabled` at the top level. The newsletter step has its own fine-grained kill switch so Andy can disable newsletters without disabling social drafts or vice versa.

6. **No `content_newsletter_send` enqueue in CE-6.** The `newsletter_sends` row is created with `scheduled_for_ms` set to the next send window. The actual sending handler (`content_newsletter_send`) is CE-7's scope — it queries for `newsletter_sends` rows where `scheduled_for_ms <= now` and `sent_at_ms IS NULL`.

## Verification (G0–G12)

- **G0** — CE-5 and CE-4 handoffs read. Spec `content-engine.md` §2.1 Stage 6, §4.4, §2.2 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `content_fan_out` in task_type enum, `publishBlogPost()`, `generateSocialDrafts()`, `generateVisualAssets()`, `newsletter_sends` table, `content_engine_config` table, `brand_dna_profiles` table, `content_automations_enabled` + `content_newsletter_enabled` kill switches, `content-rewrite-for-newsletter` LLM slug — all present.
- **G2** — Files match CE-6 scope (fan-out handler + newsletter rewrite + tests).
- **G3** — No motion work. Handler/pipeline session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. Body truncation (6000 chars) and post excerpt length (500 chars) are prompt engineering constants, not autonomy thresholds.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 159 test files / 1256 passed + 1 skipped (+15 new), clean production build, lint 0 errors (61 warnings, 0 from CE-6 files).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1256 passed. `npm run build` → success. Lint → 0 errors.
- **G9** — No UI surfaces. Handler + library session.
- **G10** — Pipeline behaviours exercised by unit tests. Best-effort independence verified. Send window scheduling tested.
- **G10.5** — N/A (handler/library session, no external UI).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_6_newsletter_read_more_link_placeholder`** — Newsletter rewrite uses `{{READ_MORE_LINK}}` placeholder in the prompt. CE-7's newsletter send handler needs to replace it with the actual published URL before sending.
- **`ce_6_newsletter_unsubscribe_link`** — Spec §4.1 requires `List-Unsubscribe` header + unsubscribe link in body. CE-7's send handler must inject these. The rewrite itself doesn't include them.
- **`ce_6_content_outreach_match_enqueue`** — Spec §2.1 Stage 6 includes content-to-outreach matching on publish (SuperBad only). This is CE-13's scope (`content_outreach_match` handler). Not wired in CE-6's fan-out.

## PATCHES_OWED (closed this session)

None.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Newsletter rewrite function + send window scheduler
- Fan-out handler + registry entry
- Barrel exports
- Test file

## What the next session (CE-7) inherits

CE-7 is the `content_newsletter_send` handler (actual email delivery at the scheduled window). It inherits:

- **`newsletter_sends` rows created by CE-6** — with `scheduled_for_ms` set, `sent_at_ms` null, `body` as HTML from Haiku rewrite.
- **`{{READ_MORE_LINK}}` placeholder** — must be replaced with the actual blog post URL before sending.
- **`content_newsletter_enabled` kill switch** — already used by CE-6 for the rewrite gate; CE-7 should check it again before sending.
- **Spam Act compliance requirements** — `List-Unsubscribe` header, unsubscribe link in body, sender identity.
- **`newsletter_subscribers` table** — active subscribers per company for recipient list.
- **Self-perpetuating send check** — CE-7 should run on a schedule (e.g. hourly or at configured windows) and query for unsent `newsletter_sends` rows whose `scheduled_for_ms` has passed.

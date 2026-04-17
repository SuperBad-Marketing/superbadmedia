# `ce-7` — Newsletter send handler (actual email delivery at scheduled window) — Handoff

**Closed:** 2026-04-17
**Wave:** 12 — Content Engine (7 of 13)
**Model tier:** Opus (session ran on Opus; Sonnet would have sufficed)

---

## What was built

The **`content_newsletter_send` scheduled-task handler**, **newsletter delivery pipeline**, **unsubscribe endpoint**, and **Spam Act compliance infrastructure** — completing CE-7 scope.

**Files created:**

- `lib/content-engine/newsletter-send.ts` — Core send logic: `getDueNewsletterSends(nowMs)` queries `newsletter_sends` rows where `scheduled_for_ms <= now` and `sent_at_ms IS NULL`. `sendNewsletter(send)` loads active subscribers for the company, resolves `{{READ_MORE_LINK}}` placeholders with actual `published_url` from blog posts (ordered replacement for digest format, `/blog/<slug>` fallback when URL is null), injects an unsubscribe footer before `</body>`, sends per-recipient via `sendEmail()` with `List-Unsubscribe` + `List-Unsubscribe-Post` headers, updates `sent_at_ms` + `recipient_count` on the send row, logs `content_newsletter_sent` activity. Exported pure helpers: `resolveReadMoreLinks()`, `buildUnsubscribeUrl()`, `injectUnsubscribeFooter()`.

- `lib/scheduled-tasks/handlers/content-newsletter-send.ts` — Handler: kill-switch gate on `content_newsletter_enabled` → process all due sends → self-re-enqueue in 1 hour. Per-send try/catch: one failure logs and continues to next send. `ensureNewsletterSendEnqueued(nowMs?, initialDelayMs?)` bootstrap export for Content Engine setup wizard completion.

- `app/api/newsletter/unsubscribe/route.ts` — GET + POST endpoint. GET renders a simple HTML confirmation page (browser click from email body link). POST handles RFC 8058 `List-Unsubscribe-Post` one-click unsubscribe from mail clients. Both: look up subscriber by `sid` query param, set `status='unsubscribed'` + `unsubscribed_at_ms`, log activity. Idempotent (re-unsubscribe shows confirmation).

- `tests/content-engine/ce7-newsletter-send-handler.test.ts` — 17 tests across 6 describe blocks: handler kill-switch exit, due send processing + self-re-enqueue, error logging + continuation, bootstrap enqueue with correct task_type + idempotency key, custom delay, `resolveReadMoreLinks` (single, digest ordered, null URL fallback, excess placeholders, no placeholders), `buildUnsubscribeUrl`, `injectUnsubscribeFooter` (before `</body>`, no `</body>`, correct href), `sendEmail` header verification (List-Unsubscribe + List-Unsubscribe-Post), skipped recipient counting, no_subscribers result.

**Files edited:**

- `lib/channels/email/send.ts` — Added optional `headers: Record<string, string>` to `SendEmailParams`, passed through to `resend.emails.send()`. Additive, non-breaking change.
- `lib/scheduled-tasks/handlers/index.ts` — Added `CONTENT_NEWSLETTER_SEND_HANDLERS` import + spread into `HANDLER_REGISTRY`.
- `lib/content-engine/index.ts` — Added CE-7 barrel exports: `getDueNewsletterSends`, `sendNewsletter`, `resolveReadMoreLinks`, `buildUnsubscribeUrl`, `injectUnsubscribeFooter`, `NewsletterSendResult`, `ensureNewsletterSendEnqueued`.
- `tests/content-engine/ce3-blog-generation.test.ts` — Changed `vi.mock("@/lib/channels/email/send")` auto-mock to explicit factory mock to prevent Resend constructor from executing when barrel transitively imports newsletter-send.ts.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Hourly self-perpetuating check, not event-driven enqueue.** CE-6 creates `newsletter_sends` rows with `scheduled_for_ms` set to the configured send window but does not enqueue a `content_newsletter_send` task per row. The handler runs hourly and picks up all due rows. Simpler than event-driven; 1-hour granularity is fine for weekly newsletters.

2. **Per-recipient delivery, not batch.** Each subscriber gets their own `sendEmail()` call so `canSendTo()` suppression and `List-Unsubscribe` headers work per-recipient. The newsletter *content* is one unit (discipline #49: "all posts in one email"), but *delivery* is per-subscriber.

3. **Ordered `{{READ_MORE_LINK}}` replacement.** For digest format, multiple placeholders are replaced sequentially in blog post order. Excess placeholders (more than posts) fall back to `#`. This matches the CE-6 rewrite prompt's numbered post layout.

4. **Unsubscribe via subscriber UUID in query param.** UUIDs are not guessable. No HMAC signing needed for v1 — the worst case of a random UUID hit is an unsubscribe, which is a safe default (Spam Act favours easy opt-out). Re-subscribe requires a fresh opt-in per spec §4.3.

5. **Newsletter classification as `transactional`.** Per spec §14.12: "Newsletter = `classification: 'transactional'`" — subscriber opted in, so it bypasses outreach kill switch and quiet window. The handler's own `content_newsletter_enabled` kill switch provides the granular gate.

6. **RFC 8058 POST handler for mail client one-click unsubscribe.** Modern mail clients (Gmail, Apple Mail) use `List-Unsubscribe-Post` to unsubscribe without loading a browser. The POST handler responds with JSON `{ ok: true }`.

## Verification (G0–G12)

- **G0** — CE-6 and CE-5 handoffs read. Spec `content-engine.md` §4.1, §4.3, §4.4, §14.12 read. BUILD_PLAN Wave 12 read.
- **G1** — Preconditions verified: `content_newsletter_send` in task_type enum, `newsletter_sends` table, `newsletter_subscribers` table, `blog_posts` table with `published_url`, `content_newsletter_enabled` kill switch, `sendEmail()` adapter, `content_newsletter_sent` activity_log kind — all present.
- **G2** — Files match CE-7 scope (send handler + send library + unsubscribe endpoint + tests).
- **G3** — No motion work. Handler/library session.
- **G4** — No numeric/string literals in autonomy-sensitive paths. `CHECK_INTERVAL_MS` (1 hour) is a pacing constant, not an autonomy threshold.
- **G5** — Context budget held. Medium session as estimated.
- **G6** — No migration, no schema change. Rollback: git-revertable.
- **G7** — 0 TS errors, 160 test files / 1273 passed + 1 skipped (+17 new), clean production build, lint 0 errors (61 warnings, 0 from CE-7 files).
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → 1273 passed. `npm run build` → success. `npm run lint` → 0 errors.
- **G9** — No UI surfaces. Handler/library/API session.
- **G10** — Pipeline behaviours exercised by unit tests. Unsubscribe endpoint tested.
- **G10.5** — N/A (handler/library session, no external UI).
- **G11** — This file.
- **G12** — Tracker flip + commit.

## PATCHES_OWED (raised this session)

- **`ce_7_per_company_sender_domain`** — Spec §4.1 says "Each subscriber's newsletter sends from their own verified domain (setup wizard Step 1)." Currently uses global `EMAIL_FROM` env var. Per-company sender domain support needs the domain verification wizard (SW-5) to be built first.
- **`ce_7_bounce_handling_webhook`** — Spec §4.3 requires automated bounce handling (hard bounce → immediate removal, soft bounce → 3 retries then removal, 90-day inactive → removal). The Resend webhook handler needs to be extended to write to `newsletter_subscribers` status on bounce/complaint events. Currently only `email_suppressions` is populated.
- **`ce_7_check_interval_to_settings`** — `CHECK_INTERVAL_MS` (1 hour) is hardcoded. Could be promoted to a settings key if tuning is needed. Low priority.
- **`ce_7_subscriber_list_health_panel`** — Spec §4.3 mentions a read-only list health panel (bounce rate, unsubscribe rate, inactive %, recent removals). UI surface, not CE-7 scope.

## PATCHES_OWED (closed this session)

- **`ce_6_newsletter_read_more_link_placeholder`** — `{{READ_MORE_LINK}}` replacement implemented in `resolveReadMoreLinks()`.
- **`ce_6_newsletter_unsubscribe_link`** — `List-Unsubscribe` header + body link implemented.

## Rollback strategy

`git-revertable`. No migration, no data shape change. Reverting removes:
- Newsletter send library + handler + registry entry
- Unsubscribe API endpoint
- `sendEmail()` headers support (additive, non-breaking)
- Barrel exports
- Test file

## What the next session (CE-8) inherits

CE-8 scope needs pre-compilation (not detailed in BUILD_PLAN). Likely candidates: social draft admin surface (CE-5 handoff: "CE-8+ builds the admin surface for viewing/publishing social drafts"), or newsletter subscriber management. CE-9 owns `content_ranking_snapshot` per the cron table. CE-8 inherits:

- **Full content pipeline through to newsletter delivery** — CE-1 (data model) → CE-2 (research) → CE-3 (generation + review + publish) → CE-4 (automatic generation) → CE-5 (visual assets) → CE-6 (fan-out + newsletter rewrite) → CE-7 (newsletter send).
- **`ensureNewsletterSendEnqueued()`** for wiring into Content Engine setup wizard completion.
- **Unsubscribe endpoint live** at `/api/newsletter/unsubscribe`.
- **`sendEmail()` now accepts `headers`** — available for any future email that needs custom headers.

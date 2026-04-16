# `ui-2` — Inbound router classifier (Haiku) + contact resolution + auto-create — Handoff

**Closed:** 2026-04-16
**Wave:** 9 — Unified Inbox (2 of 13)
**Model tier:** `/deep` (Opus — ran on Opus despite brief recommending Sonnet)

---

## What was built

Haiku-tier inbound email classifier (spec §7.1 Q5) with contact resolution and auto-create logic. Wired into the delta sync pipeline for inbound messages. Gated behind `inbox_sync_enabled` + `llm_calls_enabled` kill switches.

**Files created:**

- `lib/graph/router.ts` — `classifyAndRouteInbound(msg, messageId, threadId)` entry point; Zod-validated LLM output; 4 classification handlers (match_existing, new_lead, non_client, spam); contact + company auto-create; activity logging
- `lib/graph/router-prompt.ts` — `buildRouterPrompt(ctx)` + `loadRouterPromptContext(msg)` — loads contacts list, Brand DNA via `getSuperbadBrandProfile()`, recent corrections (up to 10) as few-shot examples
- `lib/db/schema/classification-corrections.ts` — shared corrections table for all 3 classifiers (router / notifier / signal_noise), per discipline #54
- `lib/db/migrations/0031_ui2_classification_corrections.sql` — table creation + indexes
- `lib/db/migrations/0032_ui2_contacts_inbox_columns.sql` — 4 new contacts columns
- `tests/graph-router.test.ts` — 17 tests (7 Zod parsing + 3 prompt builder + 2 corrections table + 5 contacts columns)

**Files edited:**

- `lib/db/schema/contacts.ts` — added `relationship_type`, `inbox_alt_emails`, `notification_weight`, `always_keep_noise`
- `lib/db/schema/index.ts` — re-export `classification-corrections`
- `lib/graph/sync.ts` — wired `classifyAndRouteInbound` after inbound message insert (non-fatal try/catch)
- `lib/graph/index.ts` — barrel exports for router + router-prompt
- `lib/ai/prompts/unified-inbox.md` — fleshed out `inbox-classify-inbound-route` stub with implementation details
- `lib/db/migrations/meta/_journal.json` — added entries for 0031/0032

## Key decisions locked

1. **LLM fallback on failure → new_lead.** If Haiku returns malformed JSON or the API call fails, the message is classified as `new_lead` with no contact creation. Ensures no inbound is silently dropped.
2. **Company auto-create for new contacts.** `contacts.company_id` is NOT NULL, so new_lead and non_client paths resolve-or-create a company by normalised name match. Falls back to "Unknown" if LLM doesn't provide a company name.
3. **Alt-email detection on match_existing.** Router prompt asks LLM to detect when a known contact emails from a different address. Detected alt-email appended to `contacts.inbox_alt_emails` (deduplicated).
4. **Spam → 7-day keep_until.** Thread marked `priority_class: "spam"` with `keep_until_ms` 7 days out. Still in DB, just hidden from views.
5. **Router wired non-fatally.** In `sync.ts`, the router call is wrapped in try/catch — router failure doesn't prevent message insertion.
6. **Contact dedup by email_normalised.** Before creating a new contact, handleNewContact checks for existing contact by normalised email. Prevents duplicates from the same sender.

## Verification (G0–G12)

- **G0** — brief read; spec §§5.1, 5.2, 6.1, 7.1, 11.3, 16 read; skills loaded (drizzle-orm, typescript-validation).
- **G1** — all 11 preconditions verified.
- **G2** — files match whitelist exactly.
- **G3** — not triggered (well within 70%).
- **G4** — no autonomy-sensitive literals. SPAM_KEEP_DAYS is a structural constant (spec §7.1 says "7-day purge"), not a tunable threshold.
- **G5** — N/A (FEATURE with no state transitions visible to end users while kill-switch is off).
- **G6** — `feature-flag-gated` via `inbox_sync_enabled` + `llm_calls_enabled`.
- **G7** — all artefacts enumerated and verified.
- **G8** — `npx tsc --noEmit` → 0 errors; `npm test` → 871 passed / 1 skipped; `npm run build` → clean.
- **G9** — no critical flows touched.
- **G10** — N/A (FEATURE, no UI surfaces).
- **G10.5** — external reviewer verdict: **PASS**.
- **G11** — this file.
- **G12** — tracker updated, committed.

## G10.5 external reviewer verdict

**VERDICT: PASS**

- Spec fidelity: PASS — all 12 acceptance criteria met.
- Memory alignment: PASS — `feedback_technical_decisions_claude_calls` (all decisions silent), `project_context_safety_conventions` (prompt documented in file), `project_llm_model_registry` (uses `modelFor()`, never raw model ID).
- Test honesty: PASS — 17 meaningful behavioral tests across Zod parsing, prompt builder, and DB operations.
- Scope discipline: PASS — files match whitelist exactly, no creep.

No notes logged to PATCHES_OWED.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all implementation choices (fallback strategy, company auto-create approach, alt-email dedup, non-fatal router wiring) made silently. No technical questions surfaced to Andy.
- **`project_context_safety_conventions`** — prompt contract documented in `lib/ai/prompts/unified-inbox.md`. New schema files self-contained with spec references. Migrations journal-tracked.
- **`project_llm_model_registry`** — LLM call uses `modelFor("inbox-classify-inbound-route")`, never a raw model ID.

## PATCHES_OWED

None opened this session. None closed.

## Rollback strategy

`feature-flag-gated` — kill-switch `inbox_sync_enabled` (must be ON) + `llm_calls_enabled` (must be ON) for router to fire. Both ship disabled. Rollback = leave switches off. Migrations are additive (new table + new nullable columns); revert = `git revert`.

## What the next session should know

Next: **`ui-3`** — Notification triage classifier (Haiku).

- `classification_corrections` table is shared (discipline #54) — UI-3's notifier classifier reads from it with `classifier = 'notifier'` filter.
- The `contacts.notification_weight` column added in this session is consumed by UI-3's notifier classifier (spec Q10 input).
- `lib/graph/router-prompt.ts` pattern (load context → build prompt → parse with Zod) is reusable for UI-3 and UI-4.
- In `lib/graph/sync.ts`, the router is called inline after message insert. Per discipline #52, UI-3 and UI-4 should be called in parallel with the router — the wiring point is the same `if (direction === "inbound")` block.
- Brand DNA context retrieval (`getSuperbadBrandProfile()`) is reused from the Quote Builder module. UI-5 (reply drafter, Opus) will need the same.
- `contacts.inbox_alt_emails` now stores alt-email addresses detected by the router. Contact matching in future sessions should check both primary email and alt-emails.
- Model tier: `/normal` (Sonnet) should be fine for UI-3 — same classification pattern.

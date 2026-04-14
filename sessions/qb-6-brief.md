# `QB-6` — Scheduled-task handlers (QB-owned) — Session Brief

> Authored at QB-6 kickoff (not by qb-subs closing handoff — G11.b miss logged in `PATCHES_OWED.md` token `qb_subs_g11b_brief_miss`).
> Read this file at G0. Do not re-read all 21 specs.

---

## 1. Identity

- **Session id:** `QB-6`
- **Wave:** `6 — Quote Builder`
- **Type:** `INFRA`
- **Model tier:** `/deep` (Opus)
- **Sonnet-safe:** `no`
- **Estimated context:** `medium`

## 2. Spec references

- `docs/specs/quote-builder.md` §8.3 — handler signatures for the six stub slots; only two are in QB-6 scope (see §5)
- `docs/specs/quote-builder.md` §8.4 — idempotency-key formats
- `docs/specs/quote-builder.md` §3.1.5 — reminder enqueue + view-time `skipped` flip (already shipped QB-4b)
- `docs/specs/quote-builder.md` §3.2.2 — viewer-side skip semantics (already shipped)
- `docs/specs/branded-invoicing.md` §9.1 / §9.2 — `generateInvoice()` / `sendInvoice()` signatures (consulted for contract only; BI-1 owns implementation)
- `docs/specs/branded-invoicing.md` §11.1 — cross-spec contract narrowing `handleManualInvoiceSend` to send-only

## 3. Acceptance criteria (verbatim — spec §8.3)

```
handleQuoteExpire({ quote_id }):
- Re-read quote row
- If status NOT IN ('sent', 'viewed'): return ok: true (no-op — already moved on)
- Else: transition status → expired, fire expiry email to client
  (link-only: "your quote expired, still interested? here's how to reach out"),
  log quote_expired, return ok: true

handleQuoteReminder3d({ quote_id }):
- Re-read quote row
- If status NOT IN ('sent') (excludes 'viewed'): return ok: true (skip)
- Else: fire reminder email (Claude-drafted, drift-checked, short),
  log quote_reminder_sent, return ok: true
```

## 4. Skill whitelist

- `drizzle-orm` — schema read/write + transition call + idempotency pattern
- `claude-api` — reminder-email draft (Sonnet via LLM registry) + drift check

## 5. File whitelist (G2)

**In scope — QB-owned handlers only:**

- `lib/scheduled-tasks/handlers/quote-builder.ts` — `edit`: replace `quote_expire` + `quote_reminder_3d` stubs with real handlers
- `lib/quote-builder/handle-quote-expire.ts` — `new`: handler implementation + unit-testable core
- `lib/quote-builder/handle-quote-reminder-3d.ts` — `new`: handler implementation + unit-testable core
- `lib/quote-builder/emails/quote-expired-email.ts` — `new`: link-only copy per §8.3 (spec line quoted verbatim)
- `lib/ai/prompts/draft-quote-reminder-3d.ts` — `new` (or `edit` if stub exists): prompt file per Phase 3.5 step 3b discipline
- `lib/db/schema/activity-log.ts` — `edit`: add `quote_reminder_sent` to `ACTIVITY_LOG_KINDS` (flagged missing in spec §8.3 line 729)
- `lib/db/migrations/XXXX_qb6_activity_log_quote_reminder_sent.sql` — `migration`: additive enum extension
- `tests/quote-builder/handle-quote-expire.test.ts` — `new`: all branches (wrong status no-op, sent→expired, viewed→expired, transaction rollback on email fail)
- `tests/quote-builder/handle-quote-reminder-3d.test.ts` — `new`: wrong-status skip, sent→reminder-sent + log, drift-check fail path
- `tests/scheduled-tasks/qb6-handlers.test.ts` — `new`: dispatch-through-registry coverage (the old "still stubbed" assertion in qb1-handlers narrows by 2)
- `tests/scheduled-tasks/qb1-handlers.test.ts` — `edit`: `QUOTE_BUILDER_STUB_TASK_TYPES` assertion narrows from 6 to 4
- `lib/scheduled-tasks/handlers/quote-builder.ts` `QUOTE_BUILDER_STUB_TASK_TYPES` — `edit`: same narrowing (source of truth)

**Out of scope — intentionally deferred:**

- `manual_invoice_generate` / `manual_invoice_send` handlers — **blocked on BI-1**. `invoices` table does not exist in the repo; `lib/invoicing/generate.ts` + `lib/invoicing/send.ts` do not exist. QB-6 cannot ship these handlers without stubbing the primitives, which would duplicate BI-1's ownership. Stubs stay in place; BI-1 replaces them.
- `subscription_pause_resume_reminder` / `subscription_pause_resume` — owned by the Client Portal cancel-flow session (spec §9). Not in Wave 6. Stubs stay.
- Accept.ts enqueue gating for `manual_invoice_generate` — `lib/quote-builder/accept.ts:203` currently enqueues a task that cannot be handled. **Gated behind new kill-switch `invoicing.manual_cycle_enqueue_enabled` (default `false`)** so manual-billed Accept stops creating dead-lettered tasks until BI-1 lands. One-line change.
- `lib/kill-switches.ts` — `edit`: add `invoicing_manual_cycle_enqueue_enabled` flag (default `false`). This IS a whitelist addition — documenting up front to avoid a G2 out-of-whitelist note later.
- `lib/quote-builder/accept.ts` — `edit`: wrap the `manual_invoice_generate` enqueue in a kill-switch check. Narrowest possible touch.

## 6. Settings keys touched

- **Reads:** `quote.reminder_days` (seeded A5; consumed today by enqueue-at-send; QB-6 handler does not re-read — the run-time is already baked into the scheduled row).
- **Reads:** `quote.default_expiry_days` (seeded A5; QB-6 handler does not re-read).
- **Seeds (new keys):** none.
- **Kill switches added:** `invoicing_manual_cycle_enqueue_enabled` (default `false`) — feature-flag gate for the premature `manual_invoice_generate` enqueue.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `lib/scheduled-tasks/handlers/quote-builder.ts` exists — `ls`
- [ ] `QUOTE_BUILDER_STUB_TASK_TYPES` exports `quote_expire` + `quote_reminder_3d` — `grep`
- [ ] `transitionQuoteStatus` accepts `sent → expired` + `viewed → expired` — `grep lib/quote-builder/transitions.ts`
- [ ] `quote_expired` in `ACTIVITY_LOG_KINDS` — `grep lib/db/schema/activity-log.ts`
- [ ] `quote_reminder_sent` **NOT yet** in `ACTIVITY_LOG_KINDS` (this session adds it) — `grep -v` confirms the gap
- [ ] `sendEmail()` supports `classification: 'transactional'` — `grep lib/channels/email/send.ts`
- [ ] `callClaudeByJob()` / LLM registry entrypoint exists for the reminder draft — `grep lib/ai/registry.ts`
- [ ] `checkBrandVoiceDrift()` callable — `grep lib/ai/drift.ts`
- [ ] `quote.reminder_days` + `quote.default_expiry_days` seeded in `0001_seed_settings.sql` — `grep`
- [ ] `scheduled_tasks` table + `enqueueTask()` + worker dispatch exist — `ls lib/scheduled-tasks/`
- [ ] `lib/invoicing/` directory does **not** exist (confirms BI-1 not-landed) — `ls` returns no such path
- [ ] `invoices` schema file does **not** exist — `ls lib/db/schema/invoices.ts` returns no such file

## 8. Rollback strategy (G6 — exactly one)

- [x] **`feature-flag-gated`** — two surfaces, two flags:
  - Handler dispatch: global `scheduled_tasks_enabled` (existing) — flip off kills all scheduled work including QB-6's new handlers.
  - Manual-cycle enqueue gate: new `invoicing_manual_cycle_enqueue_enabled` — default off. Flip on ONLY after BI-1 lands.
  - Rollback action if reminder/expire handlers misbehave in prod: flip `scheduled_tasks_enabled=false`, fix, re-enable.
- Migration (`quote_reminder_sent` enum addition) is additive and SQLite-enum-safe; no down-migration needed (no rows would carry the new kind if rolled back).

## 9. Definition of done

- [ ] Four new files land (two handlers, one email copy, one prompt file, minus the two test files).
- [ ] `quote_reminder_sent` added to `ACTIVITY_LOG_KINDS` + migration applied locally.
- [ ] `invoicing_manual_cycle_enqueue_enabled` kill-switch added; accept.ts enqueue wrapped.
- [ ] `QUOTE_BUILDER_STUB_TASK_TYPES` narrows from 6 → 4 entries.
- [ ] Existing `qb1-handlers.test.ts` assertion updated (6 → 4).
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (expect 585 + new ≈ 600 range; no regressions).
- [ ] G4 literal grep: no hard-coded days/hours/retry-counts introduced (all knobs already pre-seeded).
- [ ] G10.5 external-reviewer gate: sub-agent `PASS` or `PASS_WITH_NOTES`; verdict pasted in handoff.
- [ ] Handoff lists every applied memory (G11): load-bearing ones here are `feedback_passive_vs_active_channels` (email is passive OK for the client-facing reminder/expiry), `feedback_outreach_never_templated` (reminder copy is LLM-drafted per call, not templated), `project_llm_model_registry` (the reminder draft routes through the registry job name, not a hard-coded model id).
- [ ] QB-7 brief written in the same commit (G11.b — don't repeat the qb-subs miss).

## 10. Cross-spec metadata contract (what to encode in `meta` on each log row)

Pattern is the qb-subs/SP-9 precedent: `activity_log.kind = 'note'` only widens the closed-enum list when the kind is load-bearing downstream; otherwise we keep the narrow kind + rich `meta`. QB-6 kinds are **load-bearing** (expiry + reminder-sent drive cockpit chips + cohort reporting later), so we add the enum values directly.

**`quote_expired` meta shape (written by `handleQuoteExpire`):**

```ts
{
  kind: "quote_expired",
  meta: {
    quote_id: string,
    deal_id: string,
    company_id: string,
    source: "scheduled_task",        // distinguishes from a future manual-expire admin action
    task_id: string,                  // scheduled_tasks.id that fired
    prior_status: "sent" | "viewed", // audit trail — which branch expired
    expired_at_ms: number,
  }
}
```

**`quote_reminder_sent` meta shape (written by `handleQuoteReminder3d`):**

```ts
{
  kind: "quote_reminder_sent",
  meta: {
    quote_id: string,
    deal_id: string,
    company_id: string,
    task_id: string,
    email_message_id: string | null, // from sendEmail() Resend response
    drift_check_result: "pass" | "pass_with_notes" | "fail_redraft",
    llm_job: "draft-quote-reminder-3d",
    attempts: number,                 // scheduled_tasks.attempts at dispatch time
  }
}
```

Neither log carries retry-escalation state (that lives on the `scheduled_tasks` row natively and the cockpit's "needs attention" pane reads from there, not from `activity_log`).

## 11. Notes for the QB-7 brief writer (G11.b — close the loop)

QB-7 scope per `BUILD_PLAN.md` Wave 6: Supersede (new row, old void) + withdrawal + expired/withdrawn URL states. QB-6 deliberately leaves the following load-bearing for QB-7:

- `quote_superseded` + `quote_withdrawn` activity kinds already exist in the enum (see `activity-log.ts` lines ~77–78 — verified at G1). QB-7 writes the meta shapes.
- The `expired` URL state for the viewer route (`/lite/quotes/[token]`) is **not** shipped by QB-6 — QB-6 only handles the server-side state transition + email. The viewer's expired-page rendering is a QB-7 concern.
- `invoicing_manual_cycle_enqueue_enabled` kill-switch: QB-7 does not touch. BI-1 owns the flip.
- Manual-cycle enqueue re-activation decision: BI-1 owns. When BI-1 lands, its handoff must cover (a) flip the switch, (b) remove the dead `manual_invoice_generate` tasks that accumulated between QB-5 landing and BI-1 landing (or none — if none ever enqueued because the gate was off from commit zero, cleanup is a no-op).
- Reminder/expire handlers are `PASS` state by QB-6 close; QB-7's DoD should include a regression assertion that `quote_reminder_sent` + `quote_expired` activity rows still write correctly when a supersession cancels the scheduled tasks.

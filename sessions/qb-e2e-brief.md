# `qb-e2e` — Quote Builder E2E suite (deal → quote → accept → pay) — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0. Read only this file at session start.**

---

## 1. Identity

- **Session id:** `qb-e2e`
- **Wave:** 6 — Quote Builder (closing gate)
- **Type:** `INFRA` (Playwright E2E scaffolding + critical-flow spec)
- **Model tier:** `/normal` (Sonnet) — no state-machine design work;
  this is test authoring + scaffolding against shipped code.
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`

## 2. Spec references

- `docs/specs/quote-builder.md` §5.1 — seven-state machine.
- `docs/specs/quote-builder.md` §7 — admin surfaces.
- `docs/specs/quote-builder.md` §8.3 — accept side effects.
- `AUTONOMY_PROTOCOL.md` §G12 — Playwright E2E is **mandatory** on the
  5 critical flows; QB-E2E covers the quote-accept flow.
- `BUILD_PLAN.md` Wave 4 SW-5c — previous Playwright scaffolding
  reference (receiver-only slice).

## 2a. Visual references

- `mockup-quote-accept.html` (if present — otherwise the shipped
  `/lite/quotes/[token]` page is the binding reference).
- Admin drawer visuals are NOT in scope for E2E — UI hooks + server
  actions are the assert target.

## 3. Acceptance criteria (verbatim — from spec §5.1 + §8.3)

```
E2E scenario (manual-billed, simpler path):
  1. Seed company + deal + contact fixtures via a dedicated
     `scripts/seed-qb-e2e.ts` script (reuse pipeline seed where possible).
  2. Navigate admin → deal → new quote. Pick project structure, add
     catalogue items, save draft.
  3. Trigger send (admin action). Assert quote status = `sent`,
     activity_log.quote_sent row exists.
  4. Load public `/lite/quotes/[token]` URL in a fresh context (no
     admin session). Assert view-tracking flips sent → viewed +
     stamps `viewed_at_ms`.
  5. Tick ToS + privacy checkboxes, click Accept (manual-billed
     branch — no Stripe Payment Element in this path).
  6. Assert:
       - quote status = accepted
       - deal stage = won
       - deal.subscription_state = null (project, not retainer) OR
         active (retainer/mixed)
       - activity_log rows: quote_accepted, quote_settled
       - `manual_invoice_generate` enqueue GATED OFF
         (`killSwitches.invoicing_manual_cycle_enqueue_enabled=false`);
         zero `scheduled_tasks` row of that type exists.

E2E scenario (Stripe-billed path — optional; defer to BI-E2E if budget
tight):
  Parallel path via Stripe test-mode Payment Intent. Mock or drive
  with Stripe CLI `stripe fixtures`. If included: confirm PI succeeds
  → webhook `payment_intent.succeeded` fires → quote + deal flip.
```

## 4. Skill whitelist

- `webapp-testing` — Playwright config + patterns.
- `nextauth` — admin session seeding for the drawer flow.
- `drizzle-orm` — seeding fixtures against the test database.

## 5. File whitelist

- `playwright.config.ts` — MODIFY if exists, else NEW. Register
  `tests/e2e/qb-e2e.spec.ts` as the critical-flow project; pin global
  timeout; configure webServer against `npm run dev` on a test port.
- `scripts/seed-qb-e2e.ts` — NEW — deterministic fixtures (company,
  contact, deal, catalogue items, admin user).
- `tests/e2e/qb-e2e.spec.ts` — NEW — the spec above.
- `tests/e2e/helpers/admin-session.ts` — NEW if no helper exists;
  otherwise reuse. Seeds a logged-in admin cookie so the test can
  drive `/lite/admin/...` routes without flapping on magic-link auth.
- `sessions/qb-e2e-handoff.md` — NEW.
- `sessions/<next>-brief.md` — NEW (per G11.b) — next wave's session
  brief. First Wave 7 / BI-1 session is the expected next target;
  confirm against BUILD_PLAN.md at session start before authoring.

## 6. Settings keys touched

- **Reads:** `invoicing_manual_cycle_enqueue_enabled` (kill-switch —
  assert it is `false` in the seed environment; E2E shouldn't mutate
  it).
- **Seeds:** none.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] **BLOCKER — build must be fixable.** Playwright runs against a
  built Next app. The pre-existing
  `qb4c_stripe_client_eager_build_break` row in `PATCHES_OWED.md` (eager
  Stripe SDK instantiation at module top level in
  `lib/stripe/client.ts`) must be resolved before E2E can run. Either
  (a) fix the lazy-init pattern in this same session per the SW-5b
  `getStripe()` model, or (b) flag it as a hard blocker in the handoff
  and stop. Preflight: `grep -n "new Stripe" lib/stripe/client.ts` —
  if instantiation is at module top level, fix first.
- [ ] Playwright installed? — `ls node_modules/@playwright/test`.
  If missing, `npx playwright install --with-deps` is a session-1 cost
  (declare in handoff).
- [ ] Seed fixtures idempotent? — `ls scripts/seed-pipeline.ts`
  (reference for the pattern QB-E2E seed script follows).
- [ ] Quote-accept route exists? —
  `ls app/lite/quotes/\[token\]/page.tsx` + grep
  `acceptQuote\|finaliseDealAsWon` under `lib/quote-builder/`.
- [ ] Kill-switch registry present? — `grep "invoicing_manual_cycle_enqueue_enabled" lib/kill-switches.ts`.

## 8. Rollback strategy (G6)

`git-revertable`. E2E scaffolding is purely additive — config + tests
+ a seed script. No schema, no env (except the Playwright-specific
`NEXT_PUBLIC_*` echo for the test server port if required), no public
surfaces modified. If the Stripe lazy-init fix lands in this session,
that fix is covered by its own PATCHES_OWED row — the session handoff
names the commit so a targeted revert is straightforward.

## 9. Definition of done

- [ ] Playwright installed + config committed.
- [ ] `scripts/seed-qb-e2e.ts` seeds a complete deal → quote draft
  fixture idempotently.
- [ ] `tests/e2e/qb-e2e.spec.ts` covers the manual-billed happy path
  end to end with every assert in §3.
- [ ] Stripe-billed path either landed OR explicitly deferred to
  BI-E2E with rationale in handoff.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` (unit) → green (target 636+).
- [ ] `npx playwright test` → green.
- [ ] G4 literal grep — no new autonomy thresholds.
- [ ] G10.5 external-reviewer gate — PASS or PASS_WITH_NOTES.
- [ ] Memory-alignment declaration in handoff.
- [ ] G0 → G12 clean handoff + next-wave brief authored in same
  commit (G11.b).

## 10. Cross-spec / carry-forward

**From QB-8 (pass-through, not blockers):**
- QB-8 shipped data-shape only for the Q21 early-cancel flow; the
  Client Portal wave owns the UI. QB-E2E does not exercise early-
  cancel paths — they're not on the `deal → quote → accept → pay`
  critical flow. Early-cancel E2E belongs to the Client Portal wave.

**From QB-7 (pass-through):**
- Supersede email variant + admin drawer buttons — logged in
  `PATCHES_OWED.md`. Not E2E scope.

**From QB-4c:**
- `qb4c_stripe_client_eager_build_break` — MUST be resolved in this
  session (see §7 precondition) or the E2E can't run. If resolved
  here, also close the row in `PATCHES_OWED.md`.
- `qb4c_sound_quote_accepted_emit` + `qb4c_manual_invoice_generate_handler`
  — pure data plane; the E2E asserts the enqueue is correctly gated
  OFF, not that a handler exists.

**Kill-switch inventory at session start:** no new switches.
`invoicing_manual_cycle_enqueue_enabled` must be asserted `false`
in the test env; BI-1 owns the flip.

## 11. Notes for next-wave brief writer (G11 extension)

QB-E2E closes Wave 6 (Quote Builder). The next wave per BUILD_PLAN.md
is either **Wave 7 / Branded Invoicing (BI-1)** or the Client Portal
wave that owns the early-cancel + pause/resume surfaces. Confirm by
reading `BUILD_PLAN.md` at session start. BI-1 is the more likely
next wave because the kill-switch gating QB-6/QB-4c manual-invoice
enqueue is BI-1's responsibility to flip.

The next-wave brief must:
- Cite its spec file(s) verbatim.
- List G1 preconditions from the repo state after QB-E2E merges
  (Playwright installed, Stripe lazy-init fix landed, seed script
  present).
- Flag every kill-switch it unlocks, flips, or depends on.

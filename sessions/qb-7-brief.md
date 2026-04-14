# `qb-7` — Supersede / withdraw + public URL states — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0. Read only this file at session start.**

---

## 1. Identity

- **Session id:** `qb-7`
- **Wave:** 6 — Quote Builder
- **Type:** `FEATURE` (mixed: small backend + UI card states)
- **Model tier:** `/deep` (Opus) — touches state machine + public-facing UX
- **Sonnet-safe:** `no`
- **Estimated context:** `medium`

## 2. Spec references

- `docs/specs/quote-builder.md` §Q7, Q20 — seven-state machine; supersede creates new row, old preserved with `status='superseded'`
- `docs/specs/quote-builder.md` §7 (flow 7+8) — edit-after-send forks row; withdraw is distinct from supersede
- `docs/specs/quote-builder.md` §5.5 / §8.4 — admin drawer: Edit + Withdraw actions; client-side URL behaviour
- `docs/specs/quote-builder.md` §197 — Expired URL card copy: *"still interested? andy@superbadmedia.com.au"*
- `docs/specs/quote-builder.md` §871 — error pages: expired/withdrawn/superseded quote URL cards

## 2a. Visual references

- `mockup-quote-public.html` — the public quote page (expired/withdrawn/superseded cards live here as alt states)
- `docs/superbad_brand_guidelines.html` — palette + typography
- `docs/superbad_voice_profile.html` — card copy tone (wind-down, earned-CTA)

**Intentional divergences:** none expected; cards are small alt surfaces on the existing public page.

## 3. Acceptance criteria (verbatim — from spec §Q20 + §7.7–7.8 + §5.5)

```
Q20 — Edit after send:
  Supersede via new row with supersedes_quote_id FK. Original row
  preserved with status = 'superseded'. Sending the new quote
  transitions the old row atomically, enqueues fresh scheduled tasks
  on the new row, and cancels pending tasks on the old row as
  'skipped'. Outbound email to the client explains the replacement.

7.7 — Edit-after-send flow:
  Draft editor on a sent row shows a banner. Clicking Edit forks a
  new draft row (supersedes_quote_id set, status='draft'). Send
  transitions old → superseded in the same txn that flips new → sent.

7.8 — Withdraw:
  "Withdraw quote" action in drawer. Confirm → status='withdrawn',
  pending scheduled tasks flipped to 'skipped', no replacement quote,
  old URL renders "no longer active" card (distinct from supersede's
  "replaced" card).

Client URL states:
  - expired: "expired" card + "still interested? andy@superbadmedia.com.au"
  - withdrawn: "no longer active" card
  - superseded: gentle redirect card to the new token URL
  All three: no scroll-snap, no payment UI, no acceptance.
```

## 4. Skill whitelist

- `systematic-debugging` — state-machine transitions are error-prone
- `code-review` — supersede txn must be atomic
- `superbad-brand-voice` — card copy (wind-down moments)

## 5. File whitelist

- `lib/quote-builder/supersede.ts` — NEW — txn that forks + transitions on send
- `lib/quote-builder/withdraw.ts` — NEW — single-status transition + cancel pending tasks
- `lib/quote-builder/transitions.ts` — EDIT — add `supersede()` + `withdraw()` helpers if shape differs from existing `transitionQuoteStatus`
- `app/lite/quotes/[token]/page.tsx` — EDIT — branch on status: sent/viewed → full page, expired → expired card, withdrawn → no-longer-active card, superseded → redirect card
- `app/lite/quotes/[token]/_cards.tsx` (or co-located) — NEW — three alt-state card components
- `app/api/quotes/[id]/edit/route.ts` — NEW — server action forking to new draft (if not already wired in QB-2b)
- `app/api/quotes/[id]/withdraw/route.ts` — NEW — server action
- `lib/db/schema/quotes.ts` — EDIT only if `superseded_by_quote_id` / `superseded_at` / `withdrawn_at` columns missing (grep first — likely already in migration 0002)
- `tests/qb7-supersede.test.ts` — NEW
- `tests/qb7-withdraw.test.ts` — NEW
- `tests/qb7-public-cards.test.ts` — NEW (status → card rendering)
- `sessions/qb-7-handoff.md` — NEW
- `sessions/qb-8-brief.md` — NEW (per G11.b)

## 6. Settings keys touched

- **Reads:** none new (no autonomy thresholds needed)
- **Seeds (new keys):** none

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `transitionQuoteStatus` helper exists — `grep "export .*transitionQuoteStatus" lib/quote-builder/transitions.ts`
- [ ] Seven statuses in QuoteStatus enum — `grep "superseded\|withdrawn" lib/db/schema/quotes.ts`
- [ ] `supersedes_quote_id` column on quotes table — `grep "supersedes_quote_id" lib/db/schema/quotes.ts`
- [ ] `superseded_by_quote_id` + `superseded_at_ms` + `withdrawn_at_ms` — same grep (if missing → G1 stop, add migration within-session with a feature-flag gate)
- [ ] Public quote page exists — `ls app/lite/quotes/[token]/page.tsx`
- [ ] `scheduled_tasks.status` supports 'skipped' — `grep "skipped" lib/db/schema/scheduled-tasks.ts`
- [ ] Activity-log kinds `quote_superseded` + `quote_withdrawn` exist — `grep "quote_superseded\|quote_withdrawn" lib/db/schema/activity-log.ts`

## 8. Rollback strategy (G6)

`feature-flag-gated` — new kill-switch `quote_builder.supersede_withdraw_enabled` (default `true` once tests green, but flip to `false` if production issue). Public cards ride behind the status read — read is non-destructive, no flag needed; writes (supersede / withdraw actions) gated.

## 9. Definition of done

- [ ] `supersede(quoteId)` + `withdraw(quoteId)` helpers atomic in one txn each
- [ ] Old quote's pending `scheduled_tasks` rows flip to `status='skipped'` within the same txn
- [ ] New quote (supersede path) inherits payload structure from old; new token; fresh scheduled tasks enqueued on send
- [ ] Public URL cards render correctly for each of: expired / withdrawn / superseded (superseded card links to new token URL)
- [ ] Attempted acceptance on non-sent status returns 409 with clear message
- [ ] Activity log: `quote_superseded` (meta: old_quote_id, new_quote_id) + `quote_withdrawn` (meta: reason?)
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green (target ~610+ tests)
- [ ] `npm run build` → clean
- [ ] Dev server boots on :3001, `/lite/quotes/<token>` renders correct card for each alt state
- [ ] G10 mockup parity for three card states (screenshots in handoff)
- [ ] **G10.5 external-reviewer gate** — PASS or PASS_WITH_NOTES
- [ ] **Memory-alignment declaration** in handoff
- [ ] G0 → G12 clean handoff written + qb-8 brief authored in same commit (G11.b)

## 10. Cross-spec / carry-forward

**Reviewer notes carried from QB-6 (address here or log):**
1. `expires_at_ms` column semantics — `handleQuoteExpire` currently overwrites it with "actual" expiry time. QB-7 touches the quote state columns and public page (which reads `expires_at_ms`) — resolve: either add a separate `expired_at_ms` column, or document that `expires_at_ms` = actual on terminal status. **Recommendation:** add `expired_at_ms` column; keep `expires_at_ms` meaning "scheduled expiry".
2. Drift-check `fail_redraft` slug in `handle-quote-reminder-3d.ts` — not acted on. Either rename `fail_observed` or add a single-redraft retry. **Recommendation:** rename (cheap, truthful); redraft loop is a v1.1 improvement.

**Kill-switch inventory at session start:** confirm `invoicing_manual_cycle_enqueue_enabled` still default `false` (BI-1 owns the flip).

## 11. Notes for qb-8 brief writer (G11 extension)

QB-8 = early-cancel skeleton (data shape only). After QB-7:
- Supersede/withdraw patterns are the template QB-8 follows for terminal-state transitions
- `subscription_state` enum already lives (qb-subs added `past_due`); QB-8 will add early-exit rows via `pending_early_exit` → `cancelled_early_exit` transitions on deals
- Scheduled-task handlers `subscription_pause_resume*` are still stubbed — QB-8 may wire them or punt to Client Portal wave (recommend punt; QB-8 is data shape only per BUILD_PLAN)
- No UI in QB-8 (Client Portal wave owns surfaces)

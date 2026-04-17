# `LG-6` — Lead Gen warmup ramp — Session Brief

> **Pre-compiled by LG-5 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `LG-6`
- **Wave:** `13 — Lead Generation` (6 of 10)
- **Type:** `FEATURE`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `small`
- **G0.5 input budget estimate:** ~10k tokens (brief + excerpts + last 2 handoffs). Well under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — Warmup ramp schedule §10.1

Source: `docs/specs/lead-generation.md` §10.1

```
Warmup ramp (non-overrideable, 4-week):
  Days  1–7:  5 sends/day
  Days  8–14: 10 sends/day
  Days 15–21: 15 sends/day
  Days 22–28: 20 sends/day
  Day  29+:   30 sends/day

"Day" = calendar day from started_at. The cap resets at midnight AEST.
```

### Excerpt 2 — enforceWarmupCap() contract §10.2

Source: `docs/specs/lead-generation.md` §10.2

```typescript
// lib/lead-gen/warmup.ts
export async function enforceWarmupCap(): Promise<WarmupCapResult>

// Returns:
// { cap: number; used: number; remaining: number; can_send: boolean }
// cap = ramp cap for today (based on days since started_at)
// used = sent_today from resend_warmup_state
// remaining = cap - used
// can_send = remaining > 0

// MUST be read-only — no DB writes. The orchestrator calls it at step 1.
// If resend_warmup_state has no row (id='default'), return { cap: 5, used: 0, remaining: 5, can_send: true }
// (first-run safe default — day 1 cap).
```

### Excerpt 3 — resend_warmup_state schema (from LG-1)

Source: `lib/db/schema/resend-warmup-state.ts`

```
Table: resend_warmup_state (single row, id='default')
  started_at          timestamp_ms  — warmup start date
  current_week        integer       — week number (1-based, informational)
  daily_cap           integer       — current day cap (maintained by a separate mutator)
  sent_today          integer       — emails sent today (reset by a separate mutator)
  sent_today_reset_at timestamp_ms  — when sent_today was last reset
  manual_override     boolean       — if true, warmup ramp is bypassed (future use)
```

### Excerpt 4 — Stub to replace

Source: `lib/lead-gen/warmup.ts` (LG-4 output, grep-verifiable)

```
// TODO: LG-6 will implement real warmup ramp
return { cap: 10, used: 0, remaining: 10, can_send: true };
```

---

## 2a. Visual references

None — `FEATURE` type, no UI surface.

---

## 3. Acceptance criteria

```
LG-6 is done when:

1. lib/lead-gen/warmup.ts exports:
   - WarmupCapResult interface (unchanged from stub)
   - enforceWarmupCap(): Promise<WarmupCapResult>
     - Reads resend_warmup_state row (id='default') via db
     - Computes day count from started_at to now (UTC calendar days)
     - Maps day count to ramp cap: 1-7→5, 8-14→10, 15-21→15, 22-28→20, 29+→30
     - Returns { cap, used: sent_today, remaining: cap - used, can_send: remaining > 0 }
     - If no row exists: returns { cap: 5, used: 0, remaining: 5, can_send: true }
     - Read-only (no INSERT/UPDATE)

2. tests/lead-gen/lg6-warmup.test.ts passes:
   - No row → returns day-1 default (cap: 5, used: 0, remaining: 5, can_send: true)
   - Day 1 (0 days elapsed) → cap 5
   - Day 7 (6 days elapsed) → cap 5
   - Day 8 (7 days elapsed) → cap 10
   - Day 14 (13 days elapsed) → cap 10
   - Day 15 (14 days elapsed) → cap 15
   - Day 22 (21 days elapsed) → cap 20
   - Day 29 (28 days elapsed) → cap 30
   - Day 60 (59 days elapsed) → cap 30
   - sent_today = 8, cap = 10 → remaining = 2, can_send = true
   - sent_today = 10, cap = 10 → remaining = 0, can_send = false
   - sent_today = 15, cap = 10 → remaining clamped to 0, can_send = false

3. npx tsc --noEmit → 0 errors
4. npm test → green
5. npm run build → clean
6. npm run lint → clean
```

---

## 4. Skill whitelist

None required — DB read, no external calls.

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/warmup.ts` — edit — replace stub with real ramp logic
- `tests/lead-gen/lg6-warmup.test.ts` — new

---

## 6. Settings keys touched

- **Reads:** none — warmup ramp is hard-coded per spec §10.1 ("non-overrideable")
- **Seeds:** none

---

## 7. Preconditions (G1)

- [ ] `lib/lead-gen/warmup.ts` exists with TODO stub — verify: `grep "TODO: LG-6" lib/lead-gen/warmup.ts`
- [ ] `lib/db/schema/resend-warmup-state.ts` exports `resendWarmupState` table — verify: `grep "resendWarmupState" lib/db/schema/resend-warmup-state.ts`
- [ ] `npx tsc --noEmit` passes before starting (carry-forward from LG-5)

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — single helper file edit, no migrations. Rollback = `git revert`.

---

## 9. Definition of done

- [ ] `lib/lead-gen/warmup.ts` enforceWarmupCap reads from DB with real ramp
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10.5 fidelity grep: PASS
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-7)

LG-7 is the Lead Generation admin UI:
- Lead candidates table view (qualified_track, scores, business info)
- Run history view (lead_runs table)
- DNC management (add/remove domain/email blocklist entries)
- Manual run trigger ("Run now" button → POST /api/cron/lead-gen-daily with run_now trigger)
- Key spec reference: `docs/specs/lead-generation.md` §8 (admin surfaces)

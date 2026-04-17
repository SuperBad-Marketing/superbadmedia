# `LG-10` — Lead Gen approval queue UI + autonomy state machine — Session Brief

> **Pre-compiled by LG-9 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `LG-10`
- **Wave:** `13 — Lead Generation` (10 of 10, **wave-closing session**)
- **Type:** `UI`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium-large`
- **G0.5 input budget estimate:** ~28k tokens (brief + spec excerpts + mockup excerpts + last 2 handoffs). Under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — Approval queue surface §9.1

Source: `docs/specs/lead-generation.md` §9.1

```
### 9.1 The queue surface

One scrollable list, newest first, across both tracks. Each row:

  Acme Co — Retainer · score 78 · first touch
  Subject: Thought you'd find this useful
  "Saw your café's been running that lamington ad for..."

  [Approve & Send]  [Edit]  [Nudge]  [Reject]

Row states:
- Default: green Approve button, clickable
- Autonomy active for this row's track: row shown with `auto-send in 15m`
  countdown pill instead of Approve button — Andy can still Reject to pull it back
- Drift flagged: amber warning pill
- Email inferred: small `email: inferred` tag

Track filter chips sit above the list (All / Retainer / SaaS).
No sorting controls in v1 — newest first is the only order.
```

### Excerpt 2 — Autonomy state machine §9.2

Source: `docs/specs/lead-generation.md` §9.2

```
### 9.2 Autonomy graduation state machine

Per track. States:
1. `manual` — default. Every draft needs explicit Approve click.
   Streak counter tracks consecutive clean approvals.
2. `probation` — unlocked after clean_approval_streak ≥ graduation_threshold (default 10).
   Drafts queued for auto-send with 15-minute delay. Probation lasts probation_threshold
   drafts (default 5).
3. `auto_send` — after completing probation without intervention.
4. `circuit_broken` — demotes to manual, resets streak. Must manually approve ≥10 drafts
   to re-graduate.

Clean vs non-clean approval:
- Clean: approval_kind = 'manual' with zero edits to draft body or subject.
- Non-clean: any edit, nudge regen, or rejection. Resets streak.

Maintenance standard:
- Rolling window of last 20 outreach_sends per track.
- Required clean_approval_rate ≥ maintenance_floor_pct (default 80%).
- Below floor → demote from auto_send to manual.

### 9.3 Circuit breakers (handled by Resend webhooks, not this UI)

Auto-demote to circuit_broken on: hard bounce from auto_send, spam complaint,
unsubscribe within 60s, drift_check_flagged on auto_send send.

### 9.4 Queue surface header

Shows live state:
  Today's run: 3:02am — found 47 → qualified 12 → drafted 5 (warmup cap 5/day)
  SaaS:     auto-send · 3/5 probation · 17 sends rolling 95% clean
  Retainer: manual    · 7/10 toward graduation
  Warmup:   Week 1 · 5/day · 16 days until next ramp

### 9.5 Build-time disciplines for autonomy

- §12.F — Autonomy state transitions live in one function transitionAutonomyState(track, event).
  No direct writes to autonomy_state elsewhere.
- §12.G — Every transition writes to activity_log. No silent flips.
- §12.H — The 15-minute auto-send delay is enforced in the sequence runner, not in the UI.
  Approve = status → 'approved_queued'. Send is NOT called in this session.
```

### Excerpt 3 — `autonomy_state` schema §4.8

Source: `docs/specs/lead-generation.md` §4.8

```
autonomy_state: track (PK, enum saas|retainer), mode (manual|probation|auto_send|circuit_broken
  default manual), clean_approval_streak (int default 0), graduation_threshold (int default 10),
  probation_sends_remaining (int nullable), probation_threshold (int default 5),
  rolling_window_size (int default 20), maintenance_floor_pct (int default 80),
  circuit_broken_at (timestamp_ms nullable), circuit_broken_reason (text nullable),
  last_graduated_at (timestamp_ms nullable), last_demoted_at (timestamp_ms nullable).
```

**Audit footer:**
- `docs/specs/lead-generation.md` §9 — full approval queue + autonomy spec
- `docs/specs/lead-generation.md` §4.8 — autonomy_state schema

---

## 2a. Visual references (UI session)

- `mockup-admin-interior.html` — binding reference for all admin-interior surface styling:
  brand palette, typography, Righteous/BHS headings, DM Sans body, Playfair mutters,
  filter chips, table rows, action buttons, empty states, card treatments.
- `docs/superbad_brand_guidelines.html` — brand palette + typography.
- `docs/superbad_voice_profile.html` — voice for any user-visible copy in the queue UI.

**Admin-interior note (per AUTONOMY_PROTOCOL.md §G0):** the approval queue is a new admin
primitive not yet covered by the shared mockup. If a surface-specific
`mockup-admin-lead-gen-queue.html` doesn't exist, the session may stub one that extends
`mockup-admin-interior.html` with queue-specific wireframe intent (row layout, filter chips,
autonomy header) and cite both in G10 parity check.

---

## 3. Acceptance criteria

```
LG-10 is done when:

1. lib/lead-gen/autonomy.ts exports transitionAutonomyState(track, event):
   - event: 'clean_approve' | 'non_clean_approve' | 'reject' | 'maintenance_demote'
   - Reads autonomy_state row for track (upserts if missing)
   - Applies state transitions per §9.2 rules
   - Writes activity_log row per §12.G (kind: 'autonomy_graduated' | 'autonomy_demoted')
   - Returns updated autonomy state row
   - Gated behind lead_gen_enabled kill-switch

2. Server actions for queue management (app/lite/admin/lead-gen/actions.ts updated):
   - approveDraft(draftId): sets outreach_drafts.status = 'approved_queued',
     approval_kind = 'manual', approved_at = now(), approved_by = session.user.id
     then calls transitionAutonomyState(track, 'clean_approve')
   - rejectDraft(draftId): sets status = 'rejected',
     calls transitionAutonomyState(track, 'non_clean_approve' equivalent or 'reject')

3. Queue UI at /lite/admin/lead-gen — new tab or section "Approval Queue":
   - Lists outreach_drafts where status = 'pending_approval', newest first
   - Each row shows: company name, track chip, score, touch kind, subject preview,
     body preview (2 lines), [Approve] [Reject] buttons
   - Filter chips: All / SaaS / Retainer
   - Empty state voiced correctly
   - Motion: houseSpring on row enter/exit, tab transitions, filter chip switches

4. Queue header showing:
   - Last run stats (from most recent lead_runs row): found → qualified → drafted
   - Per-track autonomy state (mode + streak/threshold)

5. Tests:
   - transitionAutonomyState: manual → probation at threshold, streak reset on non-clean,
     probation → auto_send, maintenance demote from auto_send

6. npx tsc --noEmit → 0 errors
7. npm test → green
8. npm run build → clean
9. npm run lint → clean
10. G10: dev server walk of /lite/admin/lead-gen queue tab — happy path + empty state
11. G10.5: external reviewer sub-agent verdict PASS or PASS_WITH_NOTES
```

---

## 4. Skill whitelist

- `drizzle-orm` — update outreach_drafts + read autonomy_state
- `framer-motion` — houseSpring animations on queue rows + tab transitions
- `tailwind-v4` — admin-interior surface styling

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/autonomy.ts` — new — transitionAutonomyState()
- `app/lite/admin/lead-gen/actions.ts` — edit — add approveDraft, rejectDraft
- `app/lite/admin/lead-gen/QueueTab.tsx` — new — approval queue UI component
- `app/lite/admin/lead-gen/page.tsx` — edit — add Queue tab alongside Runs tab
- `tests/lead-gen/lg10-autonomy.test.ts` — new

---

## 6. Settings keys touched

- **Reads:** `lead_gen_enabled` (kill-switch)
- **Seeds:** none (autonomy thresholds live in autonomy_state row defaults, not settings)

---

## 7. Preconditions (G1)

- [ ] `lib/db/schema/autonomy-state.ts` exports `autonomyState` — verify: `grep "export const autonomyState" lib/db/schema/autonomy-state.ts`
- [ ] `lib/db/schema/outreach-drafts.ts` exports `outreachDrafts` with `status` column — verify: `grep "status" lib/db/schema/outreach-drafts.ts`
- [ ] `lib/db/schema/lead-candidates.ts` exports `leadCandidates` — verify: `grep "export const leadCandidates" lib/db/schema/lead-candidates.ts`
- [ ] `app/lite/admin/lead-gen/actions.ts` exists — verify: `ls app/lite/admin/lead-gen/actions.ts`
- [ ] `app/lite/admin/lead-gen/page.tsx` exists — verify: `ls app/lite/admin/lead-gen/page.tsx`
- [ ] `lib/kill-switches.ts` exports `lead_gen_enabled` — verify: `grep "lead_gen_enabled" lib/kill-switches.ts`
- [ ] `npx tsc --noEmit` passes before starting

---

## 8. Rollback strategy (G6)

- [x] `feature-flag-gated` — all new code gated behind `lead_gen_enabled` kill-switch. Rollback = flip flag off.

---

## 9. Definition of done

- [ ] `lib/lead-gen/autonomy.ts` exports `transitionAutonomyState` — verify: `grep "export async function transitionAutonomyState" lib/lead-gen/autonomy.ts`
- [ ] `approveDraft` + `rejectDraft` in `app/lite/admin/lead-gen/actions.ts` — verify: `grep "approveDraft\|rejectDraft" app/lite/admin/lead-gen/actions.ts`
- [ ] `app/lite/admin/lead-gen/QueueTab.tsx` exists — verify: `ls app/lite/admin/lead-gen/QueueTab.tsx`
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10: dev server walk — queue tab renders, empty state voiced, filter chips switch
- [ ] G10.5: external reviewer verdict PASS or PASS_WITH_NOTES
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete (incl. Wave 13 close → wave-boundary checkpoint)

---

## 10. Notes for the next-session brief writer (Wave 14 — IF-1)

LG-10 is the **closing session of Wave 13**. Per §G12.5, on successful completion, LG-10 must:
- Write `.autonomy/PAUSED` for the wave-boundary checkpoint.
- Additionally per §G11.b wave handoff, write briefs for **all 5 Wave 14 sessions** (IF-1 through IF-E2E) using BUILD_PLAN.md Wave 14 specs.

If context budget is tight (G3 70%), use the escape hatch:
- Write LG-10 handoff + IF-1 brief only.
- Log which Wave 14 briefs are still owed in the handoff.
- IF-1 session writes the remaining Wave 14 briefs before starting its own work.

Wave 14 key context:
- IF-1: Landing page + questionnaire (SW-2 step-types) + Stripe Payment Element + createDealFromLead()
- IF-2: Calendar booking + confirmation + reminders + shoot-day portal view
- IF-3: Retainer/SaaS offer + synthesis Opus + quote recommendation
- IF-4: Portal-guard recovery + OTT magic-link embedding
- IF-E2E: Playwright E2E — landing → questionnaire → booking → payment (critical flow)
- All specs in `docs/specs/intro-funnel.md`
- IF-E2E is a critical-flow E2E (triggers pause loop per AUTONOMY_PROTOCOL §G9 + §G10 autonomy-loop pause)

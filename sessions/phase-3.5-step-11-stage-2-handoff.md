# Phase 3.5 Step 11 — Stage 2 handoff

**Date:** 2026-04-13
**Phase:** 3.5 — Spec Review (exit gate), Step 11 (end-to-end flow walkthrough)
**Stage:** 2 of 4 — Trial Shoot → Deliverables → Reflection → Retainer-Fit Recommendation

## Scope of Stage 2

Walked the post-shoot arc: shoot completion → Andy's shoot-day notes + Six-Week Plan generation → Pixieset gallery paste → bundled deliverables release → 24h reflection trigger → reflection arc (Q1 safety valve through Q8 synthesis reveal) → retainer-fit recommendation → decision CTA. Five anticipated friction flags surfaced + resolved.

## Flags resolved

### F2.a — Six-Week Plan timing in Intro Funnel arc

**Problem.** Intro Funnel §13 / §15 never narrate where Six-Week Plan generation/release lands. §15.1 fired `deliverables_ready` purely on Pixieset URL paste, not gated on plan approval. Reflection trigger ambiguous as a result.

**Resolution: Option A — bundled release. `deliverables_ready` only fires when both gallery URL pasted AND plan approved; whichever lands second triggers the unified state + single bundled announcement email; reflection clock starts from the bundled transition.**

Andy's note: "We signpost timeframes upfront. The cons are a non-issue."

APPLIED INLINE:
- `docs/specs/intro-funnel.md` §15.1 — bundled release rule + flow diagram + idempotency note + cockpit `intro_funnel_awaiting_bundle` quiet entry.
- `docs/specs/intro-funnel.md` §13.1 — reflection clock starts from bundled transition.
- `docs/specs/intro-funnel.md` §3 step 8 — journey narration rewritten as bundled reveal.
- `docs/specs/intro-funnel.md` §5.1 — state-machine annotation: bundle gate triggers `deliverables_ready`.
- `docs/specs/intro-funnel.md` §4.1 — added `gallery_ready_at`, `plan_ready_at`, `deliverables_ready_at` columns on `intro_funnel_submissions`.
- `docs/specs/intro-funnel.md` §17.2 — added `intro_funnel_awaiting_bundle`, `six_week_plan_viewed`, bundled `deliverables_ready` quiet entries.
- `docs/specs/intro-funnel.md` §24 — content mini-session must produce upfront timeframe signposting copy + bundled announcement email body.
- `docs/specs/six-week-plan-generator.md` §2.6 — bundled gate semantics; this spec stops emitting its own release email; references cockpit awaiting-bundle entry.

LOGGED (downstream consumers):
- `FOUNDATIONS.md` §11.2 — add `deliverables_ready_announcement` email classification.
- `docs/specs/six-week-plan-generator.md` §10.5 — confirm bundled-release path no longer needs `six_week_plan_release` classification.
- `docs/specs/sales-pipeline.md` activity_log.kind enum — add/confirm `gallery_attached`, `intro_funnel_awaiting_bundle`, `six_week_plan_viewed`.
- `docs/specs/daily-cockpit.md` `getWaitingItems()` — acknowledge `intro_funnel_awaiting_bundle` source kind.

### F2.b — First-Login Brand DNA Gate (replaces stub primitive entirely)

**Problem.** §13.3 reflection synthesis + §13.4 retainer-fit prompts read "SuperBad's perpetual Brand DNA context (stubbed before Brand DNA ships)." Word "stubbed" undefined. Synthesis is the most load-bearing Claude generation in Intro Funnel.

**Resolution: Option D (Andy's reframe) — make Brand DNA SuperBad-self profile a hard precondition for the platform being usable. Stub primitive disappears entirely.**

Andy's reframe: "The brand DNA will be completed when I first log into Lite — so it will be available before anything else happens. Worth putting something in place to state that it appears on first login, nothing else is accessible until brand DNA has been completed."

APPLIED INLINE:
- `docs/specs/intro-funnel.md` §13.3 + §13.4 — synthesis + retainer-fit read profile unconditionally; "stubbed before then" wording removed.
- `docs/specs/brand-dna-assessment.md` §11.1 — First-Login Brand DNA Gate spec (middleware behaviour, why-hard-gate rationale, no-stub-anywhere lock, env-var bypass safety net, Phase 4 build-order constraint, onboarding voice direction).
- `FOUNDATIONS.md` §11.8 — First-Login Brand DNA Gate cross-cutting primitive.
- `docs/specs/intro-funnel.md` §18 — removed stub-baseline narration; replaced with gate-guarantee.

LOGGED (downstream + Phase 4):
- `BUILD_PLAN.md` Phase 4 — hard ordering constraint: Brand DNA SuperBad-self slice + gate middleware must build before Intro Funnel synthesis (§13.3 + §13.4), Lead Gen draft generation, Outreach reply intelligence, brand-voice drift checks, Cockpit briefs referencing perpetual voice.
- `INCIDENT_PLAYBOOK.md` Phase 6 — document `BRAND_DNA_GATE_BYPASS=true` env var as recovery path.
- Brand DNA content mini-session — onboarding-route copy ("Lite needs to know who you are…"), single-paragraph framing, motion-treated reveal direction.

### F2.c — Pixieset API capability risk (silent technical lock)

**Resolution: spike moved earlier — Phase 4 prep, before BUILD_PLAN.md is finalised.** Locked silently per technical-decisions discipline.

APPLIED INLINE:
- `docs/specs/intro-funnel.md` §15.3 — Phase 4 prep spike; documented two outcomes (sufficient → inline gallery + Tier-2 reveal; insufficient → on-brand link-out fallback in design system + house-spring motion); contingency mop-up brainstorm if spike fails.

LOGGED:
- `BUILD_PLAN.md` Phase 4 prep — 1-session Pixieset API spike.
- Contingent Phase 4 mop-up — Pixieset alternatives evaluation if spike fails.

### F2.d — Safety-valve interaction with retainer-fit

**Problem.** §13.4 fires retainer-fit "after reflection completes." Spec silent on whether safety-valve-truncated reflection still counts.

**Resolution: Option B (with hard constraint) — generate retainer-fit anyway, including on safety-valve path; add explicit lock that retainer-fit is internal-only (Andy cockpit + Pipeline panel only) and never reaches the prospect via any channel.**

Andy's note: "So long as nothing client-facing goes out. B is still the right answer. They will just be marked as a poor fit."

APPLIED INLINE:
- `docs/specs/intro-funnel.md` §13.4 — safety-valve branch (prompt receives `safety_valve_triggered` flag + free-text; biased to honour negative signal); hard lock that retainer-fit is internal-only with build-time discipline (`// internal-only` accessor JSDoc + ESLint marker); cockpit ordering note.
- `docs/specs/intro-funnel.md` §0/§18 — fixed mis-categorisation of retainer-fit as "customer-facing" output.

LOGGED:
- `FOUNDATIONS.md` §11 — add build-time discipline #N: internal-only marker pattern (foundation session implements lint rule or comments-as-discipline).
- Sales Pipeline / Trial Shoot panel — "Regenerate retainer-fit" admin action.
- Intro Funnel content mini-session — `retainer-fit.ts` prompt must explicitly handle safety-valve branch.

### F2.e — `reflection_delay_hours_after_deliverables` registered in settings

**Problem.** Phase 3.5 step 7a discipline says every autonomy threshold lives in `settings`; this one was on `intro_funnel_config` (singleton table).

**Resolution: migrate to `settings` table.** Locked silently (technical discipline call).

APPLIED INLINE:
- `docs/settings-registry.md` — added new "Intro Funnel" section + `intro_funnel.reflection_delay_hours_after_deliverables` (default 24, integer); flagged broader Intro Funnel registry sweep owed in Batch C step 15.
- `docs/settings-registry.md` totals updated.
- `docs/specs/intro-funnel.md` §4.1 — marked `intro_funnel_config.reflection_delay_hours_after_deliverables` column as deprecated; Phase 5 build session drops it.

LOGGED:
- `docs/specs/intro-funnel.md` Batch C step 15 sweep — register remaining Intro Funnel autonomy thresholds (abandon cadence, advance notice, per-week cap, reschedule limit, refund window, SMS quiet hours, email quiet hours, shoot duration).

## Carryforward from Stage 1 (still pending)

**Portal-guard primitive + magic-link-in-every-email.** Logged in PATCHES_OWED under Stage 1 friction resolutions (F1.a). Plan: apply at Stage 4 closure rather than mid-walkthrough. They're whole-arc concerns, not Stage 2-specific.

## Files changed

- `docs/specs/intro-funnel.md` — F2.a (§3, §4.1, §5.1, §13.1, §15.1, §17.2, §24), F2.b (§13.3, §13.4, §18), F2.c (§15.3), F2.d (§0, §13.4, §18), F2.e (§4.1).
- `docs/specs/six-week-plan-generator.md` — F2.a (§2.6).
- `docs/specs/brand-dna-assessment.md` — F2.b (§11.1).
- `FOUNDATIONS.md` — F2.b (§11.8).
- `docs/settings-registry.md` — F2.e (new Intro Funnel section + totals).
- `PATCHES_OWED.md` — Stage 2 sub-section added with all resolutions (applied + owed).
- `SESSION_TRACKER.md` — Next Action updated to Stage 3.

## What the next session should know

1. **Stage 3 starts: Six-Week Plan Generator flow.** Prospect portal receipt + revision flow + non-converter 60-day lifecycle + plan-to-active_strategy migration on retainer conversion. Anticipated friction:
   - **Plan-as-PDF moments** — §6.5 PDF takeaway is the only persistent artefact for non-converters; check end-to-end download/render path against bundled-release wording from F2.a.
   - **Revision-resolution UX** — §7 says one revision per plan; what does the prospect see when Andy hand-rejects ("explained without regen") vs regenerates? Spec ambiguous on the prospect-side notification.
   - **Day-60 archive copy** — §8.4 sends final email with PDF; must honour brand voice + the "your plan stays yours" framing locked in §3 step 14.
   - **Plan migration on retainer conversion** — §8.1 + §8.2 refresh-review covers Andy's path; check that the prospect-side Client Management portal doesn't double-show the plan during the migration window.
   - **Daily Cockpit waiting-items contract** — §12.2 lists 4 new source kinds for `getWaitingItems()`; verify each is acknowledged by `daily-cockpit.md`'s consuming side.

2. **F2.b build-order constraint cascades into Stage 3.** Six-Week Plan Generator §11 prompts read context that overlaps with Brand DNA. If Six-Week Plan ships before Brand DNA SuperBad-self path lands, the gate prevents Andy from accessing the plan-generation surface in the first place — so the constraint enforces itself. Worth confirming during Stage 3 that no Six-Week Plan code path reads Brand DNA on a non-admin route (e.g. prospect-side portal plan rendering).

3. **F2.a bundled gate affects Six-Week Plan §2.6.** Already patched, but Stage 3 should re-walk §2.6 in the context of the rest of §6 (Prospect portal surface) to make sure the cascading consequences are coherent — e.g. §6.1 pre-activation state copy may need to acknowledge that the gallery is also live (or just-arrived) on first portal visit.

4. **Context load.** Stage 2 read: Intro Funnel §3, §4.1, §5.1, §13–§17, §24; Six-Week Plan §2, §8, §9, §12; Brand DNA Assessment §11; FOUNDATIONS §11; Phase 3.5 step 7a settings registry; full PATCHES_OWED. Stage 3 should start by reading Six-Week Plan §2 (full), §6 (prospect portal — full), §7 (revision flow), §8 (retainer migration + non-converter expiry), §10 (data model — for any column gaps), §12 (cross-spec contracts — verify daily-cockpit consumption).

## Stage progress

- ~~Stage 1 — Entry → Booking — DONE 2026-04-13 (`phase-3.5-step-11-stage-1-handoff.md`)~~
- ~~Stage 2 — Trial Shoot → Reflection → Retainer-Fit — DONE 2026-04-13 (this handoff)~~
- **Stage 3** — Six-Week Plan Generator (prospect portal receipt, revision, 60-day lifecycle, retainer migration) — next.
- Stage 4 — Retainer conversion (Quote Builder handoff, Stripe Checkout, Client Management portal migration, Onboarding + Brand DNA unlock). Stage 4 closure also folds in remaining F1.a portal-guard + magic-link-in-emails patches.

After Stage 4: Batch C (steps 8, 9, 12, 13, 15) → Stop 14 → Stop 16 (Phase 3.5 exit approval).

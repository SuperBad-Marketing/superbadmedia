# Phase 4 — Final Handoff

**Date:** 2026-04-13
**Status:** Phase 4 CLOSED. All three artefacts locked and committed.
**Next phase:** Phase 5 — Build Execution. First session is Wave 0 P0 (Pixieset spike).

---

## What Phase 4 produced

Three artefacts, one concern, one commit:

1. **`BUILD_PLAN.md`** (landed in prior partial session) — 23 waves, ~150 atomic build sessions, dependency-strict ordering with aggregators last, Foundation A/B split, Wave 0 Pixieset spike. Includes:
   - §C consolidated cron table (60+ scheduled jobs)
   - §R shared-primitive registry (owner wave → consumers)
   - §E critical-flow E2E assignments (5 mandatory suites)
   - Rollback strategy declared per wave
2. **`AUTONOMY_PROTOCOL.md`** (this session) — 13 non-skippable per-session gates + operating rules:
   - **G0** session kickoff (brief + last 2 handoffs + spec + skill whitelist + tier match)
   - **G1** preflight precondition verification (catches "prior session crashed before commit")
   - **G2** scope discipline (file whitelist; log stray concerns to PATCHES_OWED)
   - **G3** mid-session 70% context checkpoint → interim handoff + fresh session
   - **G4** settings-literal grep (autonomy-sensitive paths → `settings.get()`)
   - **G5** universal motion review (every state change = `houseSpring`; reduced-motion parity)
   - **G6** rollback declaration (migration / flag / git-revertable)
   - **G7** end-of-session artefact verification
   - **G8** typecheck + tests always
   - **G9** E2E on 5 critical flows (Intro Funnel booking, Quote Accept, Invoice Pay, SaaS Signup, Portal Auth)
   - **G10** manual browser check (UI sessions)
   - **G11** handoff note
   - **G12** tracker update + auto-commit
   - **Operating rules:** model tiering via `/quick /normal /deep` (no auto-switch), Opus-quota depletion → **pause** (not silent degrade), cache-aware batching (5-min TTL), pre-compiled session briefs, per-session skill whitelist, sub-agent offload for discovery, verification-gate discipline, kill-switches as safety net, token-budget alerts, observability via Sentry + `reportIssue()` + `external_call_log`, anti-pattern list, pause-for-Andy conditions.
3. **`LAUNCH_READY.md`** (this session) — 12-section Phase 6 pre-launch gate checklist:
   - §1 Infrastructure (DNS, TLS, Coolify, backups + **restore verification mandatory**, 7yr retention)
   - §2 Email (SPF/DKIM/DMARC, warmup, quiet window, suppression gate)
   - §3 Payments (Stripe live keys, webhook, branded portal, live-mode invoice+cancel cycles)
   - §4 Auth (magic link, cookie flags, portal guards, `BRAND_DNA_GATE_BYPASS=false`)
   - §5 Compliance (privacy, ToS, cookie consent geo-gated, signup acceptance, DSR email, Spam Act, ATO)
   - §6 Observability (Sentry, report-issue, cost alerts, Observatory)
   - §7 Kill-switches (all wired + tested; risky ones start disabled)
   - §8 Critical flows E2E in production
   - §9 Synthetic client dry-run (full arc from prospect → cancel)
   - §10 Shadow period readiness (Andy's own account + calendar + kill-switch manual)
   - §11 Documentation (INCIDENT_PLAYBOOK + internal `/lite/admin/docs` + GHL shutdown plan)
   - §12 Final sign-off (Andy visceral-feel walkthrough + launch SHA recorded)

## Key decisions locked in this session

- **13-gate protocol numbering (G0–G12).** Linear, ordered, every gate fires every session. Aggregators (Observatory, Daily Cockpit) get the same discipline as feature sessions — no exemptions.
- **Plan-level Opus → Sonnet fallback behaviour:** default to **pause**, not silent degrade. Only explicitly-tagged `sonnet-safe` sessions continue during Opus-quota windows. Prevents a compressed-context Sonnet session silently shipping what an Opus brief specced.
- **Motion review is universal (G5).** Per memory `feedback_motion_is_universal` — every state change in every session's diff is checked for `houseSpring`. Not just animation-heavy features.
- **Settings-literal grep (G4) runs per-session and again in Wave 23.** Two layers of the same discipline — per-session catches it in code that just landed; final audit catches anything that slipped through. Wave 23 is the net, not the primary line.
- **LAUNCH_READY backup verification is a **restore**, not just a backup run.** Per FOUNDATIONS reality-check — untested backups don't exist. Explicit in §1.
- **Kill-switch default state policy:** outreach send + scheduled tasks ship **disabled** in production; Andy flips them on deliberately during shadow period. Shadow = zero-stakes rehearsal, not live-fire.
- **LAUNCH_READY §9 dry-run is non-skippable** before DNS cutover. Full synthetic client arc (prospect → cancel) through the real production stack, with kill-switches selectively flipped to prevent real outbound. Catches integration failures unit + E2E miss.

## Why split from the partial session

Per mid-session 70% checkpoint discipline (the same rule G3 codifies): `BUILD_PLAN.md` was the densest synthesis in Phase 4. Drafting AUTONOMY_PROTOCOL + LAUNCH_READY in the same conversation risked drift on both. Splitting preserved context headroom for both artefacts. The working tree stayed uncommitted across the split intentionally — Phase 4 is one concern, commits as a single unit.

## Artefact verification

- [x] `BUILD_PLAN.md` exists at repo root, 715 lines (from partial handoff).
- [x] `AUTONOMY_PROTOCOL.md` exists at repo root, written this session.
- [x] `LAUNCH_READY.md` exists at repo root, written this session.
- [x] `SESSION_TRACKER.md` 🧭 Next Action updated to Phase 5 Wave 0 P0.
- [x] `SESSION_TRACKER.md` phase roadmap — Phase 3 / 3.5 / 4 ticked.
- [x] Session log rows added for the partial session + this closing session.
- [x] `sessions/phase-4-handoff.md` (this file) written.

## What Phase 5 starts on

**Wave 0 — P0 Pixieset spike.** See `BUILD_PLAN.md` Wave 0.

- ~4h timebox feasibility probe against Pixieset API / webhook docs.
- Deliverable: `sessions/p0-pixieset-spike-handoff.md` with one of:
  - (A) Pixieset supports deliverables-ready push → Intro Funnel proceeds as specced, no patch owed;
  - (B) no push support → Intro Funnel spec patch owed (polling or manual trigger); feed back into BUILD_PLAN Wave 14 before A1 starts.
- Not a code session — API reading + written recommendation. No skill whitelist required; model tier `/normal`.

After P0: Wave 1 A1 — Project initialisation (`/normal`, Sonnet tier). A1 → A2 → A3 → ... → A8 per BUILD_PLAN.md sequence. Foundation A must complete before Foundation B; Foundation B must complete before Wave 3.

## Open threads for Phase 5

- **Foundation A must add the A7/A8/B1/B3-owned settings keys to the A5 seed registry.** Registry currently at 60 keys; growth to ~72 after Foundation sessions. AUTONOMY_PROTOCOL G4 enforces that no feature code ships with autonomy-sensitive literals; the seed migration must be current at each wave.
- **Andy action required before Phase 5 starts (not blocking P0):** manual Stripe account prep — live keys will be needed at Wave 6 (QB) earliest, Wave 23 launch latest. LAUNCH_READY §3 tracks it as an Andy-only row.
- **PATCHES_OWED.md Pending rows** are all slotted into named waves in BUILD_PLAN.md. No orphans entering Phase 5.

## Handoff-loading order for next session

Per AUTONOMY_PROTOCOL G0:
1. `CLAUDE.md`
2. `START_HERE.md` § Phase 5
3. `AUTONOMY_PROTOCOL.md` (every gate applies)
4. `BUILD_PLAN.md` Wave 0
5. This handoff + `sessions/phase-4-partial-handoff.md` (last 2 handoffs)
6. `docs/specs/intro-funnel.md` § Pixieset integration
7. Relevant memory entries (all rows in `MEMORY.md`; load by relevance)

No skills required for P0. Skill whitelist kicks in at A1.

---

**Phase 4 closed 2026-04-13. Phase 5 begins at P0.**

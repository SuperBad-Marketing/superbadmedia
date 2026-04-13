# Phase 3.5 — Exit Handoff

**Date:** 2026-04-13
**Decision:** Andy's explicit Stop 16 exit approval. Phase 3.5 closed. Tracker flipped to Phase 4.

## What Phase 3.5 produced

- **Backward reconciliation pass** — lock-date-filtered diff of every locked spec against all memory entries; retroactive patches applied where brainstorms had surfaced principles after a spec locked.
- **Step 2 + 2a** — cross-spec flag reconciliation and self-containment pass. Every spec is now readable alone; contracts it consumes or refines from other specs are inlined.
- **Batch A** (steps 3, 3a, 3b, 4, 5) — deferred task inventory, `docs/content/` home for content mini-session output, `lib/ai/prompts/` home for prompt files, SCOPE↔specs alignment (4 SCOPE patches applied promoting Branded Invoicing / Intro Funnel / Six-Week Plan Generator / Hiring Pipeline to v1.0), Foundations patch list compiled.
- **Batch B** (steps 6, 7, 7a, 10) — enum audit (`deals.won_outcome` extended), shared-primitive registry compiled (47 prompts across 14 specs indexed in `lib/ai/prompts/INDEX.md`), `docs/settings-registry.md` seeded (60 keys at v1.0), canonical subscription state machine in `FOUNDATIONS.md` §12 (13 states, 2 billing paths, transition owners, `activity_log` rule).
- **Batch C** (steps 8, 9, 12, 13, 15) — `FOUNDATIONS.md` §13 Glossary added (+ 22 literal replacements across 6 specs), Observatory §4.2 registered-jobs inventory rewritten against prompt INDEX slugs, GHL cutover assumption confirmed consistent across 21 specs, legal/compliance sweep surfaced 6 orphan patches owed (logged to PATCHES_OWED), final literal-grep clean.
- **Step 11** — full customer-arc walkthrough in 4 stages. Closed frictions F1.a–d, F2.a–e, F3.a–f, F4.a–c. Notable closures: F1.a portal-guard primitive + magic-link-in-every-email (new `portal_magic_links` table; new `portal.magic_link_ttl_hours` + `portal.session_cookie_ttl_days` keys); F4.b Brand DNA gate-first → bartender-led kickoff on clear (new `retainer_kickoff_bartender_said_at` column + 2 `activity_log` kinds); F4.c Onboarding welcome-screen branching by entry path.
- **Stop 14** — 4 legal/compliance product-judgement questions resolved (option A on each): L1 legal-pages owner = standalone mini-spec `docs/specs/legal-pages.md`; L2 DSR = email-only at v1.0 + 30-day commitment; L3 cookie consent = geo-gated GDPR banner for EU IPs + universal footer link, rolled into legal-pages spec; L4 signup acceptance = single tickbox + inline links + two timestamps, pattern applied to both SaaS signup and Quote Builder acceptance.

## What Phase 4 inherits

**Authoritative inputs:**
- 21 locked specs in `docs/specs/` (20 Phase 3 + 1 implicit legal-pages spec owed, per Stop 14 L1).
- `FOUNDATIONS.md` with §11 cross-cutting primitives, §12 subscription state machine, §13 glossary.
- `docs/settings-registry.md` — 60 keys across Finance / Wizards / Plan / Portal / Hiring. Foundation session seeds from this file.
- `lib/ai/prompts/INDEX.md` — 47 prompt slugs across 14 specs; Observatory's registered-jobs inventory already reconciled to this.
- `PATCHES_OWED.md` **Pending** section — authoritative list of patches Phase 4 must slot into build sessions (foundation session, per-spec build sessions, or the final Settings Audit Pass). No Pending row is a blocker for Phase 4 starting — each names a clear build-session gate.

**Known Phase 4 decisions:**
1. `docs/specs/legal-pages.md` drafting — Phase 3 backfill mini-session OR fold into Phase 4's docs pass. Recommend the latter.
2. Foundation-session split — list in `START_HERE.md` § Phase 4 step 4 has grown. Likely split into foundation-A (auth + DB + design-system route + settings + permissions + env/secrets + kill-switches) and foundation-B (observability + backups + credential vault + cookie consent + legal-pages drafting).
3. Build-session ordering — recommend foundation-A → foundation-B → 5 critical-flow specs (intro-funnel, brand-dna-assessment, quote-builder, branded-invoicing, saas-subscription-billing) → cross-cutting surfaces (daily-cockpit, unified-inbox, observatory) → finish tier (content-engine, setup-wizards, client-context-engine, task-manager, client-management, etc.) → final Settings Audit Pass.
4. AUTONOMY_PROTOCOL.md must be written alongside BUILD_PLAN.md (memory: `project_autonomy_protocol_phase_4.md`). Non-skippable per-session gates: motion review, rollback, settings-literal sweep, preflight precondition verification, mid-session context budget checkpoint, minimum-necessary skill loading, end-of-session artefact verification, typecheck + test gates always, E2E on 5 critical flows.
5. LAUNCH_READY.md must also be written in Phase 4 per `START_HERE.md` § Phase 4 step 12.

**Settings registry counts at Phase 3.5 exit:** 60 keys (Finance/Wizards/Plan/Portal/Hiring plus Stop 14 additions implied — cookie-consent keys TBD in foundation session).

## Reality-check notes for Phase 4

- **Foundation session is the single biggest Phase 5 risk.** It's the most cross-cutting session in the plan, and the one with the least spec-level prior decision-making. Split if scope looks borderline — a foundation that ships half-baked poisons every session downstream.
- **Settings Audit Pass at the end is the net.** If it catches literals, they're caught. If it can't, the discipline failed mid-stream.
- **Critical-flow E2E tests gate four mandatory sessions** — trial shoot booking (intro-funnel), quote accept (quote-builder), invoice pay (branded-invoicing), subscription signup (saas-subscription-billing), portal auth (client-management). Phase 4 must explicitly name E2E suites for each.
- **No memories updated at exit.** Phase 3.5 closure is administrative — the learnings from Phase 3.5 are already captured as memories written earlier in the phase (motion-is-universal, passive-vs-active channels, settings table architecture, shared-primitive discipline, etc.) or encoded into specs/FOUNDATIONS/PATCHES_OWED.

## Commit trail for Phase 3.5

Most recent commits (latest first):
- `c24d493` — Stop 14 (this session)
- `8d8354f` — Batch C
- `12987e5` — Step 11 Stage 4 + F1.a closure
- `2a0d3e2` — Admin first-login sequencing lock
- `a382bd0` — Step 11 Stage 3 (Six-Week Plan flow)
- `3757b68` — Step 11 Stage 2 (Trial Shoot → Reflection → Retainer-Fit)
- plus earlier commits for Batch A, Batch B, Step 11 Stage 1, Step 2 / 2a, backward reconciliation.

## Next action

Phase 4 kickoff. First Claude move: read `START_HERE.md` § Phase 4 in full + every file in `docs/specs/` + `FOUNDATIONS.md` in full + `PATCHES_OWED.md` Pending section. Then surface the three named Phase 4 decisions to Andy one at a time (legal-pages drafting placement, foundation-session split, build-session ordering) — each with a recommendation, following brainstorm rules. BUILD_PLAN.md drafting itself is downstream of those three decisions.

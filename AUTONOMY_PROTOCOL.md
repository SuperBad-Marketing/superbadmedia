# AUTONOMY_PROTOCOL.md

**Status:** locked 2026-04-13 (Phase 4)
**Consumed by:** every Phase 5 build session
**Paired with:** `BUILD_PLAN.md` (session inventory), `LAUNCH_READY.md` (Phase 6 gate)

---

## What this document is

Phase 5 runs as hands-off as safely possible. Andy is a non-technical solo founder; he cannot babysit ~150 sessions. This protocol is the set of non-skippable gates and operating rules that every Phase 5 session obeys, so the loop can run unattended without drifting into broken code, blown budgets, or silently bad product.

Two parts:

- **§1 Per-session gates** — the hard checklist each session runs before it's allowed to declare done.
- **§2 Operating rules** — the background discipline (model tiering, context budgets, cache, skills, kill-switches) that keeps the autonomous loop cheap, fast, and recoverable.

If a gate fails: stop, fix root cause, re-run the gate. Never bypass, never `--no-verify`, never "I'll catch it next session".

---

## §1 — Per-session gates (non-skippable)

Every Phase 5 session runs these in order. The handoff note is only written after **every** gate passes.

### G0 — Session kickoff

- Read `sessions/<id>-brief.md` (pre-compiled by Phase 4).
- Read the last 2 handoff notes from `sessions/`.
- Read the spec(s) named in the brief. Do **not** read all 21 specs.
- **If the brief's Type is `UI`:** read every file listed in §2a "Visual references" of the brief. Specs describe *what*; mockups encode *feel*. A UI session that skips the mockup will ship generic styling and fail G10. If §2a is missing from a `UI` brief, stop — patch the brief with the correct mockup reference(s) before proceeding. This is a hard gate, not an optional polish step.
- Load only the skills named in the brief's skill whitelist.
- Confirm the session's model tier matches the current Claude Code model (`/quick` / `/normal` / `/deep`). Mismatch = reset before starting.

### G1 — Preflight precondition verification

Before touching any code, verify every precondition named in the brief exists in the repo:

- Files exist (via Read / `ls`).
- Tables exist (grep the schema).
- Helpers exist (grep `lib/`).
- Settings keys are seeded (grep `docs/settings-registry.md` and the A5 seed migration).
- Env vars declared (grep `.env.example`).

If a precondition is missing: stop. Do not build on a claim a prior handoff made that the repo doesn't back up. Either patch the missing piece in-session (if ≤10% of scope) or reroute to a blocker session and write a handoff explaining the gap. **Catches the "prior session crashed before commit" failure mode.**

### G2 — Scope discipline

- Touch only what the brief's file whitelist names. If a file needs editing that isn't on the whitelist, stop and update the brief first.
- No ambient refactors. No "while I'm here" cleanups. Log unrelated issues to `PATCHES_OWED.md`, don't fix them.
- One concern per commit. If the session accidentally produces two concerns, split into two commits.

### G3 — Mid-session context budget checkpoint (70%)

At approximately 70% of the context window:

- Write an interim handoff at `sessions/<id>-interim.md` covering: progress so far, remaining work, current mental state, any in-flight debugging trail.
- End the session cleanly.
- Schedule a fresh session to continue (brief references the interim handoff as a precondition).

Never push past 70% into hard debugging on a compressed context. Finishing half-done with a clean handoff is always safer than shipping drift.

### G4 — Settings-literal grep gate

Before writing the handoff, grep the session's diff for literals in autonomy-sensitive paths:

- Numeric literals in: review windows, timeouts, thresholds, confidence cutoffs, ramp durations, retry counts, expiry periods, cadences, TTLs, frequencies, caps.
- String literals in: email classifications, state machine transitions, cron expressions, prompt job names.

Any hit = convert to `settings.get(key)` (key must exist in `docs/settings-registry.md`; if not, add a row and patch the seed migration). **No literals ship in autonomy-sensitive code.** The Wave 23 Settings Audit Pass is the net — this gate is the first line.

### G5 — Motion review (universal)

Every state change in the session's diff must be animated with the `houseSpring` preset from A4. No bare `open/close`, no `hidden → visible` without a transition. Check:

- Every menu, overlay, card, tab, modal, drawer, toast.
- Every list insert/remove.
- Every empty-state → populated transition.
- Every loading → success / loading → error transition.

Reduced-motion parity required: `prefers-reduced-motion: reduce` must gracefully degrade without breaking layout. Per memory `feedback_motion_is_universal`.

### G6 — Rollback declaration

The handoff names the session's rollback strategy as exactly one of:

- **migration reversible** — down-migration shipped; rollback = `drizzle-kit migrate:down`.
- **feature-flag-gated** — kill-switch in `settings` or `lib/kill-switches.ts`; rollback = flip the flag.
- **git-revertable, no data shape change** — UI/helper only; rollback = `git revert`.

Anything else = stop, redesign the change until it fits one.

### G7 — End-of-session artefact verification

Before writing the handoff, the session enumerates every artefact it claims to have produced:

- Files created / edited (name each).
- Tables created / altered (name each; grep schema to confirm).
- Migrations written (list filenames; confirm they run clean on a fresh DB).
- Settings rows added (list keys; grep registry + seed).
- Routes added (list URLs; confirm they render).

For each, run `ls` / grep / Read to confirm actually in the repo. Missing artefact = not done.

### G8 — Typecheck + tests

Always:

- `npx tsc --noEmit` → zero errors.
- `npm test` → green.

If either fails: fix root cause. Do not comment-out failing tests. Do not `@ts-expect-error` production types. If the failure is in code the session didn't touch, it's still blocking — either fix or escalate by pausing and writing a handoff explaining the break.

### G9 — E2E on critical flows

If the session touches any of the 5 critical flows, its matching Playwright suite from `BUILD_PLAN.md` §E must pass **against a production-equivalent build** before handoff:

| Flow | Suite |
|---|---|
| Trial shoot booking | `e2e/intro-funnel-booking.spec.ts` |
| Quote accept | `e2e/quote-accept.spec.ts` |
| Invoice pay | `e2e/invoice-pay.spec.ts` |
| Subscription signup | `e2e/saas-signup.spec.ts` |
| Portal auth | `e2e/portal-auth.spec.ts` |

E2E is optional elsewhere, mandatory on these 5.

### G10 — Manual browser check (UI work only)

For any UI-touching session:

- Start dev server on `:3001`.
- Walk the feature in the browser — happy path + one error state + one empty state.
- Verify motion, sound triggers, reduced-motion parity.
- **Mockup parity check:** for every mockup cited in brief §2a, open the mockup in a second tab and visually compare side-by-side against the built route. Parity items to confirm: brand palette usage (no generic neutrals where brand colours belong), typography (correct fonts + weights per the mockup), ambient environment (backgrounds, textures, blobs, scenes), wordmark presence, progress / navigation chrome, spacing / rhythm. Any gap that isn't an intentional divergence declared in brief §2a is a G10 failure — patch in-session or hand off as FAILED.
- Snapshot observations into the handoff; do not stream dev server output into main context.

Type checks verify code; browser verifies feature; mockup verifies feel. All three required.

### G11 — Handoff note

Write `sessions/<id>-handoff.md`. Must cover:

- What was built (bullets, not paragraphs).
- Key decisions locked.
- Artefacts produced (per G7).
- Rollback declaration (per G6).
- Open threads for the next session.
- Any new rows added to `PATCHES_OWED.md`.

Handoff is the contract with the next session. Treat it as authoritative.

### G11.b — Next-session brief (rolling cadence)

Phase 4 was meant to pre-compile every `sessions/<id>-brief.md` up-front. That didn't happen for Wave 1 A1–A4 — those sessions ran from inline BUILD_PLAN blocks, and the gap was only closed by a 2026-04-14 mop-up. To prevent the gap recurring, brief authoring is now a **rolling cadence**, owned by the closing session of each wave:

- **Within-wave continuity:** every Phase 5 session's handoff also writes the **next session's brief** (`sessions/<next-id>-brief.md`) using `sessions/_brief-template.md`. The brief is committed in the same commit as the handoff. The `## 10 Notes for the next-session brief writer` block in this session's brief is the source material.
- **Wave handoff:** the **closing session of each wave** additionally writes briefs for **every session in the next wave**, against current repo state. (Closing session = the last session in a wave per the BUILD_PLAN sequence — e.g. A8 closes Wave 1 and writes B1 + B2 + B3 briefs.)
- **Definition checkpoint:** the closing session's G9 / G11 are not satisfied until the next-wave briefs exist.

**Escape hatch (context-tight closure):** if a closing session's context budget is at risk of breaching G3 70% before next-wave briefs can be written cleanly, **split**:

- The closing session writes its handoff + the immediate-next session's brief only.
- The closing session's handoff explicitly logs the split and lists which next-wave briefs are still owed.
- The first session of the next wave starts fresh on `/normal` (or whatever its own tier prescribes), reads the closing handoff, writes the remaining next-wave briefs as its first action, then proceeds with its own work.

**Why not pre-compile everything in one Phase 4 session?** Briefs written too far in advance against an unstable repo decay fast (column names, file paths, settings keys, helper signatures). Wave-by-wave keeps every brief grep-verifiable against the repo at the moment it's needed. The trade-off is more brief-writing across sessions — accepted because the failure mode of a stale brief (G1 false-positive, scope drift) is worse than the marginal cost of writing one per session.

**Mop-up rule:** if a session discovers its own brief doesn't exist (because a prior closing session was interrupted before §10 was honoured), it pauses, escalates a one-line note to `PATCHES_OWED.md`, and writes its own brief from `BUILD_PLAN.md` + the relevant spec(s) before proceeding with G1. This is permitted because the alternative — building blind — is worse. It is **not** permitted to spawn a further mop-up session from within that session (anti-cycle rule per `project_phase_3_5_and_4_mop_up_sessions_authorised`).

### G12 — Tracker update + commit

- Update `SESSION_TRACKER.md` **🧭 Next Action** to point at the next session in `BUILD_PLAN.md`.
- Auto-commit (per CLAUDE.md). Message format: `[PHASE-5] <Wave> <session-id> — <short summary>`.
- Never push. Never amend.
- Never commit files that may contain secrets.

---

## §2 — Operating rules (background discipline)

These govern the loop itself, not the individual session.

### Model tiering

Claude Code does **not** auto-switch between models mid-run. Tier is prescribed in the brief and set at session start via explicit command:

| Tier | Command | Used for |
|---|---|---|
| Haiku | `/quick` | Mechanical work: scaffolds, renames, enum expansions, test stubs, migration boilerplate, doc reformatting. |
| Sonnet | `/normal` | Default for feature work. Most sessions. |
| Opus | `/deep` | Architecture, hard debugging, aggregators (Daily Cockpit, Observatory), critical-flow glue. |

Cheaper tiers run first when possible — Sonnet sessions that depend on Haiku groundwork see fresher context.

**Never auto-downgrade.** If a `/normal` session is getting chewed up, end with an interim handoff and escalate to `/deep`. Don't silently grind on Haiku for feature work — rework costs more than the saving.

### Plan-level fallback (Opus → Sonnet)

Claude Code on Max plans degrades Opus → Sonnet when the Opus quota for the 5-hour / weekly window depletes. Default behaviour:

- Detect the switch in session logs.
- **Pause the loop.** Do not silently continue feature work on Sonnet when the brief prescribed Opus.
- Resume at quota reset.

Exception: sessions tagged `sonnet-safe` in the brief may continue on Sonnet during degraded windows. Phase 4 tags these explicitly; nothing else qualifies by default.

### Cache-aware session batching

Prompt cache TTL ≈ 5 minutes. Run related sessions back-to-back so CLAUDE.md + the spec + skills stay cached across handoffs. Long natural gaps (design → build, infra → feature) are treated as cold starts intentionally rather than burning cache midway.

Don't pick 300s sleeps for pacing — either <270s (cache warm) or >1200s (commit to cold start and amortise).

### Pre-compiled session briefs

Every Phase 5 session has a `sessions/<id>-brief.md` written by Phase 4 (or generated from the brief template on-demand). Contains:

- Spec pointer(s) — by file path + section.
- Acceptance criteria — the spec's own "success criteria" block, verbatim.
- File whitelist — paths the session is allowed to touch.
- Skill whitelist — 2–5 skills, named.
- Model tier — `/quick` / `/normal` / `/deep`.
- Settings keys consumed — names from `docs/settings-registry.md`.
- Preconditions — G1 checklist tailored to this session.
- Rollback strategy — one of the three from G6.

Claude reads the brief at session start, not the full 21 specs.

### Per-session skill whitelist

No auto-loading the full skill library. The brief names 2–5 skills. If the session discovers it needs a skill that isn't whitelisted, pause, update the brief, resume. Skill loading eats context that should go to the spec.

### Sub-agent offload for discovery

Codebase exploration ("where does X live", "find all callers of Y") runs inside the `Explore` or `general-purpose` subagent. Tool-call noise dies with the subagent; main context stays lean.

Rule of thumb: any search that'll take >3 grep/glob rounds = subagent.

### Verification-gate discipline

- Typecheck + tests are run as single short commands at the end, not iteratively through the session.
- Dev server output is snapshotted into the handoff, not streamed into main context.
- E2E runs as one final Playwright invocation per session, not re-run after each edit.

### Kill-switches as the safety net

Every risky subsystem ships behind a kill-switch in `lib/kill-switches.ts` (owned by A5):

- `outreach_send_enabled` — outreach email dispatcher.
- `scheduled_tasks_enabled` — background worker loop.
- `llm_calls_enabled` — global LLM gate.
- `drift_check_enabled` — brand-voice drift grader.
- Per-feature flags as they land.

If a Phase 5 session ships code that can spend money, send email, or hit external APIs autonomously, it must be gated. The flag ships disabled; the feature is enabled explicitly by a follow-up PATCH or by Andy at Phase 6.

### Token budget kill-switch

Anthropic daily cap + Stripe fee anomaly + Resend bounce rate all have alerting thresholds in `settings` (seeded by A5, wired by B1). When a threshold fires, Andy is emailed and the autonomous loop pauses pending his ack. This is the hard ceiling on autonomous spend.

### Observability

- Sentry (client + server + edge) from B1.
- `reportIssue()` primitive on every client-facing surface.
- `external_call_log` populated on every third-party call (A6).
- `/lite/admin/errors` triage dashboard.
- Observatory (Wave 21) aggregates cost and usage across every feature.

If a session introduces a new third-party call and doesn't log to `external_call_log`, G7 catches it — log the call or remove it.

### Anti-patterns — do not do these

- Aggressive Haiku downgrade for feature work. Rework costs more than saves.
- Mid-session compact during hard debugging. Finish-and-handoff is safer.
- Over-tight scope (sub-feature-slice sessions). More session boundaries = more cache misses = net loss.
- Skipping E2E "because unit tests pass". Unit ≠ feature.
- Bundling unrelated concerns into one commit to "save time". Future rollback becomes impossible.
- Running `--no-verify` or `@ts-expect-error` on a real failure. Always fix root cause.
- Asking Andy technical questions mid-session. Per memory `feedback_technical_decisions_claude_calls` — silently lock technical choices, only surface product judgement questions.

### When to pause for Andy

The loop pauses and emails Andy when:

- A product-judgement question is the only blocker (voice, priority, business rule, feel).
- A cost alert fires.
- Opus quota depletes and no `sonnet-safe` sessions remain in queue.
- A G-gate fails twice in a row on the same session (pattern = structural issue, not session-local).
- A critical-flow E2E fails in production.
- Any G1 precondition missing = reroute to a blocker session first.

Default posture: **ask, don't guess**, when it's a judgement call Andy owns. Silently decide when it's a technical call Claude owns.

---

## §3 — Relationship to other documents

- **`BUILD_PLAN.md`** — the ordered session list. This protocol enforces discipline on each.
- **`LAUNCH_READY.md`** — Phase 6 gate. Confirms this protocol actually ran end-to-end.
- **`docs/settings-registry.md`** — source of truth for every autonomy threshold. G4 enforces reads.
- **`PATCHES_OWED.md`** — where stray concerns get logged when G2 forbids fixing them in-session.
- **`INCIDENT_PLAYBOOK.md`** (owed Phase 6) — runbook for when a kill-switch fires or a rollback is needed.

---

## §4 — Revision rules

This protocol is locked at end of Phase 4. Revisions during Phase 5 require:

- A named failure mode that the current protocol didn't prevent.
- A specific gate addition / rule addition that would have caught it.
- Andy's explicit sign-off before the update lands.

Don't evolve the protocol on vibes. Every revision attaches to a post-mortem.

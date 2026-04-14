# SW-8 — Next Wave 4 session — Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs".**
> **First task is scope selection, not build.** The three critical-flight
> wizards (stripe-admin, resend, graph-api-admin) closed in SW-5/5b/5c,
> SW-6, SW-7. Wave 4 still has two unshipped tracks in BUILD_PLAN.md:
> - Non-critical admin integration wizards (Pixieset, Meta Ads, Google
>   Ads, Twilio, generic API-key + OpenAI + Anthropic + SerpAPI +
>   Remotion) — BUILD_PLAN Wave 4 row "SW-5".
> - Wizard nudge / expiry crons + voice & delight treatment —
>   BUILD_PLAN Wave 4 row "SW-6".
>
> The SW-IDs in BUILD_PLAN.md predate the critical-flight sessions we
> just shipped, so they don't line up one-to-one with the session IDs
> in `sessions/`.

---

## 1. Identity

- **Session id:** SW-8
- **Wave:** 4 — Setup Wizards (post-critical-flight)
- **Type:** TBD — pick at session start (FEATURE vs INFRA)
- **Model tier:** `/normal` (Sonnet-safe either way — no heavy reasoning)

## 2. Kickoff protocol

1. Read `sessions/sw-7-handoff.md` + `sessions/sw-6-handoff.md`.
2. Read `BUILD_PLAN.md` Wave 4 section (§ Wave 4 — Setup Wizards).
3. Read `SESSION_TRACKER.md` → Recent log for anything that changed
   Wave 4's ordering since Phase 4 landed.
4. Decide between the two tracks and pre-commit to one before touching
   code. Do not try to take both in one session.

## 3. Recommended scope (if no signal from the tracker)

**Recommendation: `wizard_resume_nudge` / `wizard_expiry_warn` /
`wizard_auto_expire` crons + voice & delight treatment** (the
BUILD_PLAN row labelled SW-6). Rationale:
- The three critical-flight wizards are now in production-shape; the
  resume/expiry nudges wire into their `wizard_progress` rows
  immediately and un-stick any half-completed runs Andy starts while
  shadowing Phase 6.
- Non-critical admin wizards (Pixieset, Meta Ads, etc.) arrive as Wave
  4 continues, but none gate Phase 6 dry-run. Nudges/expiry do touch
  real `scheduled_tasks` and `sendEmail` plumbing that needs
  observability, so shipping the plumbing before more wizards consume
  it is cheaper than retrofitting.

If SESSION_TRACKER or Andy signal a specific non-critical wizard as
next (e.g. Pixieset has moved up due to IF-2 needing it), take that
instead and punt nudges to SW-9.

## 4. Track A: Wizard nudge / expiry crons + voice

If taken, the session owns:
- Three `scheduled_tasks` entries:
  - `wizard_resume_nudge` — fires 24h after a `wizard_progress` row
    goes idle (reads `wizards.resume_nudge_hours` setting).
  - `wizard_expiry_warn` — fires on day 29 (reads
    `wizards.admin_idle_banner_days` + `wizards.expiry_days`).
  - `wizard_auto_expire` — fires on day 30 + marks the row expired.
- `sendEmail` calls into the existing Resend adapter (passive channel
  per `feedback_passive_vs_active_channels`). No active-channel echo.
- Voice treatment pulled from the wizard's `voiceTreatment.tabTitlePool`
  + a new per-stage email content file at
  `docs/content/setup-wizards/nudge-emails.md` (matches the
  content-authoring output home convention).
- Unit tests for each cron's trigger condition + one integration test
  asserting the nudge → expire sequence.

Settings keys touched (all already seeded; verify via
`docs/settings-registry.md`): `wizards.resume_nudge_hours`,
`wizards.admin_idle_banner_days`, `wizards.expiry_days`,
`wizards.max_resume_count`.

## 5. Track B: First non-critical admin integration wizard

If taken, pick **Pixieset-admin** first (IF-2 in Wave 14 consumes it).
Pattern: copy the `resend` scaffolding (no webhook-probe, api-key-paste
→ review → celebration). Pixieset has no public API per
`p0-pixieset-spike-handoff.md` — the wizard is a link-out paste-URL
form rather than a true integration; the spec live in
`docs/specs/setup-wizards.md` §5.5 captures the deviation.

File whitelist under Track B:
- `lib/wizards/defs/pixieset-admin.ts`
- `lib/integrations/vendors/pixieset.ts`
- `app/lite/setup/[rest-of-flow]/...` — **non-critical-flight route**;
  do not land under `/lite/setup/critical-flight/[key]`. The route tree
  for non-critical admin wizards is TBD — check SW-4 handoff for the
  planned location; if it's unowned, decide in-session and patch the
  spec.
- Tests + barrel import.

## 6. Preconditions (G1 — regardless of track)

- [ ] SW-7 closed — verify: `ls sessions/sw-7-handoff.md`
- [ ] Per-wizard client split landed — verify:
      `ls app/lite/setup/critical-flight/[key]/clients/use-critical-flight-shell.ts`
- [ ] Defs barrel imports all three critical wizards — verify: grep
      `graph-api-admin` in `lib/wizards/defs/index.ts`
- **Track A only:**
  - [ ] `scheduled_tasks` table exists — verify: `ls
        lib/db/schema/scheduled-tasks*.ts` (A6 landed in Foundation-A)
  - [ ] `sendEmail()` helper exists — verify: grep `sendEmail` in
        `lib/email/`
- **Track B only:**
  - [ ] Non-critical admin wizard route home decided — check SW-4
        handoff + `docs/specs/setup-wizards.md` §5; if undefined,
        spawn a bounded scope mop-up per `START_HERE.md` Phase 5
        guardrails.

## 7. Rollback strategy (G6)

- **Track A:** feature-flag-gated via `wizards_nudges_enabled` (new
  kill-switch) **OR** gated on `setup_wizards_enabled`. Decide in
  session — new kill-switch keeps nudge control independent of wizard
  availability, which is the right call for the Phase-6 shadow.
- **Track B:** feature-flag-gated via `setup_wizards_enabled` (shared
  with the critical flight trio).

## 8. Definition of done

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 330+N green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] `npm run test:e2e` → green (previous specs continue to skip
      without keys; Track B may not need an E2E if it's a
      non-critical flow per AUTONOMY_PROTOCOL §G12)
- [ ] Handoff written; tracker updated; SW-9 brief pre-compiled
- [ ] **Track A:** cron definitions appear in the consolidated
      scheduled-tasks view per `BUILD_PLAN.md` §C

## 9. Split-point (if context tight)

- **Track A:** split at plumbing vs voice — SW-8-a ships the crons +
  tests, SW-8-b the content-file + email templates.
- **Track B:** not expected — Pixieset-admin is narrower than resend.

## 10. Notes for the next-session brief writer

- SW-7-b oauth hardening (listed in `PATCHES_OWED.md` as
  `sw7b_graph_oauth_callback_hardening`) pairs with Andy registering
  an Azure app. Don't silently fold it into SW-8 — it's a separate
  human-in-the-loop unit.
- `hasCompletedCriticalFlight()` now gates on all three wizards
  completing. If Track A introduces any nudge path that re-opens a
  completed wizard (e.g. a "reconnect Microsoft" retry), the gate
  needs to stay stable — nudges should not retroactively clear
  `wizard_completions` rows.
- Per-wizard client pattern landed in SW-7 is the template. Document
  it in the setup-wizards spec if not already captured there.

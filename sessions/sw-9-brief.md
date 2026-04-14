# SW-9 — First non-critical admin integration wizard — Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs" + G11.b.**
> SW-8 landed Track A (wizard nudge/expiry crons + voice). Wave 4's
> remaining non-critical admin wizards are Track B from the SW-8 brief.
> First unit: **Pixieset-admin**.

---

## 1. Identity

- **Session id:** SW-9
- **Wave:** 4 — Setup Wizards (post-critical-flight, non-critical admin)
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet-safe — scaffolded from `resend` pattern)

## 2. Kickoff protocol

1. Read `sessions/sw-8-handoff.md` + `sessions/sw-7-handoff.md`.
2. Read `docs/specs/setup-wizards.md` §5.5 (Pixieset deviation — on-brand link-out per P0 spike outcome B).
3. Read `sessions/p0-pixieset-spike-handoff.md` for Pixieset's closed-API posture.
4. Read BUILD_PLAN.md Wave 4 "SW-5" row for the non-critical wizard bundle shape.

## 3. Scope — Pixieset-admin (first non-critical admin wizard)

**Pattern:** copy the `resend` scaffolding (api-key-paste → review → celebration) but **swap step 1** to a paste-URL form rather than an API key. Pixieset has no public API; per P0 outcome B, the wizard captures the client's gallery URL as the canonical link.

**Wizard arc:**
1. `form` step — paste gallery URL (Zod-validated against `https://<slug>.pixieset.com/...` shape).
2. `review-and-confirm` — show the URL + any extracted slug for confirmation.
3. `celebration` — arc-level only (not critical-flight); `registerIntegration` + `wizard_completions` insert.

No webhook-probe. No verify ping (nothing to ping).

## 4. First-task decision — route-tree home

Non-critical admin wizard routes are currently undefined. SW-9 must pick a location **before** landing code. Two options:

- **A:** `/lite/setup/admin/[key]` — parallel to `critical-flight/[key]`, clear semantic split.
- **B:** `/lite/setup/integrations/[key]` — emphasises "integration" framing; distinguishes Pixieset + future vendors from future non-integration admin wizards (e.g. brand-policy setup).

**Recommendation:** **A** (`/lite/setup/admin/[key]`). Rationale: Pixieset is one of many admin setup wizards, not all of which are vendor integrations (future: policy setup, warmup ramp config, etc.). `admin/[key]` reads cleanly alongside `critical-flight/[key]`. Patch `docs/specs/setup-wizards.md` §5 in the same session.

## 5. File whitelist

- `lib/integrations/vendors/pixieset.ts` — vendor manifest (`vendorKey = "pixieset"`; job bands n/a, declare a single `pixieset.link.paste` band with no-op timings, or document as "no live calls"; kill-switch shares `setup_wizards_enabled`).
- `lib/wizards/defs/pixieset-admin.ts` — `WizardDefinition<PixiesetAdminPayload>`; `completionContract.verify` returns `{ ok: true }` (nothing to ping).
- `lib/wizards/defs/index.ts` — add `./pixieset-admin` import.
- `app/lite/setup/admin/[key]/page.tsx` + `.../clients/pixieset-admin-client.tsx` + `.../clients/use-admin-shell.ts` (per-wizard client pattern from SW-7).
- `app/lite/setup/admin/[key]/actions-pixieset.ts` — `completePixiesetAction(payload)`.
- `tests/pixieset-admin-wizard.test.ts` — 5 tests mirroring the resend/graph shape.
- `tests/e2e/admin-pixieset.spec.ts` — optional; non-critical per AUTONOMY §G12.
- Spec patch: `docs/specs/setup-wizards.md` §5 noting the non-critical admin route tree home.

## 6. Preconditions (G1)

- [ ] SW-8 closed — `ls sessions/sw-8-handoff.md`
- [ ] Defs barrel imports all three critical wizards — grep `graph-api-admin` in `lib/wizards/defs/index.ts`
- [ ] P0 spike handoff exists — `ls sessions/p0-pixieset-spike-handoff.md`
- [ ] `scheduleWizardNudges` exported — grep in `lib/wizards/nudge/enqueue.ts` (Pixieset wizard's row-creation path should call it when landed)

## 7. Rollback strategy (G6)

- Feature-flag-gated via `setup_wizards_enabled` (shared with the critical flight trio).
- No new schema; no new settings keys.

## 8. Definition of done

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 345+N green
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] `npm run test:e2e` → green (existing skips preserved)
- [ ] Handoff written; tracker updated; SW-10 brief pre-compiled
- [ ] Spec patch applied inside the same session

## 9. Split-point (if context tight)

Not expected — Pixieset-admin is narrower than Resend (no verify ping, one step shorter).

## 10. Notes for the next-session brief writer

- After Pixieset lands, SW-10 picks the next non-critical wizard. Candidates (BUILD_PLAN SW-5 bundle): Meta Ads, Google Ads, Twilio, OpenAI, Anthropic, SerpAPI, Remotion, generic API-key.
- Wiring `scheduleWizardNudges()` into the wizard_progress writer is a separate piece of work — if SW-9 lands the first real progress-row write path (likely needed for the form step to persist), it must call `scheduleWizardNudges(row)` on insert and `cancelWizardNudges(row.id)` on completion. Otherwise punt to a dedicated session.
- `WizardDefinition.displayName` — consider adding this field if the nudge email copy starts feeling wooden with keys-as-names.

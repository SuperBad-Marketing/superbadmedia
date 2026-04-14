# SW-9 — pixieset-admin + non-critical admin route tree — Handoff

**Closed:** 2026-04-14
**Brief:** `sessions/sw-9-brief.md`
**Model:** Opus (`/deep`) — user elected not to downshift after `/normal` suggested; brief was Sonnet-safe, Opus was fine too.
**Type:** FEATURE
**Rollback:** feature-flag-gated via `setup_wizards_enabled` (shared with the critical-flight family). Revert = delete new files + revert barrel + revert spec §5 route-tree block. No schema change. No migration. No settings keys touched.

## What shipped

- **`lib/integrations/vendors/pixieset.ts`** — first non-critical vendor manifest. `vendorKey = "pixieset"`, single band `pixieset.link.paste` (nominal `{p95:1, p99:1}` — design-time only, never hit by real traffic because Pixieset has no public API per P0 spike outcome B). `actorConvention: "internal"`, `killSwitchKey: "setup_wizards_enabled"`.
- **`lib/wizards/defs/pixieset-admin.ts`** — `WizardDefinition<PixiesetAdminPayload>` composing `form → review-and-confirm → celebration`. The form step uses a Zod schema (`pixiesetGalleryUrlSchema`) exported from the same module so the schema travels with the def. Schema enforces `https://<slug>.pixieset.com/…` — rejects `http://`, rejects `https://pixieset.com/…` (bare host), rejects path-segment lookalikes like `https://evil.example/andys.pixieset.com`. `extractPixiesetSlug(url)` helper is the review-summary's source for the slug display. `completionContract.verify` returns `{ok:true}` unconditionally (there is nothing to ping) but `artefacts.integrationConnections = true` still fires — the `integration_connections` row remains the source of truth that Pixieset is connected. `capstone` undefined (not part of the first-run flight). Self-registers via `registerWizard()` on module import.
- **`lib/wizards/defs/index.ts`** — barrel now imports all four wizards (`stripe-admin`, `resend`, `graph-api-admin`, `pixieset-admin`).
- **`app/lite/setup/admin/[key]/page.tsx`** — Server Component entrypoint. Barrel side-effect import triggers registration; `getWizard(key)` resolves the def. 404s unknown keys + 404s any def whose `audience !== "admin"` (prevents accidental client-audience leakage into the admin tree). Reads `expiryDays` via `getWizardShellConfig`. Dispatches by `def.key` into the per-wizard client — SW-9 ships the `pixieset-admin` branch only; future wizards add branches.
- **`app/lite/setup/admin/[key]/clients/pixieset-admin-client.tsx`** — per-wizard client file following the SW-7 split pattern. Seeds the form step with `{ values: { url: "" } }`, builds the review summary from pasted URL + extracted slug, wires the celebration step's `onComplete` to `completePixiesetAction`.
- **`app/lite/setup/admin/[key]/clients/use-admin-shell.ts`** — non-critical counterpart to `use-critical-flight-shell`. Two differences: cancel + done route to `/lite` (cockpit) rather than `/lite/first-run`; no expiry wiring here (expiry prop flows through the page component as on the critical path).
- **`app/lite/setup/admin/[key]/actions-pixieset.ts`** — single Server Action `completePixiesetAction(payload)`. Runs `registerIntegration → verifyCompletion → wizard_completions insert`. Rolls back (no partial row) on any failure. **No `unstable_update()` call** — non-critical wizards don't gate the JWT's `critical_flight_complete` claim (SW-4's middleware only watches the critical trio).
- **`tests/pixieset-admin-wizard.test.ts`** — 6 unit tests: step composition, manifest wiring, audience/render/capstone shape, barrel registration (asserts all four wizards present), trivially-passing `verify()`, and a combined Zod schema + slug-extractor pass that exercises accept/reject URL shapes.
- **`docs/specs/setup-wizards.md` §5 patch** — adds the "Route tree" block: `/lite/setup/critical-flight/[key]` for the three first-run wizards, `/lite/setup/admin/[key]` for every other admin wizard, client-audience wizards continue to live at their own per-spec routes. Closes the SW-8 open thread on route-tree choice.

## Decisions

- **Route tree: `/lite/setup/admin/[key]` (option A from brief §4).** Rationale: not every future admin wizard is a vendor integration (warmup-ramp config, brand policy setup, saas-product-setup already in §5.2, finance-tax-rates, etc.). `admin` reads as the peer of `critical-flight` and avoids cornering future config wizards into a mis-framed `integrations` namespace. Spec §5 patched in the same session to lock this.
- **`verify()` returns `{ok:true}` unconditionally.** P0 spike outcome B locked no-API posture. Gating the integration row on a fake ping would just add failure modes without buying anything. The artefact gate (`integration_connections` row exists) is already the source of truth — verifying it proves the celebration orchestrator reached the write phase without throwing.
- **Zod schema co-located on the def, exported by name.** The form step's `config.schema` needs the Zod object at shape-time; exporting it from the def module rather than duplicating it in the client keeps the validation single-source. The client imports `extractPixiesetSlug` from the same module for the review summary.
- **No `testCall` action on the form step.** Unlike `api-key-paste`'s `testCall` prop, the `form` step has no test-call hook — validation is purely schema. Nothing to ping at paste time; the Zod refine closes the hole alone.
- **No `unstable_update()` in `completePixiesetAction`.** Non-critical wizards don't participate in the critical-flight JWT claim. Skipping the refresh keeps the hot path tight and avoids a spurious JWT re-mint on every non-critical completion.
- **Admin-tree page 404s on audience mismatch.** A client-audience wizard reaching `/lite/setup/admin/[key]` would be a routing mistake; 404 is the right response. Added as a `def.audience !== "admin"` check alongside the `!def` check.
- **E2E spec skipped this session.** Brief §5 authorised non-critical E2E as optional per AUTONOMY §G12. Pixieset's arc is narrower than the critical trio's (no handshake, no external round-trip, no oauth) and the unit tests cover every non-UI seam. Deferred as not-owed, not as a patch.
- **Opus over Sonnet.** User moved to `/normal` then fired `let's go` without waiting for the model switch to take effect. Brief was Sonnet-safe; Opus is overkill but not wrong. No drift impact.

## Files touched

| File | Change |
| --- | --- |
| `lib/integrations/vendors/pixieset.ts` | NEW |
| `lib/wizards/defs/pixieset-admin.ts` | NEW |
| `lib/wizards/defs/index.ts` | Add `./pixieset-admin` import |
| `app/lite/setup/admin/[key]/page.tsx` | NEW |
| `app/lite/setup/admin/[key]/clients/pixieset-admin-client.tsx` | NEW |
| `app/lite/setup/admin/[key]/clients/use-admin-shell.ts` | NEW |
| `app/lite/setup/admin/[key]/actions-pixieset.ts` | NEW |
| `tests/pixieset-admin-wizard.test.ts` | NEW |
| `docs/specs/setup-wizards.md` | §5 route-tree block |
| `sessions/sw-9-handoff.md` | NEW (this file) |
| `sessions/sw-10-brief.md` | NEW (pre-compiled per G11.b) |
| `SESSION_TRACKER.md` | Next Action → SW-10 |

No migration. No settings keys touched. No schema change.

## Verification

- `npx tsc --noEmit` — zero errors
- `npm test` — **346/346 green** (340 prior + 6 new from `pixieset-admin-wizard.test.ts`)
- `npm run lint` — clean
- `npm run build` — clean; `/lite/setup/admin/[key]` compiles and is in the route manifest
- `npm run test:e2e` — 3 skipped (unchanged — admin-pixieset E2E deferred per brief §5 / AUTONOMY §G12)

## G0–G12 walkthrough

- **G0 kickoff** — brief read; SW-8 + SW-7 handoffs read; spec §5.5 + P0 spike handoff read; BUILD_PLAN Wave 4 / SW-5 row noted for non-critical bundle context.
- **G1 preflight** — 4/4 preconditions verified: SW-8 handoff present, defs barrel imports `graph-api-admin` (line 3), P0 spike handoff present, `scheduleWizardNudges` exported in `lib/wizards/nudge/enqueue.ts`. (Pixieset wizard does not yet call the nudge scheduler — the `wizard_progress` writer is still unlanded; that wiring is a separate piece of work per SW-8 Open Threads.)
- **G2 scope discipline** — every file in brief §5 whitelist touched; nothing else. Spec §5 patched as §4 required.
- **G3 context budget** — comfortable single-session.
- **G4 literal-grep** — no autonomy thresholds introduced. The manifest's `{p95:1, p99:1}` are nominal band defaults, not autonomy-sensitive. No review windows, timeouts, confidence cutoffs, or retry counts touched.
- **G5 motion** — no motion changes. Celebration uses the existing Tier-2 `wizard-complete` choreography unchanged.
- **G6 rollback** — feature-flag-gated via `setup_wizards_enabled` (already enforced inside `registerIntegration`). No migration.
- **G7 artefacts** — every whitelisted file present (verified via the test run + build route manifest).
- **G8 typecheck + tests + lint + build** — all green (numbers above).
- **G9 E2E** — non-critical per §G12; optional and deferred. Existing specs still skip without their test keys.
- **G10 manual browser** — not run this session (E2E optional for non-critical; `next build` compiles the new route clean).
- **G11.b** — SW-10 brief pre-compiled.
- **G12** — tracker updated; commit next.

## PATCHES_OWED status

- **Closed this session:** none.
- **Opened this session:** none.
- **Still open (carried):**
  - `sw5_integration_rollback_on_insert_failure` — Observatory wave.
  - `sw7b_graph_oauth_callback_hardening` — pairs with Azure app registration.

## Open threads for SW-10

- Non-critical admin wizard bundle still has: Meta Ads, Google Ads, Twilio, generic API-key parametrised wizard (covering OpenAI / Anthropic / SerpAPI / Remotion per spec §5.1 last row). Recommended next: **Meta Ads** — introduces oauth-consent into the admin route tree (parallel of graph-api-admin on the critical side). Brief pre-compiled with this default.
- **`wizard_progress` writer still unlanded.** Neither SW-8's `scheduleWizardNudges()` nor any wizard's progress-persistence path has a consumer yet. First wizard that needs mid-flow persistence (likely a longer-arc admin wizard like the generic API-key or a content-picker arc) should land the writer + wire the nudge scheduler in the same session.
- **`/lite/integrations` hub page** — spec §8.4 implies it exists; no code has landed it. Not SW-10's problem but worth noting — the lazy-surfacing pattern depends on it.
- **Per-wizard client split is now the house style.** Any future admin wizard adding to `/lite/setup/admin/[key]` adds a new `clients/<wizardKey>-client.tsx` and a dispatcher branch in `page.tsx`. Resist the urge to rebranch a shared client file.
- **`WizardDefinition.displayName`** (SW-8 Open Thread) — still not added; copy remains acceptable with `wizardKey` as the display string. Fold in if nudge copy starts reading wooden.

## Notes

- The form step-type renders field keys as labels (no per-field label override in the step-type config yet). For Pixieset this means the input is labelled `url` lowercase — acceptable for a single-field form, but worth a polish pass when multi-field admin wizards land. Not raised as a PATCHES_OWED row because nothing concrete consumes the improvement yet.
- Encrypting the gallery URL as a "credential" via the vault is pragmatic, not literal — `integration_connections.credentials` is the typed slot for the vendor-shaped secret, and Pixieset's canonical "secret" is effectively the URL-as-capability (anyone with the URL can view the gallery). Storing it encrypted matches the table's contract without over-engineering a per-vendor schema split.
- The dispatcher in `page.tsx` is intentionally a single `if (def.key === "pixieset-admin")` branch rather than a pre-emptive registry map. The map shape will emerge naturally when SW-10 adds the second branch; premature abstraction here would be guesswork.

# P0 — Pixieset Feasibility Spike — Handoff

**Date:** 2026-04-13
**Wave:** 0 (pre-build spike)
**Type:** SPIKE — research only, no code
**Spec consulted:** `docs/specs/intro-funnel.md` §15.2–§15.4
**Outcome:** **B — no push / no API. Path B (on-brand link-out) is v1.0 default.**

---

## What the spike was asked

From `BUILD_PLAN.md` Wave 0 + `docs/specs/intro-funnel.md` §15.3:

1. Does Pixieset offer a public API supporting private-gallery reads (image list, full-size URLs, auth model, rate limits)?
2. Is there any push / webhook signal when a gallery goes live, so `gallery_ready_at` can be set automatically?
3. Outcome branches IF-2 between Path A (inline native gallery) and Path B (on-brand link-out).

## Findings

### 1. No public gallery API

- Pixieset's only endpoint documented as a "public API" is their **Instatus status-page feed** (`/v3/summary.json`, `/v3/components.json`). Service-health JSON only. Nothing about galleries, images, clients, or orders.
- No official developer documentation exists on `pixieset.com`, `help.pixieset.com`, or `website-help.pixieset.com`. Searched for dev docs, API keys, OAuth, developer portal — none found.
- Pixieset is **not listed on Zapier** (native integration absent). Third-party "integrations" (Whippy AI, Snappr Workflows, LeadGen, Appy Pie, Common Ninja) are marketing landing pages without verifiable technical implementation, or they scrape / iframe workarounds. No usable signal.
- Public tools that do read Pixieset galleries (e.g. `pixieset-downloader`, `pixieDownloader` Chrome extension) rely on **reverse-engineered internal XHR endpoints** — users must extract a `PHPSESSID` session cookie plus `cid` / `cuk` / `gs` params from browser devtools. Images returned are often watermarked / lower-res. This approach is:
  - Unsupported (breaks silently when Pixieset updates their internal API).
  - Likely a Pixieset ToS violation (unauthorised automated access).
  - Operationally impossible for us (we'd need Andy's session cookie on a server, per-gallery).
  - Not going to ship in v1.0 under any circumstance.

### 2. No push / no webhook

- Pixieset's "Notifications" feature is **for end-user notifications only** (photographer receives emails when a gallery is viewed or an order is placed). No outbound webhook to a third-party URL.
- No event bus, no Zapier trigger, no RSS/Atom of new galleries. None.
- Searched the Pixieset UserVoice forum: API access is a long-standing community request with no roadmap answer.

### 3. No embedding

- Pixieset's own help centre states galleries "have not been designed to be embedded into other websites, such as through the use of iframes." iframe embedding is also off the table — rules out the poor-man's-inline path.

### 4. Gallery sharing model

- Galleries are shared via direct URL + optional password. Clients enter the gallery through Pixieset's own domain, UI, and branding.
- Privacy options are handled entirely on Pixieset's side. We cannot gate access ourselves.

## Verdict

**Path B (on-brand link-out fallback) is the only viable path for v1.0.** Path A (inline native gallery powered by Pixieset API) is structurally impossible, not just inconvenient.

## Trigger model for `gallery_ready_at` (already in spec, re-confirmed)

The spec already assumes **manual-paste trigger** — §15.1 describes Andy pasting the gallery URL in the admin UI, server parses, sets `gallery_ready_at = NOW`, bundle gate fires alongside `plan_ready_at`.

This is correct and unaffected by the spike outcome:
- No webhook is possible from Pixieset's side, so "push" is off the table regardless.
- Polling is also unhelpful — Pixieset has no endpoint we'd poll against without reverse-engineering.
- Manual paste is the right trigger: it's cheap, it's what Andy does already when preparing deliverables, it doubles as his explicit "publish" action inside Lite.

## Mop-up brainstorm: NOT recommended

Spec §15.3 allows for "a Phase 4 mop-up brainstorm [to decide] whether to evaluate Pixieset alternatives (Pic-Time, Cloudspot, ShootProof) before accepting [Path B] as final." **I am silently locking this decision as NO MOP-UP**, per the guardrails:

- All three named alternatives (Pic-Time, Cloudspot, ShootProof) are closed photographer platforms with the same access model as Pixieset — no public gallery APIs, same iframe-unfriendliness. Switching wouldn't change the outcome.
- Switching platforms carries migration cost, retraining cost, loss of Pixieset's existing client-facing UX that Andy is comfortable with. Zero upside for equivalent API posture.
- The Path B spec (§15.3 outcome 2, §15.4) is already fully designed — on-brand "Your gallery is ready" portal surface with house-spring motion + launch CTA, Tier-2 reveal happens on the portal surface rather than inside the gallery. Emotional beat preserved.
- Per memory `feedback_technical_decisions_claude_calls` — silently lock technical choices, surface only product-judgement questions.
- Phase 4 is closed. Mop-up guardrails (one topic, no self-perpetuation) apply and the topic doesn't clear the "would the outcome change" bar.

If Andy feels the link-out kills the reveal moment enough to matter, he can override. Default is Path B, ship as specced, revisit in v1.1 if real customer feedback says otherwise.

## Patches owed

Applied this session (see commit):

1. **`docs/specs/intro-funnel.md` §15.3** — replace "two outcomes from the spike" language with a locked Path B outcome. F2.c marker updated to **RESOLVED 2026-04-13 → outcome B**.
2. **`docs/specs/intro-funnel.md` §15.2** — portal gallery component is the on-brand "Your gallery is ready" launch card, not an inline image gallery. CTA opens Pixieset URL in a new tab. `deliverables_viewed` fires on CTA click (not on portal mount).
3. **`BUILD_PLAN.md` Wave 0** — status note: RESOLVED 2026-04-13, outcome B. IF-2 description updated to "on-brand link-out" with no branching residue.

Logged to `PATCHES_OWED.md` for the IF-2 build session (Wave 14):

- `docs/specs/intro-funnel.md` + `deals` table schema — **`pixieset_gallery_id` column is likely dead under Path B** (the ID was a Path A artefact for API calls). Decision deferred to IF-2 session: drop the column, or keep it as optional admin-captured metadata for display. Don't decide here; the IF-2 session has the best view.
- `docs/specs/intro-funnel.md` §15 — **§11.5 drift-check is still owed** on the "Your gallery is ready" launch-card body + the deliverables-ready announcement email (already an email, already drift-checked; card body is new surface). IF-2 handles this.
- **SW-5 integration wizards (Wave 7)** — remove any Pixieset credential / API-key wizard step; Andy doesn't need to authorise anything Pixieset-side. SW-5 session picks this up when it arrives.

## Gates

Per `AUTONOMY_PROTOCOL.md`:

- **G0** — session kickoff ✓ (CLAUDE.md, START_HERE Phase 5, AUTONOMY_PROTOCOL full, BUILD_PLAN Wave 0, last 2 handoffs, intro-funnel spec §15 read)
- **G1** — preflight preconditions ✓ (none listed for P0)
- **G2** — scope discipline ✓ (only research + three named patches; no ambient edits)
- **G3** — 70% checkpoint n/a (session completed in one)
- **G4** — settings-literal grep n/a (no feature code)
- **G5** — motion review n/a (no feature code)
- **G6** — rollback: `n/a (research only)` per Wave 0 declaration
- **G7** — artefact verification: see "What's in the repo" below
- **G8** — typecheck + tests: no code change, skipped
- **G9** — E2E: n/a
- **G10** — manual browser check: n/a
- **G11** — this handoff
- **G12** — tracker + commit: see below

## Artefacts produced

- `sessions/p0-pixieset-spike-handoff.md` (this file)
- Edits to `docs/specs/intro-funnel.md` (§15.2, §15.3)
- Edits to `BUILD_PLAN.md` Wave 0
- Row additions to `PATCHES_OWED.md` for IF-2 + SW-5 follow-on
- `SESSION_TRACKER.md` Next Action flipped to Wave 1 A1

## Rollback

`n/a` — research + docs only, git-revertable.

## Open threads for next session (Wave 1 A1)

- Start Foundation A at A1 — Project initialisation. `/normal` / Sonnet. Skill whitelist: `nextjs16-breaking-changes`, `tailwind-v4`, `react-19`, `typescript-validation`.
- A1 has no preconditions.
- Path B lock affects zero Foundation-A work. First Pixieset-touching session is IF-2 at Wave 14.

---

**Phase 5 Wave 0 closed. Wave 1 A1 is the next session.**

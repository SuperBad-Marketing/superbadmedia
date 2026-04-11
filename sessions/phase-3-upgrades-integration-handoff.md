# Phase 3 — Upgrades Integration Handoff

**Date:** 2026-04-12
**Type:** Scope / Foundations patch (not a full spec session)
**Source:** `where-we-are.html` § 04 "Suggested Upgrades" — 12-item shortlist
**Scope of this session:** integrate the 7 upgrades that fold into existing architecture without requiring a new build session.

---

## What Andy asked for

After reviewing the 12 upgrades in §4 of `where-we-are.html`, Andy asked for the 7 that were classified as "folds in cleanly — no new session" to be integrated into the existing Phase 3 / Phase 4 plan. The remaining 5 (Undo Toast, Morning Brief Audio, Monday Founder-State PDF, Global Semantic Search, Client Portal Trailer) are **not** being integrated in this session — they need their own spec/build sessions if Andy wants them later.

---

## What was integrated

Seven upgrades, split into two categories:

### A. Cross-cutting primitives (5) — now in `FOUNDATIONS.md § 11`

All five are architectural contracts, not features. They apply to every feature built from this point forward. Added to Foundations as new §11.1–§11.5 and enforced via new build-time disciplines 13–17.

1. **Universal Audit Log (§11.1 / discipline 13)** — generalise the Sales Pipeline activity log pattern to every mutation in the system. One `activity_log` table, one `logActivity()` helper, one call at the end of every mutation inside the same transaction. Soft-deletes write `action = 'delete'` rows.
2. **Safe-To-Send Gate (§11.2 / discipline 14)** — every outbound email routes through `sendEmail()` in the channel adapter, which wraps `canSendTo(recipient, channel, purpose)` around the Resend client. No code anywhere imports `resend.emails.send()` directly.
3. **Timezone-Correct Timestamps (§11.3 / discipline 15)** — UTC in storage, local in display via `formatTimestamp(date, tz)`. A `timezone` column on `user` (default `Australia/Melbourne`) is required before the first display surface ships.
4. **Outreach Quiet Window (§11.4 / discipline 16)** — automated cold outreach gated to 08:00–18:00 Australia/Melbourne, Mon–Fri, excluding Aus public holidays (static JSON file in `/data/au-holidays.json`). Transactional paths exempt. Rejected sends queue, never fail silently.
5. **Brand-Voice Drift Check (§11.5 / discipline 17)** — every externally-delivered LLM artefact passes `checkBrandVoiceDrift(draft, brandDnaProfile)` (Haiku-tier Claude call) before being shown to Andy or sent. One auto-regeneration on drift; second failure shows a visible warning rather than blocking.

### B. Features folded into existing planned specs (2) — now in `SCOPE.md § "Additional v1 features (added 2026-04-12 — upgrades shortlist)"`

Neither adds a new spec session to the backlog. Each is a reference for the spec session that will eventually write the parent feature.

6. **Sentiment-Aware Reply Drafts** — folds into `docs/specs/unified-inbox.md` (spec #11 in the Phase 3 backlog). Inbound replies get auto-classified by register (warm / cold / curious / objection / excited / neutral) and a matching reply is drafted inline as a suggestion. Never auto-sends. Composes with Client Context Engine and the Brand-Voice Drift Check primitive.
7. **One-Click Client Data Export** — folds into `docs/specs/client-management.md` (spec #8 in the Phase 3 backlog). One button per client record produces a branded ZIP of CSVs + PDFs + external-link manifest. Pure composition of existing queries and the already-planned Puppeteer pipeline. No new data models.

---

## What was explicitly NOT integrated (and why)

The 5 upgrades that need their own session remain on Andy's optional backlog — none of them have been added to the spec list or FOUNDATIONS:

- **Global Undo Toast** — requires a shared toast primitive, undo adapter pattern, and soft-delete-plus-restore UX. Borderline case but needs a real session. Partial enabler is already in place: the Universal Audit Log (§11.1) uses soft-deletes, so the data layer is ready when/if Andy wants to add undo later.
- **Morning Brief Audio** — needs TTS integration (new external service) + cron + voice-tuning pass.
- **Monday Founder-State PDF** — small but standalone. Template design + data assembly + cron.
- **Global Semantic Search** — sqlite-vec install, vector columns across multiple tables, embedding-on-write, new search UI. Chunkiest of the 12.
- **Client Portal Trailer** — bespoke Framer Motion intro sequence. Motion-design craft work that deserves its own focused session.

If Andy later decides any of these are wanted, they should each become a **Phase 3 spec session** (appended to the backlog) OR a **Phase 5 build session** (if pure implementation with no design decisions).

---

## Why these 7 were safe to integrate without a new session

Every one of the 7 is either:

- **A rule applied uniformly across every feature** (audit log, safe-to-send, timezone, drift check, quiet window) — it lives in FOUNDATIONS and every subsequent spec just has to honour it.
- **A module that composes existing primitives inside a spec that hasn't been written yet** (sentiment replies, client data export) — the parent spec session picks them up as part of its own scope, no extra session needed.

None of the 7 required new data models beyond fields that would exist anyway (`timezone` on `user`, `activity_log` table already scoped in Sales Pipeline). None required new external services. None required new architectural surfaces. That's what made them "free integrations" as long as they were locked before the relevant spec sessions ran.

---

## Impact on the Phase 3 backlog

**Backlog count unchanged — still 14 specs.** The 2 feature additions fold into existing backlog items (`unified-inbox.md` #11 and `client-management.md` #8). The 5 cross-cutting primitives are Foundations constraints and do not appear in the spec backlog at all.

**Ordering unchanged.** The existing order still makes sense — Lead Gen first, working through the backlog as previously planned.

**New constraint on every subsequent spec:** every Phase 3 spec from Lead Gen onward must explicitly reference the relevant Foundations §11 primitives rather than re-inventing them. The Next Action block has been updated with the specific constraints the Lead Gen spec must honour (all four of §11.1–11.3 and §11.5 apply to Lead Gen; §11.4 also applies because Lead Gen is the primary source of automated cold outreach).

---

## Impact on Phase 4 (Build Plan + Autonomy Protocol)

Phase 4 must sequence the Foundations §11 primitives **first**, before any feature session:

1. **Session B1** — schema migration: `activity_log` table, `timezone` column on `user`, `formatTimestamp()` utility.
2. **Session B2** — channel adapter layer: `sendEmail()` wrapper around Resend, `canSendTo()` suppression list primitive, `isWithinQuietWindow()` helper, `/data/au-holidays.json` seed.
3. **Session B3** — LLM primitive layer: `checkBrandVoiceDrift()` wrapping a Haiku Claude call, reading a Brand DNA profile fixture (real profile binds in once Brand DNA Assessment ships).
4. **Then** feature sessions can proceed, each free to assume the primitives exist.

The Autonomy Protocol must include a pre-session check: **"before starting a feature session, verify B1–B3 are shipped and green."** Sessions that touch mutations, email, timestamps, or LLM generation cannot run if their required primitive isn't ready.

---

## Files changed in this session

- `FOUNDATIONS.md` — added §11 (Cross-cutting primitives, 5 sub-sections) and disciplines 13–17.
- `SCOPE.md` — appended new section "Additional v1 features (added 2026-04-12 — upgrades shortlist)" with features §11 (Sentiment-Aware Reply Drafts) and §12 (One-Click Client Data Export).
- `SESSION_TRACKER.md` — added a new row to the session log, updated the Next Action block with the Foundations §11 constraints that Lead Gen (and every subsequent spec) must honour.
- `sessions/phase-3-upgrades-integration-handoff.md` — this file.

No code was written. No `docs/specs/*.md` files were touched. No new memories were saved — every primitive in this session is already covered by existing memories (`project_brand_dna_as_perpetual_context`, `project_two_perpetual_contexts`, `feedback_setup_is_hand_held`, etc.).

---

## What the next session should know

1. **Before writing `docs/specs/lead-generation.md`, read `FOUNDATIONS.md § 11` and the new disciplines 13–17.** Lead Gen is the first spec that touches four of the five primitives at once (audit log, safe-to-send, timezone, drift check, and it's the primary source of the automated outreach that triggers the quiet window).
2. **Do not re-specify primitives inside Lead Gen.** Reference Foundations §11 and move on. Re-specifying creates drift risk if the primitive is later adjusted.
3. **If Lead Gen's design surfaces a reason the primitive should change** — e.g. the Brand Voice drift check turns out to need Opus-tier rather than Haiku-tier for certain generation types — stop, flag it explicitly, and spin up a brief Foundations revisit rather than drifting silently.
4. **The 5 deferred upgrades are not forgotten** — they're documented in this handoff note's "What was explicitly NOT integrated" section. If Andy later asks "what about the undo toast / morning audio / Monday PDF / semantic search / portal trailer", point him here.

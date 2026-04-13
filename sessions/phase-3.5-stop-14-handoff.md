# Phase 3.5 Stop 14 — Handoff

**Date:** 2026-04-13
**Scope:** Product-judgement session on the 4 legal/compliance questions surfaced by Batch C step 13 (legal / compliance sweep). Not a brainstorm — four locked-option questions, each with a standing recommendation; Andy picked.

## Decisions

All four locked Andy's recommendation (option A).

| # | Question | Decision |
|---|----------|----------|
| Q1 | Legal pages owner | **Standalone `docs/specs/legal-pages.md` mini-spec.** Owns `/lite/legal/privacy`, `/lite/legal/terms`, `/lite/legal/acceptable-use`, cookie policy sub-page, and the `/lite/legal` landing. Content LLM-drafted from template + Andy approve-once. Static MDX rendering. `legal_doc_versions` reference table for acceptance audit. |
| Q2 | DSR surface at v1.0 | **Email-only** at `privacy@superbadmedia.com.au` with 30-day response commitment stated in the Privacy Policy. No UI. Self-service "Request my data" button is explicitly v1.1. |
| Q3 | Cookie consent banner | **Geo-gated full GDPR banner for EU IPs** via MaxMind lookup + **universal footer "We use cookies — details" link** for everyone else pointing at `/lite/legal/cookie-policy`. EU consent state persisted in an audit table. Library choice (Klaro vs rolled-your-own) deferred to Phase 5 legal-pages build session. Rolled into legal-pages spec. |
| Q4 | SaaS signup acceptance pattern | **Single tickbox, inline links, two timestamps.** One unticked checkbox: "I accept the [Terms] and [Privacy Policy]." Submit disabled until ticked. Stamp both `tos_accepted_at` and `privacy_accepted_at` + record `legal_doc_versions.id` for each. Quote Builder acceptance mirrors the same pattern. |

## What got patched

`PATCHES_OWED.md` — new **"Phase 3.5 Stop 14 — product-judgement resolutions"** section inserted immediately before the step 15 section. Contains four authoritative resolution rows that disambiguate Batch C step 13 rows 199, 200, 203, 204:

- L1 resolution names the owner as a new standalone spec (not Content Engine §19).
- L2 resolution confirms email-only DSR, rolled into L1.
- L3 adds a new patch row for the cookie banner (no prior patch — new scope surfaced and resolved in the same session).
- L4 confirms the single-tickbox pattern on both SaaS signup and Quote Builder acceptance.

No other spec files touched this session. Downstream patches (new legal-pages spec drafting, SaaS signup tickbox columns, Quote Builder tickbox text, FOUNDATIONS §11 cookie-consent primitive if needed) are named in the PATCHES_OWED entries with explicit Phase 4 / Phase 5 gates.

## Patches owed (recorded, not applied here)

1. **New spec `docs/specs/legal-pages.md`** — tiny Phase 3 backfill session OR fold into Phase 4 foundation docs pass. Phase 4 to decide. Contents: 3 static pages + cookie policy sub-page + cookie consent component behaviour + DSR email contact + `legal_doc_versions` table schema + `cookie_consents` audit table schema.
2. **`docs/specs/saas-subscription-billing.md`** — add signup-form tickbox gating + `tos_accepted_at` + `privacy_accepted_at` columns + version-hash stamp. Phase 5 gate.
3. **`docs/specs/quote-builder.md`** — tickbox text + link targets confirmed; unblocks row 204 of PATCHES_OWED. Phase 5 gate.
4. **`FOUNDATIONS.md` §11** (likely) — cookie consent primitive + MaxMind geo-lookup helper + `cookie_consents` table as cross-cutting primitive. Phase 4 foundation session gate. (Will surface in Phase 4 when build plan reads the legal-pages spec.)

## What the next session should know

- **Phase 3.5 is done on the question side.** Only Stop 16 remains — Andy's explicit "Phase 3.5 closed, start Phase 4" acknowledgement.
- **No new scope opened.** Stop 14 closed 4 known-open questions with standing recommendations; no mop-up brainstorms required.
- **No memories updated.** Legal / compliance decisions don't generalise to behavioural memory — they're captured in PATCHES_OWED and the (future) legal-pages spec, which is the right home. `feedback_no_content_authoring` already covers the "LLM-drafts, Andy approves once" authoring pattern for legal copy.
- **PATCHES_OWED still the authoritative input for Phase 4.** Phase 4 Build Plan consumes the Pending list and slots each patch into the correct build session or foundation session. Stop 14's 4 resolution rows now sit alongside Batch C's step 13 rows.
- **legal-pages spec is small.** Recommend Phase 4 folds its drafting into the foundation-session docs pass rather than spawning a separate Phase 3 backfill session — it's ~200 lines, all Andy-judgement is already made, and holding up Phase 4 to run a Phase 3 mini-session would be wrong sequencing.

## Next Action pointer (for tracker update)

Phase 3.5 **Stop 16** — Andy's explicit exit approval to start Phase 4. No work for Claude to do on this stop except to present the Phase 3.5 summary and ask for the ack.

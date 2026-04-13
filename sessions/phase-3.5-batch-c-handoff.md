# Phase 3.5 Batch C — Handoff

**Date:** 2026-04-13
**Scope:** Phase 3.5 steps 8, 9, 12, 13, 15 — autonomous reconciliation pass (spec-pair contract audits / LLM job inventory vs registry / GHL cutover ack / legal-compliance sweep / success metrics + final literal-grep).
**Outcome:** Batch C closed. Only remaining Phase 3.5 item is Stop 14 (product-judgement) then Stop 16 (Andy's exit approval).

## What got done

### Step 8 — Glossary / naming consistency pass

- Added **§13 Glossary** to `FOUNDATIONS.md` immediately before the Phase 5 build-time disciplines section. Canonicalises Lead / Prospect / Client / Subscriber / Contact / Company with "NOT this" columns, documents onboarding entry paths (trial-shoot graduate vs direct/referral vs legacy), sales artefacts (Quote canonical, Proposal permitted only as client-facing surface copy on PDFs), hiring terms, and the Stripe identity boundary.
- **Stripe identity boundary**: `stripe.Customer` (Stripe payment identity) ≠ **Client** (retainer-holding contact) ≠ **customer** (banned as a standalone term in specs + code). Compound adjective `customer-facing` permitted. Raw `customer` allowed only in Stripe API references and code enum values where the vendor forces it.
- **22 literal replacements** applied inline across 6 specs (SaaS customer → Subscriber; retainer/SaaS clients → Clients/Subscribers): `onboarding-and-segmentation.md` (9), `saas-subscription-billing.md` (1), `surprise-and-delight.md` (1), `brand-dna-assessment.md` (3), `design-system-baseline.md` (6), `unified-inbox.md` (1), plus the larger "retainer and SaaS clients" phrase replacement in onboarding-and-segmentation IMPORTANT BUILD NOTE.
- F1.c glossary row in PATCHES_OWED marked **APPLIED 2026-04-13**.

### Step 9 — LLM job inventory vs model registry

- **Wholesale rewrite of `cost-usage-observatory.md` §4.2 registered-jobs inventory** against `lib/ai/prompts/INDEX.md` slugs as the canonical source. Every listed job now matches an INDEX entry. Added a "naming convention" paragraph at the top of §4.2 establishing INDEX.md as source of truth.
- **Stub-owed prompts** marked `[stub owed]` (prompt file not yet created — Phase 5 build session scope): Hiring Pipeline's 8 jobs, Setup Wizards `admin-setup-assistant`, S&D `delight-voice-line-generate`, Lead Gen `reply-classifier` / `icp-scorer`, Unified Inbox `inbox-threading` / `inbox-reply-suggest`, Daily Cockpit `cockpit-narrative-regen`.
- **Code-embedded prompts** marked `[code-embedded]` where the prompt lives in TS files alongside the feature rather than as a standalone markdown (acceptable pattern — Observatory tracks them either way).
- **Missing jobs added** to the inventory: Branded Invoicing 3 jobs, Client Management 3 jobs (including F4.b kickoff-variant note on `client-mgmt-bartender-opening-line`), Task Manager 1 job, full Quote Builder / Content Engine / Intro Funnel / Six-Week Plan / Inbox listings reconciled with INDEX.
- **Renames applied** to align with INDEX slugs: `outreach-writer` → `lead-gen-outreach-draft`, `quote-draft-from-context` → `quote-builder-draft-from-context`, etc.
- **F4.b kickoff-variant documented** at `lib/ai/prompts/client-management.md` — added subsection under `client-mgmt-bartender-opening-line` describing trigger (first retainer-mode portal login post-Brand-DNA-gate-clear), `kickoff = true` flag, retainer context inputs, output behaviour (acknowledge new chapter, surface first-shoot scheduling, "once your first invoice clears" modifier if invoice pending), bartender register constraints.

### Step 12 — GHL cutover acknowledgement

- Grepped all 21 specs + FOUNDATIONS for GHL / migration / legacy / HighLevel references.
- `onboarding-and-segmentation.md` §10 and §148 already codify "No legacy migration path. Existing GHL clients re-onboard through the same flow. GHL subscriptions cancelled manually once confirmed in Lite."
- FOUNDATIONS §4 (Marketing site strategy) already documents GHL hosting current marketing site + future retirement plan + intermediate forms strategy (iframe/script-tag replacement).
- Other "migration" hits are internal (Intro Funnel → Client portal `intro_funnel_portal_migration` task type; Six-Week Plan retainer migration on Won; Drizzle schema migrations) — none assume GHL data migration.
- **Conclusion:** GHL cutover assumption is consistent across all 21 specs. No patches required.

### Step 13 — Legal / compliance sweep

Strong coverage on:
- **Spam Act 2003** — Lead Gen §§4/6/12.L (List-Unsubscribe header + visible link + server-signed unsubscribe tokens with no expiry), Content Engine §§168/173–175/195 (consent_source + permission pass + one-click unsubscribe), FOUNDATIONS §14.
- **ATO tax invoice compliance** — Branded Invoicing §§3/5/Q6 (ABN, "Tax Invoice" title, itemised GST, globally unique number `SB-INV-2026-0001`).
- **GST canonicalisation** — Quote Builder Q6 (GST-inclusive stored; ex-GST derived), Stripe Tax flag FOUNDATIONS §4.
- **SMS consent** — Intro Funnel §4 `sms_consent_at` + DNC primitive §51.
- **OAuth consent** — Setup Wizards `oauth-consent` step + Unified Inbox Graph API.

**Six orphan concerns surfaced with no spec owner. All logged to PATCHES_OWED Pending:**

1. **Static legal pages owner** — `/lite/legal/terms`, `/lite/legal/privacy`, `/lite/legal/cookie-policy`. Quote PDF Q14 references a "terms link" with no target; SaaS signup needs ToS+Privacy acceptance surfaces. Recommend: new mini-spec `docs/specs/legal-pages.md` or append §19 to `content-engine.md`. LLM-drafted from template + Andy approve-once per `feedback_no_content_authoring`. → **Phase 4 Build Plan assigns owner, Phase 5 dedicated session.**
2. **ToS + Privacy acceptance at SaaS signup** — `saas-subscription-billing.md`. Add `tos_accepted_at` + `privacy_accepted_at` + `legal_doc_versions` version-hash reference. → **Phase 5 SaaS Subscription Billing session.**
3. **Tax record retention policy** — `FOUNDATIONS.md` §5. Add ≥7-year R2 backup retention + no-delete tooling for transactional tables. → **Phase 4 foundation session.**
4. **Credential vault primitive** — `FOUNDATIONS.md` §11. Add `lib/crypto/vault.ts` (AES-256-GCM, key from `CREDENTIAL_VAULT_KEY` env, AAD = context scope) as named primitive for Setup Wizards + Unified Inbox encrypted-storage references. → **Phase 4 foundation session.**
5. **Privacy Act 1988 (APP) DSR flow** — email-based in v1 (`privacy@superbadmedia.com.au`, 30-day response). Self-service portal is v1.1. Rolled into legal-pages spec owner.
6. **Quote "terms link" target** — `/lite/legal/terms#retainer-and-project-work`. Blocked on L1. → **Phase 5 Quote Builder session.**

### Step 15 — Success metrics + final literal-grep

- **Intro Funnel autonomy threshold sweep** (F2.e carry-forward from PATCHES_OWED row 103): 36 remaining numeric literals confirmed present (abandon cadence, advance notice, per-week cap, reschedule limit, refund window, SMS/email quiet hours, shoot duration). All 8 settings keys already enumerated on row 103. No re-architecture in-flight; applied alongside the deferred `settings.get()` migration in Phase 5 Intro Funnel build session.
- **Per-spec success metrics section**: 12 of 21 specs have no explicit section. Intentional deferral to v1.1 Strategic Planning feature per `project_strategic_planning_postlaunch.md`. Cost & Usage Observatory §3 + §4.2 already cover operational/economic metrics for v1. Acknowledged; no patches.
- **Final literal-grep** for autonomy-sensitive patterns (`setTimeout | setInterval | non-NEXT_PUBLIC process.env | Math.random | TODO | FIXME | XXX`): zero matches across 21 specs. Step 7a settings-registry sweep already caught spec-level autonomy literals. Clean.

## Key decisions (silently locked per `feedback_technical_decisions_claude_calls`)

- **INDEX.md slugs are canonical** when prompt files exist — Observatory registered-jobs inventory aligns to INDEX rather than the other way around.
- **Proposal** terminology permitted as client-facing surface copy on Quote PDFs (masthead, footer), but **Quote** remains the canonical data-model + internal term. Documented in glossary.
- **"Retainer client"** permitted only as disambiguation when both Client populations appear in the same sentence. Default is bare **Client** (retainer-holding contact).
- **Legal page content authoring** routed to LLM-drafted-from-template + Andy-approves-once — consistent with `feedback_no_content_authoring`; NOT queued as a content mini-session.
- **Compound adjective `customer-facing`** permitted as a term of art; standalone `customer` remains banned.
- **R2 backup retention ≥ 7 years** (exceeds ATO 5-year floor). No aged-out deletes in v1.

## Product-judgement questions surfaced for Stop 14

Step 13 raises 4 questions that are legal/product judgements, not technical. Candidates for Stop 14 bundling:

1. **Legal pages owner** — standalone mini-spec `docs/specs/legal-pages.md` vs append §19 to `content-engine.md`? (Recommendation: standalone. Content Engine is a subscriber-facing feature; legal pages are platform-level.)
2. **DSR v1 surface** — email-only (`privacy@superbadmedia.com.au` + 30-day commitment) vs also add a minimal "Request my data" button in subscriber settings at v1.0 launch? (Recommendation: email-only at v1.0, per `feedback_primary_action_focus` — push edge cases to support email. Subscriber settings button is v1.1.)
3. **Cookie consent banner** — AU-only legally requires minimal notice; EU visitors would trigger GDPR. Geo-gated banner for EU IPs only, or universal minimal footer notice, or nothing until EU traffic appears? (Recommendation: geo-gated for EU + single "We use cookies — details" footer link sitewide. Low effort, no visual noise for AU default audience.)
4. **SaaS signup acceptance pattern** — single tickbox "I accept the Terms and Privacy Policy" (common pattern, minimal friction) vs two separate tickboxes (legally crisper, more friction)? (Recommendation: single tickbox with both documents linked inline; stamp both timestamps.)

## What the next session should know

- **Phase 3.5 is one product-judgement session away from exit.** Stop 14 bundles any remaining Andy-facing questions; Stop 16 is Andy's explicit "Phase 3.5 closed, start Phase 4" ack.
- **PATCHES_OWED Pending section is authoritative for Phase 4.** Phase 4 Build Plan consumes the Pending list and slots each patch into the correct build session or foundation session. Nothing in Pending is a blocker for Phase 4 starting — they're gated patches with named sessions already.
- **No memories updated this session.** Batch C was checklist execution, not new brand/behavioural learning. The glossary patch and F1.c terminology lock are already captured in project/feedback memories from earlier sessions.
- **Context cost note**: Batch C ran inside a compacted session; the conversation summary covered steps 8 and 9. Steps 12, 13, 15 completed after the compaction boundary. No lost state — all patches committed to PATCHES_OWED and spec files.

# SuperBad Lite — Session Tracker

## 🧭 Next Action

**Phase:** 3 — Feature Specs (continuing — 2 specs locked, 4 new specs added to backlog via 2026-04-11 and 2026-04-12 mini-brainstorms; 14 specs total; 2 further features folded into existing planned specs via the 2026-04-12 upgrades integration — no new spec sessions added)
**Protocol:** `START_HERE.md` § Phase 3
**Produces next:** `docs/specs/lead-generation.md`

**Read before starting:** `CLAUDE.md`, `START_HERE.md`, `sessions/phase-3-sales-pipeline-handoff.md`, `sessions/phase-3-design-system-baseline-handoff.md`, **`sessions/phase-3-scope-patch-handoff.md`** (2026-04-11 mini-brainstorm — added Content Engine, Brand DNA Assessment, and Premium Onboarding + Revenue Segmentation), **`sessions/phase-3-context-engine-scope-patch-handoff.md`** (2026-04-12 mini-brainstorm — added Client Context Engine as v1 primitive; Lead Gen's "generate email" button is now a call into this primitive), **`sessions/phase-3-upgrades-integration-handoff.md`** (2026-04-12 — five cross-cutting primitives added to Foundations §11, two features folded into existing planned specs), `SCOPE.md` (especially "Lead generation & assisted outreach" AND the three "Additional v1 features" sections from the 2026-04-11, 2026-04-12 mini-brainstorm, and 2026-04-12 upgrades integration), `FOUNDATIONS.md` (especially new §11 Cross-cutting primitives + new build-time disciplines 13–17), `docs/specs/design-system-baseline.md`, **`docs/specs/sales-pipeline.md`** (now locked — Lead Gen drops cards into the `Lead` stage and is the source of the auto-nudge generation pipeline that Sales Pipeline references), `~/.claude/projects/-Users-Andy-Desktop-SuperBad-Lite/memory/MEMORY.md` (note the `project_brand_dna_as_perpetual_context.md` and `project_two_perpetual_contexts.md` memories).

**Next session topic:** Lead Generation spec. Pipeline is the spine; Lead Gen is the first feature to feed it. Covers: prospect search ("generate search"), enrichment, contact discovery, outreach drafting (used both for first-touch AND for the auto-nudge stale-deal flow), Resend integration, sender reputation, the `createDealFromLead` integration touchpoint into Pipeline.

**New cross-cutting constraints from the 2026-04-12 upgrades integration (read `FOUNDATIONS.md § 11` before drafting):** the Lead Gen spec must (a) route every outreach send through the gate-wrapped `sendEmail()` in the channel adapter — no direct Resend calls — so the safe-to-send gate and outreach quiet window both fire automatically (§11.2, §11.4); (b) pass every generated outreach draft through the brand-voice drift check before showing it to Andy (§11.5); (c) log every outreach send, every "generate" click, and every contact enrichment via the universal audit log helper (§11.1); (d) render any timestamp on the Lead Gen surface (last contact, next follow-up, queued-for-quiet-window) via `formatTimestamp()` (§11.3). These are Foundations rules, not spec additions — reference, don't re-specify.

**Likely first MC question:** prospect search source strategy — Apollo, SerpAPI scraping, both, or stub-now-decide-later. Trade-off is data quality vs. cost vs. terms-of-service exposure.

**Phase 3 spec backlog (updated 2026-04-12 — 1 new spec added via mini-brainstorm; 14 specs total, 2 locked):**

*Recommended ordering groups related specs and respects dependencies. Final order is Andy's call at each session start.*

1. `docs/specs/lead-generation.md` — **recommended next** (unchanged). The "generate email" button is now spec'd as a call into the Client Context Engine primitive with an empty-history cold-draft fallback — reference it in the spec, don't re-implement.
2. `docs/specs/intro-funnel.md` — landing page, $297 trial shoot purchase, feedback questionnaire, customer-side trial shoot view, branching to retainer/SaaS
3. `docs/specs/quote-builder.md`
4. `docs/specs/branded-invoicing.md` — manual-billed-company invoice generation, ATO-compliant tax invoices, auto-send around renewal
5. **`docs/specs/brand-dna-assessment.md`** — (2026-04-11 mini-brainstorm). THE premium retainer differentiator. 50–100 indirect-signal MC questions per bank, dual-mode (Founder / Business), shape-aware delivery, multi-stakeholder blending, signal-tag output, reusable as perpetual LLM context across the platform. Likely one of the largest spec sessions — question bank design + signal taxonomy are load-bearing creative work. Best tackled after Pipeline/Lead Gen but BEFORE onboarding-and-segmentation since that spec composes Brand DNA. Andy should load `superbad-brand-voice` and `superbad-visual-identity` skills at session start.
6. **`docs/specs/onboarding-and-segmentation.md`** — (2026-04-11 mini-brainstorm). Composes Brand DNA Assessment + Revenue Segmentation primitive into retainer onboarding (premium, deep) and SaaS customer onboarding (standardised, fast, with dashboard-nudged Brand DNA opt-in as upsell signal). Depends on `brand-dna-assessment.md` existing first. Also defines the `revenue_segmentation` primitive and the structured-data + behavioural upsell targeting layer.
7. **`docs/specs/client-context-engine.md`** — NEW (2026-04-12 mini-brainstorm). Per-contact always-on Claude engine. The "where you are in the conversation" companion to Brand DNA's "who they are at their core" — see `project_two_perpetual_contexts` memory. Invisible context store, active summaries (Haiku-tier, regenerate on material events), reactive drafts (Opus-tier, hybrid one-shot + optional nudge field, reusing Content Engine's rejection-chat primitive), auto-extracted action items with owners ("you" vs "them") + manual override, channel-aware with one-click switcher (email v1, SMS-ready via pluggable adapter). Engine does NOT raise independent attention flags — emits signals the Daily Cockpit consumes. Depends on Brand DNA Assessment (5) and Unified Inbox schema (referenced abstractly if not yet locked). Composed by Lead Gen, Client Management, Daily Cockpit, Sales Pipeline card hover. Likely a full session — close to Brand DNA in size. Budget accordingly. See `sessions/phase-3-context-engine-scope-patch-handoff.md` for the 5 locked decisions and architectural notes.
8. `docs/specs/client-management.md` — profile surfaces use Client Context Engine as the primary summary + draft tile; reference the primitive, don't re-implement.
9. `docs/specs/saas-subscription-billing.md`
10. **`docs/specs/content-engine.md`** — (2026-04-11 mini-brainstorm). Semi-autonomous SEO content engine: keyword-driven SerpAPI research + rankability scoring + Claude blog generation + one-gate rejection chat review + newsletter rewriting (Resend) + social draft generation with stub publish adapters. Blog published to `superbadmedia.com.au/blog/*` via Cloudflare path routing to Lite origin. **Best sequenced after Lead Gen** (reuses Resend cold-outreach patterns, Claude chat primitive, SerpAPI integration plumbing) AND after `brand-dna-assessment.md` (blog generation prompts read the Brand DNA profile as context — see `project_brand_dna_as_perpetual_context.md` memory).
11. `docs/specs/unified-inbox.md` — defines the comms schema that Client Context Engine reads from. If not locked before the Context Engine spec, reference abstractly and retrofit if needed.
12. `docs/specs/daily-cockpit.md` — consumes signals emitted by the Client Context Engine (last contact age, action item status, health score) as one of its attention-surfacing input streams.
13. `docs/specs/setup-wizards.md` — cross-cutting primitive
14. `docs/specs/hiring-pipeline.md` — parallel CRM for headhunting, reuses Pipeline's KanbanBoard + activity_log primitives

When Andy says "let's go", begin the next Phase 3 session following the protocol in `START_HERE.md`.

---

## Phase roadmap

- [ ] **Phase 0** — Pre-flight scaffolding *(done in the HQ session, before this project opened — see `docs/phase-0-scaffold-note.md`)*
- [x] **Phase 1** — Scope brainstorm → `SCOPE.md` *(locked 2026-04-11)*
- [x] **Phase 2** — Foundations brainstorm → `FOUNDATIONS.md` *(locked 2026-04-11)*
- [ ] **Phase 3** — Feature specs → `docs/specs/*.md` *(one session per feature)*
- [ ] **Phase 4** — Build plan → `BUILD_PLAN.md` **+ `AUTONOMY_PROTOCOL.md`** *(Andy requested 2026-04-11: when Phase 4 runs, produce a companion autonomy protocol alongside the build plan — defines per-session scope caps, verification gates, handoff discipline, scheduled/continuous autonomy modes, token budget kill-switch, and pause-for-Andy checkpoints. Phase 5 then executes against both documents. Do not skip this — Andy wants Phase 5 to run as hands-off as safely possible.)*
- [ ] **Phase 5** — Build execution → session by session
- [ ] **Phase 6** — Launch → `superbadmedia.com.au/lite` live

Phase 0 stays unchecked in this tracker because the session that did it (HQ) doesn't count as a Lite session — this tracker begins with Phase 1.

---

## Session log

| Session | Phase | Type | Summary | Handoff note |
|---|---|---|---|---|
| 2026-04-11 | 1 | Brainstorm | Scope locked — 6 core areas all in v1, setup wizards + unified inbox as cross-cutting, no fixed rate card, per-client retainer pricing inside Lite, zero manual media authoring | [phase-1-handoff.md](sessions/phase-1-handoff.md) |
| 2026-04-11 | 2 | Brainstorm | Foundations locked — Next.js App Router on reused HQ Coolify, SQLite+Drizzle+Litestream→R2, Auth.js v5 magic-link, Resend for all email, Stripe everything, shadcn/ui + Framer Motion + use-sound. Lite ships at `lite.superbadmedia.com.au` first, migrates to `/lite` path at launch. GHL gets switched off at cutover — nothing worth preserving. | [phase-2-handoff.md](sessions/phase-2-handoff.md) |
| 2026-04-11 | 3 | Spec | Design system baseline locked — surface strategy (warm stacked tints), 2-tier motion (house spring + 7 closed Tier 2 moments + 2 overlays), 2 density presets, graduated soft radius, BHS closed-list of 8 locations, Settings → Display panel (4 accessibility toggles + 3 theme presets + 3 typeface presets), pink as customer-warmth + focus, full token system, 11 build-time disciplines. New memory: curated brand-canonical customisation pattern. | [phase-3-design-system-baseline-handoff.md](sessions/phase-3-design-system-baseline-handoff.md) |
| 2026-04-11 | 3 | Spec | Sales Pipeline locked — 8 stages (Lead → Contacted → Conversation → Trial Shoot → Quoted → Negotiating → Won → Lost), three-entity CRM (Company + Contact + Deal), `billing_mode` flag for manual-billed companies, append-only activity log with three nullable FKs, two-tier hover card (desktop only), per-stage stale halo + snooze, Loss Reason modal with closed list of 7, Trial Shoot panel on Company profile, full Drizzle schema + validation rules, Stripe + Resend webhook idempotency from day one. **3 new specs spawned:** Branded Invoicing, Intro Funnel, Hiring Pipeline. **SCOPE.md alignment change:** Trial Shoot is now an explicit stage (was Conversation in SCOPE). **New memory:** SuperBad client size diversity (Andy correction). | [phase-3-sales-pipeline-handoff.md](sessions/phase-3-sales-pipeline-handoff.md) |
| 2026-04-11 | 3 | Scope patch | Mini-brainstorm added 3 new features to v1: **Content Engine** (semi-autonomous SEO blog + newsletter + social drafts with stub publish adapters, SerpAPI-driven keyword research, Cloudflare path routing to `/blog`, one-gate review with Claude rejection chat), **Brand DNA Assessment** (NASA-style dual-mode psychological + taste profile, 50–100 indirect-signal MC questions per bank, shape-aware multi-stakeholder blending, signal-tag output, perpetual LLM context across platform), **Premium Onboarding + Revenue Segmentation** (composes Brand DNA into retainer onboarding, standardised fast SaaS onboarding with dashboard-nudged Brand DNA as upsell signal, double segmentation layer). **Non-goal redrawn:** newsletter is now in scope for SuperBad's own owned audience; third-party campaign management remains out. **New memory:** Brand DNA as perpetual LLM context. | [phase-3-scope-patch-handoff.md](sessions/phase-3-scope-patch-handoff.md) |
| 2026-04-12 | 3 | Upgrades integration | Integrated the 7 "easy-fit" upgrades from `where-we-are.html § 4`. **5 cross-cutting primitives** added to `FOUNDATIONS.md` as new §11 (Universal Audit Log, Safe-To-Send Gate, Timezone-Correct Timestamps, Outreach Quiet Window, Brand-Voice Drift Check) with 5 new build-time disciplines (13–17). **2 features** folded into existing planned specs via new `SCOPE.md` "Additional v1 features (2026-04-12 upgrades shortlist)" section: Sentiment-Aware Reply Drafts (into `unified-inbox.md`), One-Click Client Data Export (into `client-management.md`). **No new spec sessions added** — feature additions reference their parent specs. Next Action block updated with the cross-cutting constraints the Lead Gen spec must honour. | [phase-3-upgrades-integration-handoff.md](sessions/phase-3-upgrades-integration-handoff.md) |
| 2026-04-12 | 3 | Scope patch | Mini-brainstorm added 1 new v1 **primitive**: **Client Context Engine** — per-contact always-on Claude engine storing comms + activity + action items + deal/delivery/invoice state + Brand DNA as invisible context, surfacing a living human-facing summary on every profile, producing hybrid one-shot-plus-nudge channel-aware draft replies on click, auto-extracting action items (with owners "you" vs "them") from every message with manual override. Active summaries (Haiku-tier, regen on material events) + reactive drafts (Opus-tier) + signals feed the Daily Cockpit, not a second attention surface. Reuses the Content Engine rejection-chat primitive for draft nudging — zero new chat infra. Treated as a primitive, not a feature: composed by Lead Gen, Client Management, Daily Cockpit, Sales Pipeline card hover; Lead Gen's "generate email" button becomes a call into this primitive with empty-history fallback. Pairs architecturally with Brand DNA as the "where you are in the conversation" half of the perpetual-context pair. Spec positioned at #7 in the backlog (after Onboarding + Segmentation, before Client Management). **New memory:** `project_two_perpetual_contexts.md` — Brand DNA + Context Engine must both be read on every client-facing LLM call. | [phase-3-context-engine-scope-patch-handoff.md](sessions/phase-3-context-engine-scope-patch-handoff.md) |

When a session completes, add a row here with a link to its handoff note.

---

## How to update this file

At the end of every session:

1. Tick the phase box if the whole phase is now complete.
2. Add a row to the session log.
3. Rewrite the **🧭 Next Action** block to point at whatever comes next (the next phase, or the next item inside the current multi-session phase).
4. Commit only if Andy asks — otherwise leave uncommitted.

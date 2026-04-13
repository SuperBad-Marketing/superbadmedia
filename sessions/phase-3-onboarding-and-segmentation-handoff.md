# Phase 3 — Onboarding + Revenue Segmentation — Handoff Note

**Date:** 2026-04-12
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/onboarding-and-segmentation.md`
**Status:** Locked, 34 questions resolved (including 5 sub-questions for Revenue Segmentation answer options).

---

## 1. What was built

A complete Phase 3 feature spec for Onboarding + Revenue Segmentation — the composition layer that orchestrates Brand DNA Assessment, Revenue Segmentation, setup wizards, and SaaS product config into audience-specific onboarding flows. 34 questions asked, all locked.

Two mid-brainstorm corrections from Andy:

1. **Q3 — Revenue Segmentation for retainer clients.** I proposed Andy filling in Revenue Segmentation on the admin side for retainer clients. Andy corrected: "you should not be creating extra manual work for me." Revenue Segmentation is SaaS-only. Retainer clients don't need it — they're already in a direct relationship.
2. **Q6 — Brand DNA in SaaS onboarding.** I incorrectly stated Brand DNA was not in the SaaS signup flow (confused with the trial shoot optional rule). Andy corrected: Brand DNA is a hard portal lock for BOTH retainer and SaaS. Optional for trial shoot only. **This confusion is flagged prominently in the spec (§17) as a build note to prevent the same mistake during implementation.**

Also one strategic redirect on Q10: I proposed a legacy migration path for GHL clients. Andy clarified there are no GHL clients to migrate — existing clients are manually managed and will go through the full onboarding as test runs.

**Spec structure (18 sections):**
1. The 34 locks (quick-reference table)
2. End-to-end journeys (retainer, SaaS, entry path convergence)
3. Revenue Segmentation primitive (purpose, questions, presentation, reuse)
4. Upsell targeting layer (two-tier model, surfaces, signals, retake signal)
5. Product config interface contract (metadata, components, constraints)
6. Onboarding portal and auth (URL structure, tokens, magic link)
7. Welcome emails (retainer, SaaS, non-start nudges, practical setup reminders)
8. Welcome screen (retainer with pre-populated summary, SaaS without)
9. Data model (columns on companies, no new tables)
10. Onboarding orchestrator (architecture, routing, resume)
11. Brand DNA retake nudge (purpose shift, trigger, value, signal)
12. Voice & delight treatment
13. Cross-spec flags
14. Content mini-session scope
15. Open questions
16. Risks
17. Reality check (includes build note about Brand DNA hard gate)
18. Phase 5 sizing

---

## 2. Key decisions summary

- **Retainer onboarding:** quote acceptance auto-triggers → welcome email → welcome screen (with Claude-generated "what we already know" summary) → Brand DNA → practical setup (return-when-ready).
- **SaaS onboarding:** payment → welcome email → welcome screen → Brand DNA (hard gate) → Revenue Segmentation → product config → credentials → product unlocked.
- **Revenue Segmentation is SaaS-only.** 5 questions, ~2 minutes. Stored as columns on `companies`.
- **All retainer clients enter via quote acceptance.** No alternative trigger. Direct/referral clients go through Quote Builder first.
- **No legacy migration.** Existing clients re-onboard through the same flow.
- **Two-tier upsell targeting:** Warm (budget OR engagement) and Hot (budget AND engagement AND goal). Both require Victoria, Australia location (configurable).
- **Onboarding progress derived from primitives** — no dedicated state table.
- **Token-based portal access** for onboarding, magic link only for ongoing auth.
- **Brand DNA retake nudge** replaces the original "complete your profile" nudge. 12-month threshold.
- **Product config interface contract:** `productConfig` + `firstRunView` components + metadata object.
- **Welcome screen "what we already know" paragraph** is the highest-leverage creative task — Claude-synthesised from unstructured deal notes.
- **Company auto-created for all SaaS signups** (even solo operators) for data model consistency.

---

## 3. Sprinkle bank updates

Two items claimed:
- **Welcome email first line** (§3) — `[CLAIMED by onboarding-and-segmentation]`
- **Client portal footer** (§7) — `[CLAIMED by onboarding-and-segmentation]`

---

## 4. Cross-spec flags (consolidated)

### 4.1 Quote Builder (LOCKED)
- Quote acceptance must fire onboarding sequence (welcome email + portal token generation).

### 4.2 Sales Pipeline (LOCKED)
- `companies.location` is a new column. Pipeline should capture during deal creation.
- Upsell filter surfaces as a standing pipeline filter.

### 4.3 Client Context Engine (#7)
- Welcome email reads Context Engine summary as prompt input.

### 4.4 Daily Cockpit (#12)
- Consumes: Hot upsell alerts, stalled onboarding counts, incomplete practical setup flags, Brand DNA retake notifications.

### 4.5 Client Management (#8)
- Profile shows onboarding status (derived). Portal includes retake nudge card.

### 4.6 Setup Wizards (#13)
- Practical setup steps are wizard instances.

### 4.7 SaaS Subscription Billing (#9)
- Payment success triggers SaaS onboarding.

### 4.8 Foundations
- All emails through `sendEmail()` with `classification: 'transactional'`.
- All Claude client-facing copy through drift check.

### 4.9 `activity_log.kind`
- Gains ~8 values.

---

## 5. New columns (no new tables)

On `companies`:
- `revenue_range` (enum, nullable)
- `team_size` (enum, nullable)
- `biggest_constraint` (enum, nullable)
- `twelve_month_goal` (enum, nullable)
- `industry_vertical` (enum, nullable)
- `industry_vertical_other` (text, nullable)
- `location` (text)
- `revenue_segmentation_completed_at` (timestamp, nullable)

---

## 6. No new memories

No new principles surfaced. The spec applied existing memories (multiple entry paths, pre-populated trial, individual feel, no Lite on client-facing, Brand DNA as perpetual context, two perpetual contexts, hand-held setup, primary action focus) without needing new ones.

---

## 7. Content mini-session scope

Minimal — most copy is Claude-generated at runtime. Can fold into another spec's content session:
- Welcome screen step preview copy (2 variants)
- Revenue Segmentation frame + question presentation copy
- Resume screen copy
- Practical setup step instructions
- Nudge email templates
- Retake nudge card copy

---

## 8. Phase 5 sizing

2 sessions:
- **Session A:** Data model + orchestrator + welcome screen + welcome email + token auth + credentials.
- **Session B:** Revenue Segmentation UI + practical setup + upsell targeting + nudges + retake nudge.

Session A before any SaaS product build. Session B can parallel product builds.

---

## 9. What the next session should know

### 9.1 Next recommended spec: Client Context Engine (#7)

The "where you are in the conversation" companion to Brand DNA's "who they are." Per-contact always-on Claude engine. Invisible context store, active summaries, reactive drafts, auto-extracted action items. This spec already has 5 locked decisions from the mini-brainstorm (see `sessions/phase-3-context-engine-scope-patch-handoff.md`). Likely a full session — close to Brand DNA in size.

### 9.2 Things easily missed

- **Brand DNA is a hard gate for retainer AND SaaS.** This was confused during the brainstorm — flagged in the spec. Trial shoot is the only audience where it's optional.
- **The "what we already know" welcome paragraph.** If the Claude prompt for this synthesis produces generic output, the premium onboarding feeling collapses. The content mini-session should produce test cases.
- **Location as a gate.** Upsell targeting requires Victoria, Australia. If location data is missing or inconsistent (free text), the filter breaks. Monitor post-launch and consider structured enum if needed.
- **Company auto-creation for SaaS.** Every SaaS signup creates a company record. Solo operators without a business name use their full name. This is a data model convention other specs should be aware of.

---

## 10. Backlog state

**Phase 3 spec backlog: 17 total, 9 locked, 8 remaining.**

Locked: Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel, Quote Builder, Branded Invoicing, Surprise & Delight (pre-written), Task Manager, Brand DNA Assessment, **Onboarding + Segmentation** (this session).

Next recommended: Client Context Engine (#7).

---

**End of handoff.**

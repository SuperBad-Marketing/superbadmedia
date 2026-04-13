# Phase 3 — Brand DNA Assessment — Handoff Note

**Date:** 2026-04-12
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/brand-dna-assessment.md`
**Status:** Locked, 30 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for Brand DNA Assessment — the flagship feature and premium retainer differentiator. 30 multi-choice questions asked, all locked. Two mid-brainstorm redirects from Andy:

1. **Q11 — track structure.** I proposed killing Business mode entirely and replacing it with an optional supplement. Andy redirected to three distinct tracks (Founder / Business / Founder + Supplement) routed by an alignment gate question, because Business-mode needs its own "we/the brand" framing rather than just being Founder-mode with a supplement bolted on.
2. **Q28 — client-facing branding.** Andy corrected "SuperBad Lite" in browser tab titles — client-facing surfaces must always say "SuperBad", never "SuperBad Lite." New memory saved: `feedback_no_lite_on_client_facing.md`. Applies to every spec going forward.

Also one calibration note on Q14 (between-section insights): Andy flagged that the example insight I gave sounded like an AI wrote it. Locked constraint: insights must sound like a perceptive person, not an AI narrator. No "I notice", no "it's interesting that." Admin-roommate register. This is the highest-leverage prompt in the spec.

**Spec structure (17 sections):**
1. Purpose and shape
2. The 30 locks (quick-reference table)
3. End-to-end journey (access, gate, assessment flow, retake, multi-stakeholder)
4. Sections and question design (5 sections, 3 tracks, shape-awareness, visual options)
5. Signal tag taxonomy (two-level hierarchy, 5 domains, 40–60 tags)
6. Profile output (tags, prose portrait, first impression, insights, blend, retake comparison)
7. Downstream consumption (tiered injection, absent profile fallback, which-profile rules)
8. Data model (4 new tables)
9. Claude prompts (5 prompts, all Opus)
10. Assessment UI (card-per-question, ambient visual evolution, transition cards, reveal sequence, portal gate)
11. SuperBad's own profile (Phase 5 milestone)
12. Voice & delight treatment
13. Cross-spec flags
14. Content mini-session scope
15. Open questions
16. Risks
17. Reality check

---

## 2. Key decisions summary

- **Full psychological + aesthetic + communication profile.** Not just taste — values, instincts, decision-making, brand aspiration.
- **Three tracks** routed by alignment gate: Founder ("you"), Business ("we/the brand"), Founder + Supplement (captures where the brand diverges from the founder).
- **Mixed question format:** scenarios for psychology/values, preferences for aesthetics/taste. One optional free-form reflection at the end.
- **Shape-aware framing** within each track (solo_founder / founder_led_team / multi_stakeholder_company). Same tags, different question wording.
- **4 options per MC question, consistently.** Even number forces a lean.
- **Each option maps to 1–3 tags, unweighted.** Frequency does the weighting.
- **Two-level tag taxonomy:** domain → tag, ~40–60 tags across 5 domains.
- **Profile output:** structured tags JSON + Opus prose portrait (500–800 words) + first impression (2–3 sentences).
- **Between-section Opus insights (×4)** — live generation, human register, flat delivery. The flagship micro-moments.
- **Cinematic reveal:** first impression lead-in → beat → section-by-section profile build with tags + prose.
- **Multi-stakeholder:** individual profiles + Claude-blended company profile. Equal weight, divergence flagged.
- **Hard portal lock** with visible preview until assessment is complete (retainer/SaaS). Optional for trial shoot.
- **Full retake from scratch,** side-by-side comparison with Claude-highlighted shifts.
- **Tiered downstream injection:** full profile for Opus calls, tags-only for Haiku calls.
- **~60–70% shared questions** (pronoun swap between tracks), **~30–40% track-exclusive.** Easily adjustable.
- **SuperBad's own profile** — Andy takes the assessment as SuperBad, cross-references against brand skills, resolves conflicts. Phase 5 milestone.

---

## 3. New memory

- **`feedback_no_lite_on_client_facing.md`** — client-facing surfaces always say "SuperBad", never "SuperBad Lite." Lite is the internal/admin name. Applies to every spec's client-facing surfaces: tab titles, emails, PDFs, portals, assessment, quotes, invoices.

---

## 4. Cross-spec flags (consolidated)

### 4.1 Onboarding + Segmentation (#6)
- Brand DNA is a hard gate in retainer/SaaS onboarding. This spec defines the primitive; Onboarding composes it.

### 4.2 Client Context Engine (#7)
- Reads Brand DNA as perpetual context. Tiered injection.

### 4.3 Intro Funnel (LOCKED)
- Trial shoot clients nudged to complete Brand DNA from portal. Between-section insights inherit synthesis reveal Tier-2 slot.

### 4.4 Client Management (#8)
- Profile page shows Brand DNA completion status.

### 4.5 Surprise & Delight (LOCKED)
- Silent build dependency: S&D blocks on Brand DNA shipping + Andy completing SuperBad's own assessment.

### 4.6 Content Engine (#10)
- Reads Brand DNA for voice conditioning.

### 4.7 Daily Cockpit (#12)
- Morning brief reads SuperBad's Brand DNA for tone.

### 4.8 Sales Pipeline (LOCKED)
- `contacts` may need `brand_dna_status` field. Non-breaking.

### 4.9 Design System Baseline (LOCKED)
- Tier-2 grows by 1 (cinematic reveal). Sound registry grows by 1 (`sound:brand_dna_reveal`).

### 4.10 `activity_log.kind`
- Gains ~8 values.

---

## 5. New tables

- `brand_dna_profiles` — full schema in spec §8.1
- `brand_dna_answers` — per-answer storage, spec §8.2
- `brand_dna_blends` — multi-stakeholder company blends, spec §8.3
- `brand_dna_invites` — tokenised invite links, spec §8.4

Question banks are static content files (TypeScript/JSON), not database tables.

---

## 6. Content mini-session scope

The largest content session in the project. Produces:
- 30 core question banks (5 sections × 3 shapes × 2 framings)
- 1 supplement bank
- Signal tag taxonomy (40–60 tags)
- Tag mappings per option
- Visual asset generation for ~20–30% of questions
- All 5 Claude prompt templates (insight, first impression, portrait, blend, comparison)
- Alignment gate wording
- Free-form reflection wording
- Section visual world art direction
- All ambient voice copy
- Browser tab title treatments
- Intro screen copy

Must run before Phase 5 Brand DNA build sessions.

---

## 7. Phase 5 sizing

3–4 sessions:
- **Session A:** Data model + invite system + alignment gate + section save/resume
- **Session B:** Card UI + section transitions + ambient visual evolution + between-section insight calls
- **Session C:** Profile generation + cinematic reveal + first impression + sound + motion
- **Session D:** Multi-stakeholder blend + retake comparison + portal gate integration

A and B can run in parallel. C depends on B. D depends on A and C.

**Post-build milestone:** Andy takes SuperBad's own assessment. Cross-reference against brand skills. Unlocks S&D build.

---

## 8. What the next session should know

### 8.1 Next recommended spec: Onboarding + Segmentation (#6)

Onboarding composes Brand DNA (now locked) into retainer and SaaS onboarding flows. Also defines the Revenue Segmentation primitive. Natural next step — it's the primary consumer of the Brand DNA primitive and the dependency is one-directional.

### 8.2 Things easily missed

- **The "no Lite on client-facing" rule is new.** Every spec that defines client-facing surfaces (portal, assessment, quotes, invoices, emails, tab titles) must use "SuperBad", never "SuperBad Lite." Check previously locked specs (Quote Builder, Branded Invoicing, Intro Funnel) for violations during the Phase 3.5 review — they may reference "SuperBad Lite" in client-facing copy.
- **Shape detection for non-Intro-Funnel entries.** Open question (spec §15.3). Tokenised invite links need a way to capture shape. Either Andy sets it when generating the link, or the assessment asks alongside the alignment gate.
- **The insight prompt is the critical path.** If the between-section insights sound like AI, the flagship experience fails. The content mini-session must run multiple test answer sets through the prompt before locking it.
- **31 question banks is a lot of content.** But ~60–70% is shared core with pronoun swaps, and shape variants are systematic framing changes. The content mini-session should write the master questions first, then generate variants.

---

## 9. Backlog state

**Phase 3 spec backlog: 17 total, 8 locked, 9 remaining.**

Locked: Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel, Quote Builder, Branded Invoicing, Surprise & Delight (pre-written), Task Manager, **Brand DNA Assessment** (this session).

Next recommended: Onboarding + Segmentation (#6).

---

**End of handoff.**

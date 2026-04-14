# SuperBad Marketing Site — Build Plan

_Derived from VISUAL_BRIEF.md + SITEMAP.md + PARKED.md. Phased, session-sized, respects the Lite CLAUDE.md discipline (tight scope per session, verification gates, handoff notes)._

---

## Dependency — read this first

**The marketing site cannot be built yet.** Per Lite `CLAUDE.md`, where the marketing site lives (separate repo? subfolder of Lite? existing hosting?), what stack it uses, and how we deploy it is a **Phase 2 Foundations question for the Lite project** that is currently unresolved.

Until Lite Phase 2 surfaces that decision, the marketing site work stays in **brainstorm + spec mode only** — no code, no scaffolding, no hosting setup. This is a feature, not a bug; it protects us from building on assumptions.

What _can_ happen in parallel with the Lite build: Phase M2 (specs), Phase M3 (content production), Phase M4 (LUT refinement, voice file, asset prep). All build-adjacent but no platform commits.

---

## Phased plan

### Phase M0 — Visual & experiential brainstorm _(✓ complete)_

Output: `VISUAL_BRIEF.md`, `SITEMAP.md`, `PARKED.md`, `luts/*.cube`, `grading-comparison.html`.

---

### Phase M1 — Sub-brainstorms (resolve parked items)

Three bounded sessions, each end-to-end on their own. Run before spec work.

| # | Session | Input | Output | Blocks |
|---|---|---|---|---|
| **M1.1** | Self-shot portfolio list | PARKED P1 | `docs/brainstorm/marketing-site/SHOOT_LIST.md` — 3–4 anchor concepts + 8–12 supporting concepts | Blocks Phase M3 content production |
| **M1.2** | Performance proof-of-work strategy | PARKED P2 | `docs/brainstorm/marketing-site/PERFORMANCE_PROOF.md` — decision on how performance credibility is demonstrated on launch | Blocks M1.3 (Trial funnel) and M2 Services spec |
| **M1.3** | Start-a-Trial funnel sub-brainstorm | PARKED P3, depends on M1.2 | `docs/brainstorm/marketing-site/TRIAL_FUNNEL.md` — entry page, services page, pricing, booking flow, pre-filled experience, About-embedding | Blocks M2 Trial funnel spec |

**⚠ M1.3 paused 2026-04-14.** The Lite `docs/specs/intro-funnel.md` is actively under Phase 3.5 / Phase 5 build work. Running M1.3 now would force premature judgement calls on surfaces the Lite team is still shaping (landing page URL canonicalisation, services/pricing placement, pre-filled outreach arrival, About-embed). **Resume trigger:** Lite Intro Funnel reaches stable build state (all Phase 3.5 patches landed + initial Phase 5 build sessions complete for intro-funnel surfaces). Until then M1.3 is blocked — not on another brainstorm, on the Lite build itself.

**Rule per Lite CLAUDE.md:** no sub-brainstorm spawns another sub-brainstorm. If something new surfaces, park it for M1.4+ after M1.3 closes.

---

### Phase M2 — Feature specs (one per page/surface)

Session-sized specs, each produces a single `docs/specs/marketing-site/<page>.md` file with: layout, copy placement, motion spec, desktop + mobile compositions, voice file keys used, data contract, edge cases.

Dependencies run top-down.

| # | Session | Produces | Depends on |
|---|---|---|---|
| **M2.1** | Spec — shared primitives (motion tokens, spring definitions, type scale, grain spec, voice file shape, grade LUT usage contract) | `docs/specs/marketing-site/primitives.md` | — |
| **M2.2** | Spec — nav + footer (including per-route footer lines) | `docs/specs/marketing-site/chrome.md` | M2.1 |
| **M2.3** | Spec — homepage (4 sections + entry moment) | `docs/specs/marketing-site/home.md` | M2.1, M2.2 |
| **M2.4** | Spec — `/work` grid (curated, anchors at rhythm points) | `docs/specs/marketing-site/work-index.md` | M2.1 |
| **M2.5** | Spec — `/work/[slug]` (anchor + supporting templates) | `docs/specs/marketing-site/work-detail.md` | M2.4 |
| **M2.6** | Spec — `/thinking` index (lead row + flat list) | `docs/specs/marketing-site/thinking-index.md` | M2.1 |
| **M2.7** | Spec — `/thinking/[slug]` (B default, D utility, C anchor opt-in) | `docs/specs/marketing-site/thinking-detail.md` | M2.6 |
| **M2.8** | Spec — `/start` funnel | `docs/specs/marketing-site/start-funnel.md` | M1.3 (sub-brainstorm), M2.1 |
| **M2.9** | Spec — utility surfaces (404, loading, empty, form states) + `voice/utility.ts` schema | `docs/specs/marketing-site/utility.md` | M2.1 |
| **M2.10** | Spec review + reconciliation (mirrors Lite Phase 3.5) | Patch notes + sign-off | M2.1–M2.9 complete |

---

### Phase M3 — Content production (parallel with M2 where possible)

| # | Session | Produces | Depends on |
|---|---|---|---|
| **M3.1** | Shoot production plan — sequence the shoot list (M1.1) into production batches | Production schedule | M1.1 |
| **M3.2** | Shoot batch 1 — anchor pieces 1 & 2 | Video + stills | M3.1 |
| **M3.3** | Shoot batch 2 — anchor pieces 3 & 4 | Video + stills | M3.1 |
| **M3.4** | Shoot batch 3 — supporting pieces | Video | M3.1 |
| **M3.5** | Anchor write-ups — brief / outcome paragraphs / pull quotes for the 4 anchors | Anchor copy | M3.2, M3.3, M2.5 |
| **M3.6** | Voice file content — all per-route footer lines + utility strings (404, loading, form errors, successes, email confirmations) | `voice/utility.ts` content | M2.9 |
| **M3.7** | LUT application pass — apply A LUT to all shot footage, refine the LUT based on real material | Updated LUTs + graded masters | M3.2–M3.4 |
| **M3.8** | Thinking essays — draft launch content (1 anchor essay + 2 editorial essays + 2 short posts minimum) | Essay drafts | M2.7 |
| **M3.9** | Start-a-Trial content — Andy's About-embedded paragraph + portrait + quote + services copy + pricing copy | Trial funnel content | M1.3, M2.8 |

---

### Phase M4 — Foundations (Lite-dependent)

**Cannot start until Lite Phase 2 resolves where the marketing site lives.**

| # | Session | Produces |
|---|---|---|
| **M4.1** | Tech stack + hosting lock | `FOUNDATIONS.md` for marketing site |
| **M4.2** | Repo setup, deploy pipeline, domain routing for `/` vs `/lite` | Working dev environment |
| **M4.3** | Design system scaffold — CSS tokens (palette, type, springs, grain), base components | Design system foundation |

---

### Phase M5 — Build execution

Assumes M1, M2, M3, M4 all complete. Session sequence keeps each build tight.

| # | Session | Builds |
|---|---|---|
| **M5.1** | Chrome — nav (hide/return), footer (per-route lines), 404 page, base layout, grain layer | Persistent chrome working on every route |
| **M5.2** | Motion system — UI spring + narrative spring tokens, reduced-motion fallbacks, entry paint sequence | Every motion primitive live |
| **M5.3** | Homepage build — 4 sections, composed-frame hero, Work preview grid, Thinking card, CTA | `/` working end-to-end |
| **M5.4** | Work grid — `/work` with curated ordering, anchor vs supporting tile treatment, hover previews | Work door live |
| **M5.5** | Work detail — grid-to-detail transition (zoom + projector shutter), anchor template, supporting template, opt-in audio | Any work piece can be published and rendered |
| **M5.6** | Thinking index — `/thinking` with lead row + list | Thinking door live |
| **M5.7** | Thinking detail — editorial template (B), utility template (D), cinematic template (C) | Any essay can be published |
| **M5.8** | Start-a-Trial — entry page with About-embedded content, services page, pricing page, booking flow | Trial funnel live |
| **M5.9** | Utility pass — loading states, empty states, form states, email templates — all pulling from `voice/utility.ts` | Every utility surface voice-consistent |
| **M5.10** | QA pass — reduced-motion, mobile compositions, load performance, grain layer perf on mobile, LUT rendering on actual footage | Launch-ready |

---

### Phase M6 — Launch + iterate

| # | Session | |
|---|---|---|
| **M6.1** | Domain cutover from existing marketing site to new marketing site |
| **M6.2** | Monitoring, analytics, error tracking |
| **M6.3** | First content iteration based on real visitor behaviour |

---

## Discipline notes (inherit from Lite CLAUDE.md)

- **Tight scope per session** — each row in the tables above is one conversation, not a week of work. If a session looks borderline, split it.
- **Handoff notes mandatory** — every session ends with a `sessions/<id>-handoff.md` note.
- **Verification gates** — typecheck + test + manual browser + handoff before commit.
- **Auto-commit on clean stopping points** — don't ask.
- **Two-composition rule** — every M5.x build session produces both desktop and mobile compositions, tested at real viewports.
- **Voice discipline** — never write utility strings inline; always in `voice/utility.ts`. Lint rule or pre-commit check should enforce this.
- **Reduced-motion check** — every motion moment has an a11y fallback; M5.2 establishes it, every subsequent session respects it.

---

## What happens now

1. **M1.1 is the highest-leverage next session** — self-shot portfolio list. Andy can pre-visualise what actually shoots while the rest of the plan waits for Lite Phase 2.
2. **M1.2 can run in parallel** — performance proof strategy doesn't depend on shoots.
3. **M1.3 needs M1.2 first.**
4. **Phase M2 specs can start after M1 closes**, in parallel with M3 content production and in parallel with the Lite main build.
5. **Phase M4 (foundations) unblocks only when Lite Phase 2 lands.** That's the critical path.

No part of Phase M5 (build execution) can begin until M1, M2, M3, M4 are all complete for their respective dependencies. That's the protection against building on unknowns.

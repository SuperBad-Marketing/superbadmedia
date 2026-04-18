# `cms-3` — Content Engine content mini-session — Handoff

**Closed:** 2026-04-18
**Type:** Content mini-session (Batch B, item 1 of 2)
**Model tier:** Opus (creative — large multi-surface content session)

---

## What was built

The **complete creative content layer** for the Content Engine feature. 8 new content docs + 1 prompt calibration file updated (10 prompts: stub → calibrated) + prompt index date bump. 9 files changed total.

### Content docs (8 new files)

| File | Purpose |
|---|---|
| `docs/content/content-engine/copy.md` | Loading states (5 dry-observation pools + 7 deadpan terse), 8 empty states, fleet overview labels/badges/empty state, 4 notification types with subject pools, cockpit integration signals, browser tab titles (11 surfaces), topic queue affordances |
| `docs/content/content-engine/demo-landing-page.md` | Demo page: hero, input form, convention-break callout, result section (keyword + outline + excerpt), automation pitch, tier cards transition, result persistence note |
| `docs/content/content-engine/blog-cta.md` | SuperBad's own blog CTA (sprinkle claim — 4 rotation variants) + standard newsletter opt-in CTA structure/copy/consent |
| `docs/content/content-engine/emails.md` | 7 email types: draft-ready, post-published, newsletter-sent, domain-verification-reminder, list-milestone (5 milestones with subject pools, sprinkle claim), permission-pass, weekly-research-summary (admin). Subject line pools per type. Voice conventions locked. |
| `docs/content/content-engine/newsletter-template.md` | Standalone + digest newsletter email template design. Brand DNA token mapping. SuperBad's own newsletter tokens. SuperBad blog CTA in newsletter. Technical render notes. |
| `docs/content/content-engine/social-templates.md` | 12-template library: 4 typography (pull quote, stat, listicle, provocation), 4 content cards (preview, before/after, excerpt, newsletter teaser), 2 carousel frames (section-per-slide, key takeaways), 2 utility (OG image + embed preview). 20-line dry OG card pool (sprinkle claim). Template selection logic. AI image fallback art direction. |
| `docs/content/content-engine/embed-form.md` | Embeddable opt-in form: HTML structure, default copy, 4 states, CSS token mapping from Brand DNA, embed snippet, SuperBad's own form tokens, consent model |
| `docs/content/content-engine/remotion.md` | 4 Remotion motion templates (kinetic quote, stat counter, takeaway scroll, before/after split). Brand DNA token injection. Format targets per platform. Selection logic. Production notes. |

### Prompt calibration (1 file updated)

| File | Change |
|---|---|
| `lib/ai/prompts/content-engine.md` | Status: `stub` → `calibrated`. All 10 prompts fully specified: system prompts, input/output types, scoring rubrics, voice calibration, Brand DNA injection patterns, anti-patterns, drift check integration. |
| `lib/ai/prompts/INDEX.md` | Date bump: 2026-04-17 → 2026-04-18 |

## Key decisions

1. **Loading states: mixed register.** Andy chose option C: dry observation for generation steps (heavier work earns more voice), deadpan terse for mechanical steps. "publishing." vs "writing 1,400 words about physiotherapy. the things we do."

2. **20-line OG dry pool for SuperBad posts.** Rotation pool (same decision pattern as QB PDF cover lines from CMS-2). No LLM call at publish time — random pick from pre-approved pool.

3. **12 templates, not 10–15.** Spec said "~10–15." Landed on 12 — four per category, clean. Covers all content structures without redundancy.

4. **Usage bar personality starts at 41%, not 0%.** Low usage (0–40%) gets NO personality text. Commentary at 10% feels desperate. The number is the voice.

5. **Blog post generation prompt includes AI search citation tuning.** "Lead each section with a direct factual answer before expanding" — spec §2.1 Stage 3 requirement baked into the prompt.

6. **Newsletter template supports dark mode.** Brand DNA aesthetic tags (`monochrome_comfort`, `high_contrast`) can trigger a dark-background newsletter. Default is light.

## What the next session (CMS-4) should know

- CMS-4 covers SaaS Subscription Billing content. Some files already exist from earlier sessions (SB-3/SB-5): `checkout.md` and `pricing-page.md`.
- CMS-4 produces the remaining: usage bar, cap screen, lockout screen, cancel flow motivational reality check, 9 email templates, upgrade confirmation, first-login bartender line, admin empty states, browser tab titles.
- **These have already been produced in this session** alongside CMS-3 (Batch B ran both together). CMS-4 handoff follows immediately.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 193 files, 1637 passed, 0 failures, 1 skipped
- No build-breaking changes (content docs + prompt calibration only)

## PATCHES_OWED (raised this session)

None. All deliverables from spec §16 covered. Prompt stubs upgraded to calibrated.

## Rollback strategy

`git-revertable`. No migration, no schema change. Reverting removes all content docs and reverts prompt calibration to stub state.

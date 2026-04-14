# `BDA-POLISH-1` — Brand DNA visual-fidelity remediation — Session Brief

> **Remediation session. Not from BUILD_PLAN.md — triggered by Andy's review on 2026-04-14: built BDA surface is visually generic and misses the flagship bar.**
> Root cause: BDA-1..4 briefs cited only the spec, never `mockup-brand-dna.html`. Shipped UI = flat neutral cards; mockup = ambient-scene flagship experience. See memory `feedback_visual_references_binding`.

---

## 1. Identity

- **Session id:** `BDA-POLISH-1`
- **Wave:** `3 — Brand DNA Assessment (remediation)`
- **Type:** `UI`
- **Model tier:** `/deep` (Opus) — flagship surface; visual judgement + motion polish; Andy's memory `project_brand_dna_flagship_experience` — "must feel incredible."
- **Sonnet-safe:** `no` — do not fall back.
- **Estimated context:** `large` — multi-route + mockup parity + motion.

## 2. Spec references

- `docs/specs/brand-dna-assessment.md` §§4.1–4.4, §§10.1–10.7 — card UI, visual environments, ambient scenes.
- `docs/specs/brand-dna-assessment.md` §3.2–3.3 — alignment gate (already built; verify polish).

## 2a. Visual references (BINDING — per AUTONOMY_PROTOCOL G0)

The previous BDA sessions skipped this step. That's the whole reason this session exists. Open every file below and treat the mockup as ground truth. Deviations require explicit justification here.

- **`mockup-brand-dna.html`** — **primary binding reference.** All routes under `/lite/brand-dna/**` must match this mockup's palette, typography, ambient environment, progress chrome, option cards, and scene transitions. Specifically:
  - CSS variables: `--brand-red: #B22848`, `--brand-cream: #FDF5E6`, `--brand-pink: #F4A0B0`, `--brand-orange: #F28C52`, `--brand-charcoal: #1A1A18`, and the neutral ramp.
  - Fonts: `Pacifico` (logo wordmark), `Righteous` (eyebrow/labels, uppercase, letter-spacing), `DM Sans` (body + question text), `Playfair Display` italic (reveal accents), `Black Han Sans` (reveal bold).
  - Ambient scene: three blurred coloured blobs (`.b1`/`.b2`/`.b3`), `filter: blur(80px)`, scene-specific transforms per section (`body.scene-1/2/3`).
  - SVG noise texture overlay at 4% opacity, `mix-blend-mode: overlay`.
  - Question card: Righteous eyebrow with trailing hairline rule in `brand-pink` at 20% opacity; `DM Sans` 500 weight, 38px question text in `brand-cream`; 2-column option grid; option hover lifts `-2px` with `brand-pink` border at 40% opacity.
  - Progress bar: 44×2px segments, `brand-pink` when done, `brand-cream` scaleX on active.
  - Motion: `cubic-bezier(0.16, 1, 0.3, 1)` spring, 800–1200ms scene transitions, 900ms `riseIn` card entry.
- **`docs/superbad_brand_guidelines.html`** — palette + typography source of truth; confirm mockup values match guidelines before porting.
- **`docs/superbad_voice_profile.html`** — voice for any copy rewrites; do not fabricate copy, keep existing spec copy unless it breaks on the mockup layout.

**Intentional divergences from the mockup:** none. If something in the mockup won't port cleanly (e.g. `overflow: hidden` on body conflicts with Next's scroll), note the divergence + reason in the handoff, not here.

## 3. Acceptance criteria (verbatim from review)

```
1. Landing `/lite/brand-dna` shows the mockup's scene-1 background (ambient blobs, noise
   texture, dark charcoal base). Pacifico SuperBad wordmark visible top-left. Progress
   chrome visible top-right.
2. Section pages `/lite/brand-dna/section/[n]` use the Righteous eyebrow + hairline,
   DM Sans 500 38px question text in brand-cream, 2-column branded option cards with
   brand-pink hover borders and -2px lift.
3. Scene transitions animate between sections using the specified blob transforms.
4. Reveal `/lite/brand-dna/reveal` uses the brand palette (no flat neutral backgrounds)
   and hits the flagship-bar "this is ours" moment per `project_brand_dna_flagship_experience`.
5. Reduced-motion users get graceful degradation — scenes fade without transform-heavy
   motion; no layout break.
6. Palette tokens live in the design-system CSS tokens (A2) so future surfaces can reuse
   them — do NOT hard-code brand hexes inside components.
```

## 4. Skill whitelist

- `superbad-visual-identity` — palette, typography, brand system.
- `distinctive-frontend` — feel-first polish beyond spec prose.
- `motion-design-principles` + `framer-motion` — scene transitions, spring timings.
- `tailwind-v4` — the project's Tailwind v4 token layer (A2).
- `accessibility-aria` — reduced-motion parity.

## 5. File whitelist (G2 scope discipline)

- `app/lite/brand-dna/layout.tsx` — `edit` — add scene shell + wordmark + progress chrome.
- `app/lite/brand-dna/page.tsx` — `edit` — landing scene-1.
- `app/lite/brand-dna/alignment-gate-client.tsx` — `edit` — align to mockup card style.
- `app/lite/brand-dna/section/[n]/page.tsx` — `edit`.
- `app/lite/brand-dna/section/[n]/question-card-client.tsx` — `edit` — eyebrow + hairline + 2-col grid + hover lift.
- `app/lite/brand-dna/section/[n]/insight/page.tsx` — `edit`.
- `app/lite/brand-dna/section/[n]/reflection/page.tsx` — `edit`.
- `app/lite/brand-dna/reveal/page.tsx` — `edit` — flagship moment.
- `components/lite/brand-dna/*` — `new` — shared scene-shell, ambient-background, progress-chrome, option-card components.
- `app/globals.css` (or the A2 token file — confirm via G1) — `edit` — register brand palette + font variables if missing.
- Fonts: import via `next/font` in `app/lite/brand-dna/layout.tsx` or a shared fonts module — `new` if needed.

Do **not** touch: other wave surfaces, admin routes, any component outside `brand-dna/`. Log any drift to `PATCHES_OWED.md`.

## 6. Settings keys touched

- **Reads:** none (visual polish only).
- **Seeds:** none.

## 7. Preconditions (G1)

- [ ] `mockup-brand-dna.html` exists — verify: `ls mockup-brand-dna.html`
- [ ] A2 design tokens file exists — verify: `grep -l "brand-red\|--sb-\|@theme" app/globals.css tailwind.config.* 2>/dev/null`
- [ ] All BDA routes exist — verify: `ls app/lite/brand-dna/page.tsx app/lite/brand-dna/section/\[n\]/page.tsx app/lite/brand-dna/reveal/page.tsx`
- [ ] A4 motion registry `houseSpring` exported — verify: `grep "houseSpring" lib/motion/*.ts`
- [ ] BDA-1..4 handoffs present — verify: `ls sessions/bda-{1,2,3,4}-handoff.md`

## 8. Rollback strategy

- [x] `git-revertable, no data shape change` — pure UI/style work; no schema, no settings, no API contracts. Rollback = `git revert <sha>`.

## 9. Definition of done

- [ ] Every route under `/lite/brand-dna/**` renders with the mockup's ambient scene background.
- [ ] Pacifico wordmark visible on every BDA route.
- [ ] Option cards match mockup spec (eyebrow, 2-col grid, hover lift, brand-pink border).
- [ ] Scene transitions animate between sections (verified via browser walk).
- [ ] Reveal page uses brand palette, not neutrals.
- [ ] `prefers-reduced-motion: reduce` — scenes fade without transforms, no layout break.
- [ ] Brand palette + fonts registered as design tokens, not hard-coded hexes in components.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run lint` → clean.
- [ ] `npm run build` → clean.
- [ ] **G10 mockup parity check:** open `mockup-brand-dna.html` in one tab, built routes in another — side-by-side walkthrough of landing, section question, reflection, insight, reveal. Screenshot each pair into the handoff.
- [ ] G-gates G0 → G12 run end-to-end with clean handoff.

## 10. Notes for the next-session brief writer

- If this polish session reveals that other Wave-3+ surfaces built without mockup references also need remediation (Portal, Intro Funnel, Cockpit have `mockup-*.html` files), log each as a follow-up in `PATCHES_OWED.md` under a new "Visual remediation backlog" heading — do not expand scope in this session.
- Add the brand palette tokens registered here to the A2 seed so future surfaces consume them via the design system, not ad-hoc.
- If `next/font` imports are added, note the bundle-size impact in the handoff.
- If scene transitions require shared state (current section index), land it as a lightweight context in `components/lite/brand-dna/` — do not introduce a global store.

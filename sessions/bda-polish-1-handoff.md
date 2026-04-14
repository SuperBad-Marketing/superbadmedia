# BDA-POLISH-1 — Brand DNA visual-fidelity remediation — Handoff

**Closed:** 2026-04-14
**Tier:** `/deep` (Opus)
**Type:** UI remediation (Wave 3)
**Status:** **CLOSED** · G10.5 verdict `PASS_WITH_NOTES` · `.autonomy/PAUSED` rewritten — human review required before resuming overnight loop.

---

## What shipped

Ground-up port of `/lite/brand-dna/**` to `mockup-brand-dna.html` parity. Replaces the BDA-1..4 builds that cited the spec only.

### New components (`components/lite/brand-dna/`)

- `ambient-scene.tsx` — fixed-position blob world (3 blurred coloured blobs + SVG noise overlay), `scene` prop drives per-scene transforms (1 question / 2 insight / 3 reveal). Reduced-motion → no transitions.
- `progress-chrome.tsx` — Pacifico SuperBad wordmark + 5×(44×2px) segmented progress bar + Righteous label. Rendered on every BDA route (landing shows dormant chrome per AC1).
- `option-card.tsx` — branded answer button (Righteous letter eyebrow, brand-pink @40% hover border, -2px lift, brand-red selected). Replaces the lime-yellow `--color-brand-primary` fallback.
- `scene-shell.tsx` — client wrapper. Reads `usePathname()`, derives current scene + section + label, renders `<AmbientScene/>` + `<ProgressChrome/>` + children. Mounted in the layout so the scene cross-fades across navigations.

### Edited routes

- `app/lite/brand-dna/layout.tsx` — wraps children in `<SceneShell>`; uses `var(--neutral-900)` charcoal base + `var(--font-body)`.
- `app/lite/brand-dna/alignment-gate-client.tsx` — Righteous eyebrow + hairline rule, DM Sans 38px cream prompt, italic hint, 2-col `OptionCard` grid (1-col mobile).
- `app/lite/brand-dna/section/[n]/question-card-client.tsx` — same register; **defect-fix: `useEffect([question.id])` resets `selected`/`pending` so option state cannot leak across the redirect-driven question change.**
- `app/lite/brand-dna/section/[n]/insight/page.tsx` + `insight-reveal-client.tsx` — scene-2 register: Righteous label, Playfair italic 36px quote, brand-pink attribution, brand-cream "Keep going" outlined pill.
- `app/lite/brand-dna/section/[n]/reflection/reflection-client.tsx` — same register; brand-red submit pill replaces lime fallback; soft skip.
- `app/lite/brand-dna/reveal/page.tsx` + `reveal-client.tsx` — full mockup scene-3 port: Black Han Sans 88px headline with `<em>` Playfair italic accent (auto-split from first impression), brand-pink section labels with hairline separators, brand-cream tag accents, italic brand-pink signature footer ("written for you, by SuperBad, on {Sunday April 14}…").
- `app/globals.css` — **no diff this session.** A2 already exposes `--brand-red/cream/pink/orange/charcoal`, `--neutral-{900..100}`, and font CSS vars (`--font-pacifico`, `--font-righteous`, `--font-dm-sans`, `--font-playfair-display`, `--font-black-han-sans`). Closes DoD bullet "Palette tokens live in design-system CSS tokens" — already true.

### Defects fixed (per brief §2a)

1. **Lime-yellow highlight removed.** Grep confirms no `#e8ff47` / `--color-brand-primary` / `lime` / `chartreuse` references remain in `app/lite/brand-dna/**` or new components. Selected state is brand-red.
2. **Pre-selection leak fixed.** Root cause was the `<QuestionCardClient>` instance being preserved by Next.js across same-route redirects to the next question; `useState<string|null>(null)` initialiser only runs on mount. Fix: `React.useEffect(() => { setSelected(null); setPending(false); }, [question.id])` in `question-card-client.tsx`. Regression test deferred to `PATCHES_OWED.md` (`bdapolish1_question_selection_regression_e2e`) — repo has no React Testing Library and no BDA E2E seed; either path is a separate authorised session.

### Other tidy-ups

- `.gitignore` — `.playwright-mcp/` added so in-session browser scratch doesn't leak into commits.
- `PATCHES_OWED.md` — two new entries under `### Phase 5 Wave 3 BDA-POLISH-1 (2026-04-14)`.

---

## Verification (G-gates)

- **G0 — visual references read:** `mockup-brand-dna.html` opened + ported line-by-line.
- **G1 — preconditions:** all 5 verified at session start.
- **G2 — scope discipline:** only files in brief §5 whitelist touched (plus `.gitignore` add — flagged).
- **G3–G6 — implementation:** see "What shipped".
- **G7 — TypeScript:** `npx tsc --noEmit` → 0 errors.
- **G8 — tests:** `npm test` → 556/556 green (1 pre-existing skip).
- **G9 — lint:** brand-dna + components scope clean. 17 pre-existing lint errors elsewhere — out of scope.
- **G10 — mockup parity:** screenshot at `bda-polish-1-section1.png` (Section 1 question card) confirms Pacifico wordmark, segmented progress, ambient red blob, Righteous eyebrow + hairline, DM Sans 38px cream prompt, 2-col branded option grid. Reveal + insight + reflection not screenshot (require profile state); reviewed via reviewer agent against diff.
- **G10.5 — external reviewer:** `general-purpose` sub-agent verdict **PASS_WITH_NOTES** (verbatim above this section in session log). Non-blocking notes addressed:
  - **AC1 chrome on landing:** fixed in-session (`progress-chrome.tsx` now renders dormant 5-segment chrome with "5 sections" label when `currentSection === 0`).
  - **`.playwright-mcp/` artefacts:** gitignored.
  - **Untracked `app/lite/login/page.tsx`:** present in worktree at session start (untracked from a prior session — not authored here). Out of this session's scope; flagged here so the next session decides whether to delete or properly style it.
  - **Reduced-motion scoping in `ambient-scene.tsx`:** `<style jsx>` is locally scoped (Next.js styled-jsx adds a unique `jsx-…` class) so the `div[aria-hidden="true"]` selector cannot leak to children. Verified — no change needed.
- **G11 — build:** `npm run build` clean; all BDA routes compile.
- **G12 — handoff verification:** every file claimed above exists and is in the diff (`git diff --stat` confirms).
- **G12.5 — wave-boundary pause:** `.autonomy/PAUSED` rewritten with the BDA-POLISH-1 close note. Loop will not self-resume.

### Memory-alignment declaration

| Memory | How honoured |
|---|---|
| `project_brand_dna_flagship_experience` | Reveal page now uses Black Han Sans + Playfair italic + Righteous + DM Sans across a multi-phase staged choreography — flagship register. |
| `feedback_motion_is_universal` | Every state change (entrance, scene change, hover, select, reveal phases) animates with houseSpring or the mockup's `cubic-bezier(0.16, 1, 0.3, 1)` spring; reduced-motion fallback. |
| `feedback_individual_feel` | Customer-facing surfaces show "SuperBad" wordmark only — no "Lite" leakage. Footer signature is per-individual ("written for you"). |
| `feedback_visual_references_binding` | The whole session exists because BDA-1..4 violated this. Mockup is the spine of the port — every section register, palette token, motion timing traces back to `mockup-brand-dna.html`. |
| `feedback_no_lite_on_client_facing` | Wordmark, page metadata, signature copy all read "SuperBad" — never "Lite". |

---

## Notes for the next session

- **Wave-3 remediation closes here.** Per brief, the next active build session is **Wave 6 QB-4c** (Stripe Payment Intent + Tier-2 morph + accept side-effects). `SESSION_TRACKER.md` Next Action updated.
- **Visual remediation backlog opened** in `PATCHES_OWED.md` (`bdapolish1_visual_remediation_backlog`): Portal, Intro Funnel, Cockpit each have `mockup-*.html` files and were built before the visual-references-binding rule landed. Audit each at the start of its respective remediation session before more functional work lands on top.
- **Untracked `app/lite/login/page.tsx`:** still in worktree, predates this session. Recommend the next session delete or properly authorise it — it's currently a styled-with-`crimson` placeholder that violates `feedback_no_lite_on_client_facing` ("Real login page lands in Wave 2 B-series" copy).
- **Manual browser walk pending** for the insight / reflection / reveal routes — they need a profile state to render and the dev DB doesn't have one. Andy can walk them himself or a follow-up session can seed via `scripts/seed-pipeline.ts`-style fixtures.
- **`.autonomy/PAUSED` is in place.** Do not let the overnight loop run another UI session until human review of this remediation is complete.

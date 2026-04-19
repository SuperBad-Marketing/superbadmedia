# `CMS-5` — Intro Funnel + Six-Week Plan Content — Handoff

**Closed:** 2026-04-19
**Type:** Content mini-session
**Model tier:** Sonnet

---

## What was done

Authored all copy, question banks, email templates, LLM prompts, and visual direction for the Intro Funnel and Six-Week Plan Generator specs. 8 decisions resolved via brainstorm with Andy (all option A).

### Intro Funnel content

- **Landing page copy** — 9 structural blocks: quiet confidence opener ("Most marketing looks like marketing"), striking image with dry caption, plain four-line deliverables list, numbered second-person timeline (embeds bundled-deliverables timeframe signpost), curated past work with observational captions, two-line commitment section (three shoots a week + five days' notice with reason), matter-of-fact price ($297, GST inclusive), understated CTA ("Book your shoot" + "Takes about two minutes. No obligation after that."), minimal footer.
- **Section 1 form copy** — field labels with warm helpers, SMS opt-in ("It's okay to text me about my shoot"), shape classification question ("Which best describes your business right now?" → "It's just me" / "I run it with a small team" / "There are a few decision-makers involved"), magic-link email template.
- **9 questionnaire banks** — sections 2 (Business Context), 3 (Photography & Content), 4 (Ambitions) × 3 shapes. Warm second-person register. 5–7 questions per bank (5 closed-list + 1 optional free-text each). Section 4 includes 2 practical-supplement questions (email list status, ad experience) tagged `practical_signal:` for Six-Week Plan generator consumption.
- **Signal-tag mapping** — maps Intro Funnel answers to the existing Brand DNA 79-tag taxonomy. Haiku-extracted per section. `practical_signal:` prefix for infrastructure tags. Expected yield: 8–15 distinct tags per completed questionnaire.
- **Reflection questionnaire** — 8 screens (safety valve → experience → value → working with Andy → specific moment → future-casting → commitment → synthesis reveal). Opus synthesis prompt calibrated (mirrors prospect's reasoning in SuperBad voice, drift-check with warm generic fallback). Decision CTA pair ("Yes — let's talk about what's next" / "Let me think about it").
- **10 email/SMS templates** — payment receipt, booking confirmation (with .ics), 2 SuperBad-initiated apology variants (cancel + reschedule), 3 abandon cadence (15m SMS, 24h SMS, 24h email Haiku-generated, 3d email Haiku-generated), bundled deliverables announcement, reflection nudge.
- **Deliverables hub copy** — header "EVERYTHING FROM YOUR SHOOT", gallery tile ("The moments we caught"), plan tile ("What to do with them"), bartender opening line.
- **Timeframe signposting** — 4 surfaces (landing page step 5, payment confirmation, booking confirmation email, post-shoot portal state).

### Six-Week Plan content

- **4 LLM prompts calibrated:**
  - Stage 1 strategy (Opus) — strategist framing, reads full context bundle, produces current_state_diagnosis + primary_goal + chosen_primitives + theme_arc + flagged_assumptions. Energy-signal calibrated.
  - Stage 2 elaboration (Opus) — per-week decomposition with shoot-asset-specific content angles, scale-matched tasks, observable success signals, real fallbacks.
  - Self-review (Haiku) — 10-point checklist (shoot asset specificity, success signal measurability, energy calibration, infrastructure presence, fallback quality, week duplication, scale match, primitive coverage, week 6 measurement, tone consistency).
  - Revision-reply (Haiku) — Andy's voice, addresses prospect's specific concern, honest.
- **Portal plan page copy** — "Start Week 1" with subtext ("You're running this. When you're ready, we'll start the clock."), revision modal ("Tell us what's off" + one free revision framing), inline cards (regenerate + explain variants), post-revision state (mailto link).
- **Pending-refresh-review bands** — pre-payment ("Andy's tailoring this plan for your retainer — the live version kicks in with your first payment") + post-payment ("Kicking off Week 1 shortly — Andy's putting the finishing touches on your plan").
- **Archived-portal offline page** — "YOUR PORTAL IS QUIET NOW" with PDF download + gallery link + warm sign-off.
- **PDF layout direction** — Dark Charcoal full-bleed cover (SuperBad mark + business name in Righteous + "Strategy dated {month} {year}" + "Six-Week Plan"), intermediate page footer (small mark left + page number right), closing spread with sprinkle line in Playfair Display italic ("This plan belongs to you. So does the nerve to run it."). Render overlay ("Putting your plan together…"). Superseded-PDF prompt modal.
- **3 email templates** — revision-regenerated ("Your plan's been revised"), revision-explained ("About your plan" wrapping Andy's reply), day-53 non-converter expiry (warm sign-off + signpost + soft CTA mailto with subject prefill + PDF attached).
- **Browser tab title rotation pool** — 4 states (strategy review, detail review, regen count ≥3, approved).
- **Andy review UI microcopy** — flagged assumption badges ("We're guessing here" / "Probably right, worth checking" / "This one's solid"), regen-note placeholders, self-review banner, cost warning.

### Files created (8)

- `docs/content/intro-funnel/landing-page.md`
- `docs/content/intro-funnel/section-1-form.md`
- `docs/content/intro-funnel/questionnaire-section-2.md`
- `docs/content/intro-funnel/questionnaire-section-3.md`
- `docs/content/intro-funnel/questionnaire-section-4.md`
- `docs/content/intro-funnel/signal-tag-mapping.md`
- `docs/content/intro-funnel/reflection-questionnaire.md`
- `docs/content/intro-funnel/emails-and-sms.md`
- `docs/content/six-week-plan/prompts.md`
- `docs/content/six-week-plan/portal-and-copy.md`

### Files edited (1)

- `SESSION_TRACKER.md` — Next Action updated to IF-1 (Wave 14), CMS-5 row added to session log

## Key decisions

1. **Landing page voice: quiet confidence** — understated opener, no hype, no "tired of X?" pattern. Found, not targeted.
2. **Delight moment: striking image + dry caption** — the gap between high production and casual treatment IS the delight. Wes Anderson move.
3. **Value drop: plain list** — four lines, no icons, no grid. The honesty of the flat list is the flex.
4. **Timeline: numbered, second-person** — "You show up. We shoot. You go back to work." Embeds the bundled-deliverables timeframe signpost naturally.
5. **Commitment framing: two lines with the reason** — explains WHY five days (research), not just THAT five days. Trust-building, not scarcity.
6. **CTA: understated button** — "Book your shoot" with "Takes about two minutes. No obligation after that." Consistent with the page's register.
7. **Shape question: plain language** — "It's just me" / "I run it with a small team" / "There are a few decision-makers involved." Warm, non-judgemental.
8. **Questionnaire voice: warm second-person conversational** — Andy asking over coffee. Self-persuasion works because the prospect hears themselves answering honestly.

## What the next session should know

- All content is in `docs/content/intro-funnel/` and `docs/content/six-week-plan/`. Phase 5 build sessions read spec + content file together.
- The practical-supplement questions (Q6–Q7 in section 4) are tagged `practical_signal:` — these feed the Six-Week Plan generator but do NOT enter the Brand DNA profile.
- Signal-tag mapping is guidance for the Haiku prompt, not hard rules. The prompt allows soft-override when answer combinations tell a different story.
- Reflection synthesis fallback is warm but generic — doesn't reference prospect answers (since the drift-failed synthesis might have mishandled them).
- PDF sprinkle line confirmed: "This plan belongs to you. So does the nerve to run it."
- The section 1 magic-link email subject is "Your SuperBad portal is ready" — this is the first email a prospect receives from SuperBad.
- Abandon SMS templates are hardcoded (no Claude) per spec §14.4. Abandon emails are Haiku-generated per spec §14.4.
- CMS-3 and CMS-4 (Content Engine + SaaS Subscription Billing) are also noted as overdue in BUILD_PLAN.md §dependencies — should run before Wave 14 ideally, but not hard blockers for IF-1.

## Verification

- No code changes — content-only session. No typecheck/test gates applicable.
- All content files match the spec's §24 / §17 deliverables lists — cross-referenced during authoring.

## Rollback strategy

**Doc-only.** Git-revertable.

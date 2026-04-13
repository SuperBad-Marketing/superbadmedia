# Phase 3 — Surprise & Delight mini-brainstorm (handoff)

**Date:** 2026-04-12
**Type:** Mini-brainstorm #3 + spec pre-write
**Trigger:** Andy requested "moments of surprise & delight through the platform and through client-facing pages & portals. similar to how you would find easter eggs in video games."
**Outcome:** Surprise & Delight added to SCOPE.md as feature #13 (cross-cutting). `docs/specs/surprise-and-delight.md` pre-written to full spec depth. New memory locked. Backlog grows 14 → 15 with sequencing constraint against Brand DNA.

---

## What was brainstormed and locked (Q1–Q6)

- **Q1 — Layering:** 80% ambient voice / 20% hidden eggs. Ambient is always-on dry observational texture in a **closed list** of surface categories. Hidden is rare platform-awareness eggs. Concentration is what makes voice land — wallpaper kills magic.

- **Q2 — Reach mechanism:** public + logged-in surfaces, both fed by a **single shared `resolveRiddleAnswer()` resolver**. Riddles posted to social → answer in public search bar / public URL / admin search bar → different rewards by audience (logged-in rewards include a tiny persistent trace in their account). Wrong answers get their own dry micro-responses, Claude-generated at riddle-creation time.

- **Q3 — Cleverness mechanic:** **platform awareness** (Psycho Mantis path) is the dominant mechanic. Time-and-history folds in for free. Real-world anchoring is reserved for 1–2 special riddles per year (answer printed in margin of Monday founder PDF, embedded in EXIF of Instagram photo, in end credits of a 38-second video — rare, expensive, high-reward). Andy corrected an earlier mis-framing where I'd asked about reward *shape* instead of cleverness *mechanic* — the real question was how Lite's cleverness manifests, not what it rewards you with.

- **Q4 — Ambient layer scope:** closed list of **6 surface categories** — empty states, error pages, loading copy, success toasts, placeholder text, morning brief narrative (which is already Tier 2 motion moment #2 in `design-system-baseline.md` — voice treatment lives in this spec, motion treatment stays locked there). New ambient surface categories require a brainstorm gate, same discipline as Tier 2 motion additions.

- **Q5 — Cadence:** public visitors get **1 guaranteed first-visit egg** (fallback welcome egg fires at session-end if no situational trigger matched) + max **2 per rolling 14-day window** thereafter. Authenticated users get max **1 per rolling 7-day window**. Crossover preserves earned state — a public visitor who logs in mid-session keeps their cookie-tracked egg history.

- **Q6 — Wrong-answer branching (hybrid):** 5–7 pre-generated common-guess responses per riddle (Claude-generated at riddle-creation time, cached) + **live Claude fallback** for novel guesses, capped at ~100 unique lifetime calls per riddle, graceful degradation to a pre-generated catch-all beyond the cap. Every wrong-answer response also passes the Brand-Voice Drift Check (§11.5).

---

## Canonical admin egg

**Trigger:** Andy signed into `/lite` after 01:30 Melbourne local on 3 different calendar days within the last 7 days.

**Effect:** screen dim → warm analog static 180ms → CRT horizontal collapse → page freezes on single dry line.

**Copy:** *"you've been up until 2am three nights running. I'm pulling the plug."* + *"close this tab."* as the only exit.

**Cap:** once per Andy per 30 days. Logged to `hidden_egg_fires` with trigger evidence.

**Motion treatment:** CRT effect is **not** added to the Tier 2 closed list. It's explicitly exempt as a hidden-layer effect. If a second admin egg ever proposes a new Tier 2 motion, it goes through the design-system-baseline revisit gate instead.

---

## Public egg catalogue — 12 locked (Andy approved "I love all of these")

1. **Late-night visitor** (02:00–05:00 local) — margin line "go to bed"
2. **Sunday researcher** (Sunday + search referrer + 45s dwell) — one-shot ever
3. **Melbourne public holiday** — site collapses to single line; uses existing `/data/au-holidays.json`
4. **Fifth-time visitor** — only egg that surfaces a `mailto:andy@` link, phrased as observation not invitation
5. **Returning visitor** (2nd+ visit, not 5th) — "we didn't do anything with the place"
6. **LinkedIn referrer** — "we are, in a sense, sorry"
7. **Google intent "cheap/discount"** — "we're not cheap. we're sorry. there's a door over there"
8. **Rapid scroller** (<6s top-to-bottom) — page summary fades in at bottom
9. **Deep reader** (4min+ dwell, 70%+ scroll) — "long version" link, fails closed if no deeper piece exists
10. **Abandoned tab** (Page Visibility API, 10+ min backgrounded then refocused) — "it's fine. we'll wait"
11. **Melbourne rain** (Open-Meteo for Melbourne timezone visitors) — soft rain ambient sound + margin note; volume capped 20%, respects `soundsEnabled` + `prefers-reduced-motion`
12. **Public CRT turn-off** (01:00–04:59 Melbourne + 3+ min on site + not already earned Late-Night egg this session) — structural site closure until 07:00 local; cookie-gated; respected by cookie-clear (it's a joke, not a security control)

---

## Tone asymmetry (locked)

- **Admin** → roommate voice. Psycho Mantis territory allowed because Andy opted in.
- **Public** → bartender voice. Attentive, dry, never accusatory, never reveals invasive knowledge, **never pitches**. Selling kills the magic.
- **Customer portal / SaaS dashboard** → bartender voice with slight opted-in latitude. Never admin-roommate territory — the customer did not sign up for surveillance.

---

## Public knowledge ceiling (locked)

Only browser-freely-given data on public/customer surfaces: local time, timezone, referrer, tab state, scroll, cookies, public weather APIs, day-of-week, holiday calendars.

**Never:** IP geolocation, ISP, GPS, device fingerprinting, ad network joins, UA parsing beyond "is this mobile".

The joke is noticing obvious things nobody else notices. A bartender noting *"you always order the same thing"* is warm; a bartender citing your LinkedIn job title is a horror movie.

---

## Context-aware suppression (hard gate, not heuristic)

Hidden eggs never fire during: mid-payment, mid-email-compose, quote acceptance, error recovery, wizard steps, first-ever authenticated login, first 30 seconds of any session. Fail-closed — ambiguous state = no fire.

---

## Kill switch

- **Authenticated** — Settings → Display → **"No tricks"** toggle. Default off.
- **Public** — footer link **"No tricks"** sets a cookie.
- **Ambient layer cannot be disabled.** Ambient IS the voice, and disabling the voice is disabling SuperBad. Deliberate.

---

## Technical footprint

**New tables:**
- `riddles` — id, slug, salt, answer_hash, created_at, retired_at, public_reward_content, loggedin_reward_content, common_wrong_answers (JSON), catch_all_wrong_content
- `riddle_resolutions` — id, riddle_id, actor_type, user_id (nullable), input hash, resolved_at, outcome
- `hidden_egg_fires` — id, egg_id, actor_type, user_id (nullable), visitor_id (nullable), fired_at, trigger_evidence (JSON, non-null — mandatory), session_id
- `ambient_copy_cache` — slot, context_hash, generated_text, drift_check_score, generated_at, expires_at

**New columns on `user`:**
- `last_hidden_egg_fired_at` (UTC timestamp, nullable)
- `hidden_egg_tricks_enabled` (boolean, default true)
- `fired_egg_ids_recent` (JSON array, FIFO max 50)

**New Claude primitives:**
- `generateInVoice(slot, context, brandDnaProfile)` — single shared primitive for all voice-generated copy in this spec. Routes through drift check (§11.5). Haiku-tier.
- `resolveRiddleAnswer(input, context)` — single pure function in `lib/riddles/resolve.ts`. Returns `{ outcome, content }`. Called identically from public search, admin search, `/say/[answer]` route.

**Trigger evaluator architecture:**
- Live in `lib/eggs/triggers/*.ts`, one file per egg.
- Pure `(context) => boolean | evidence` functions.
- Deterministic rules over explicit signals. **No ML. No embedding. No classifier. No "learned" thresholds.**
- Read real event data from activity log, user table, session, browser — never from a separately derived "inferred state" table.
- Fail-closed: ambiguous state means no fire.
- Unit-tested against fixture event data. False positives are spec-level bugs.

**Cost architecture:**
- Haiku-tier: drift check, ambient line generation, novel wrong-answer fallback.
- Opus-tier: riddle reward content (done once at riddle-creation time, rare).
- Ambient layer cached; fire time has zero generation cost.
- Riddle fallback capped ~100 unique calls/riddle lifetime.
- Estimated total monthly spend: sub-$5.
- Kill-switch wired into Phase 4 Autonomy Protocol.

---

## New build-time disciplines (added to Foundations §11 references)

- **19.** Every ambient voice line passes `generateInVoice()` + drift check. No hardcoded string literals on ambient surfaces. Enforced at code review.
- **20.** Every hidden egg trigger evaluator reads only real event data and fails closed. `lib/eggs/triggers/*.ts`, one file per egg, unit-tested.
- **21.** Every hidden egg fire logs its trigger evidence. `hidden_egg_fires.trigger_evidence` is non-null. A fire without evidence is a bug.
- **22.** The riddle resolver is singular. `lib/riddles/resolve.ts` is the only path. Forking is a code-review reject.
- **23.** Hidden-layer closed-list exemptions are explicit. CRT motion and rain sample are **named** exempt in the spec; an unnamed hidden effect does not exist.

These disciplines apply in Phase 5. Consider moving them into `FOUNDATIONS.md § build-time disciplines` when the S&D spec's Phase 5 build session opens, to align with the 18-entry list there. Left out of this pass to avoid premature Foundations patching — the spec is the source of truth for now.

---

## Silent dependency — THIS IS LOAD-BEARING

**The spec is written, but cannot be BUILT before two things happen:**

1. **`docs/specs/brand-dna-assessment.md` must be locked** (currently backlog #5, ahead of S&D at #15 — correct sequencing).
2. **Andy must take SuperBad's own Brand DNA Assessment** (Founder Profile + Business Profile), producing the profile the drift check grades voice lines against. Without SuperBad's own Brand DNA profile, the drift check has no substrate.

**Phase 5 build order is therefore:** Brand DNA Assessment feature → Andy runs SuperBad's own assessment → Surprise & Delight build session(s) → everything else downstream that consumes ambient copy.

**Phase 3 implication:** `brand-dna-assessment.md` (backlog #5) must ship with a **tight signal-tag taxonomy**. Tight enough that the drift check can meaningfully distinguish "on-voice" from "generic dry". Flag this when writing that spec — it's a load-bearing constraint on the assessment spec's own design work.

---

## Cross-spec flags for future specs

Every future spec that touches a user-visible surface must now include a short **"Voice & delight treatment"** heading pointing at:

1. Which ambient surface categories (from the closed list of 6) apply to this spec's surfaces.
2. Whether any hidden egg catalogued in `docs/specs/surprise-and-delight.md` is expected to fire on this surface, and which (for cadence budgeting).
3. Whether this spec proposes any **new** hidden eggs — flagged for a brainstorm gate.
4. Whether this spec proposes any **new** ambient surface category — flagged for a brainstorm gate.

Specs that do not touch user-visible surfaces (webhook infra, background workers) do not reference this spec.

Already-locked specs do not need retrofit — Next Action block now tells the next Phase 3 session (Quote Builder) to add a Voice & delight treatment heading going forward, and the same applies to all subsequent specs.

---

## New memory (locked)

- **`feedback_surprise_and_delight_philosophy.md`** — canonical philosophy document. Captures the two-layer model (80/20), tone asymmetry, public knowledge ceiling, riddle loop architecture, and explicit rationale (Andy named Metal Gear Solid as the reference, picked "platform awareness" as dominant mechanic, approved once-per-month cap, approved admin/public tone split, approved full public egg catalogue). Listed in `MEMORY.md` index for every future conversation.

Every future spec touching a user-facing surface reads this memory.

---

## Follow-up mini-brainstorm owed

**Admin-egg expansion brainstorm** — the spec only locks ONE admin egg (the canonical CRT turn-off). Phase 5 build of this feature needs 3–5 admin eggs for rotation variety. Brief 20–30 min brainstorm, scheduled at the latest before Phase 5 session that builds `surprise-and-delight.md`. Tracked in the Next Action block's "deferred non-spec tasks still owed" list.

This is out of scope for this spec and out of scope for any other Phase 3 spec session. Treat as a standalone mini-brainstorm whenever convenient.

---

## What this spec does NOT do (explicit non-goals)

- No achievements / streaks / points / levels / badges / collectables. Not now, not later. Any future PR proposing gamification gets rejected on this principle.
- No egg discovery surface ("you've found 3 of 12").
- No user behaviour tracking beyond trigger evaluation. `hidden_egg_fires` is a log, not a profile.
- No personalisation based on visitor profiles on public surfaces. Public visitors have no Brand DNA profile; the tone is SuperBad's, not theirs.
- No auto-generated eggs. Catalogue is closed; additions go through brainstorm gate.
- No modifications to sound registry, Tier 2 motion list, density presets, or theme presets. Hidden-layer effects exempt by explicit naming only.
- No multi-language voice treatment in v1 (English only).
- No user-configurable egg creation.
- No public API for the riddle loop.
- No analytics dashboards beyond the raw log.
- No behavioural surfaces that reward frequency of use.

---

## Reality check (per brainstorm rule 6)

### Hardest parts

1. **Voice calibration at scale.** The drift check is only as good as SuperBad's Brand DNA profile. A loose profile = slop ambient copy. A tight profile = genuinely-voice ambient copy. This is why the silent dependency on Brand DNA is load-bearing, not decorative.
2. **Trigger calibration.** Thresholds (6 seconds for rapid scroll, 4 minutes for deep read, 3 nights for CRT turn-off) are first guesses. Phase 5 needs a calibration pass with real traffic before any egg ships to production. Too sensitive = trust-breaking false positives; too insensitive = nobody ever sees an egg.
3. **Cold-start content clustering.** First month of riddles may cluster similar wrongs; watch for "everyone guesses the same thing" and refresh the common-wrongs list if that happens.
4. **Voice drift over months.** Ambient copy cached once can feel stale in 6 months. Need a scheduled (quarterly?) refresh pass; out of scope for this spec but flag in Phase 6 launch checklist.

### What could go wrong

- **Trust-break from false-positive trigger.** Biggest risk. Mitigation: fail-closed + real-data-only + trigger evidence logging + unit-tested fixtures.
- **Riddle loop dependence on social reach.** Andy doesn't have massive social — riddles may go unanswered. This is fine. The ambient layer and the situational eggs are the main event; riddles are bonus.
- **Screenshot weaponisation.** Someone posts a dry admin egg out of context as "SuperBad's tool is condescending." Mitigation: admin eggs are Andy-only visibility — any screenshot requires Andy choosing to share it, so Andy controls the narrative on his own surface.
- **Cost balloon.** Mitigated by caching and per-riddle caps; live traffic may still surprise. Phase 4 Autonomy Protocol's central budget kill-switch covers this.

### Doable?

Yes, green light. Non-trivial but architecturally clean. The sequencing constraint (after Brand DNA + SuperBad's own assessment) is the only hard dependency. No new infrastructure beyond the four tables; reuses Foundations §11 drift check, §11.4 holiday calendar, existing Claude integration, existing activity log pattern.

---

## Files touched by this session

- **Created:** `docs/specs/surprise-and-delight.md` — the full spec
- **Created:** `sessions/phase-3-surprise-and-delight-brainstorm-handoff.md` — this file
- **Patched:** `SCOPE.md` — new feature #13 in "Additional v1 features (added 2026-04-12 mini-brainstorm #3)" section
- **Patched:** `SESSION_TRACKER.md` — session log row, Next Action block (new cross-cutting constraint, new deferred task, backlog grows to 15), backlog entry #15
- **Created:** `/Users/Andy/.claude/projects/-Users-Andy-Desktop-SuperBad-Lite/memory/feedback_surprise_and_delight_philosophy.md` — new memory
- **Patched:** `MEMORY.md` — added pointer to the new memory

Nothing committed. Andy to commit only if/when he asks.

---

## Next session

Phase 3 continues at Quote Builder (`docs/specs/quote-builder.md`) — unchanged recommendation. The next session should:

1. Read this handoff + the S&D spec + the new memory before starting (all listed in Next Action block).
2. When writing the Quote Builder spec, include the new **"Voice & delight treatment"** heading referencing `surprise-and-delight.md` — which ambient slots apply (empty states, loading copy, success toasts, placeholders most likely; not morning brief or error pages), whether any hidden eggs should fire on the quote page (likely yes — a pre-acceptance quote page is a bartender-voice public surface).
3. Honour the existing cross-cutting Foundations §11 constraints as before.

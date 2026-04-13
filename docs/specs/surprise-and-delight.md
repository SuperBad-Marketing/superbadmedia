# Spec — Surprise & Delight

**Phase 3 spec. Locked 2026-04-12 mini-brainstorm #3.**

Cross-cutting feature. Applies everywhere Lite has a rendered surface — admin platform (`/lite`), public marketing pages, quote pages, client portals, SaaS customer dashboards, wizards, cockpit, inbox. Not a module you can visit on its own.

The governing philosophy for this entire spec lives in memory at `feedback_surprise_and_delight_philosophy.md`. That memory is the source of truth for tone, cadence, and boundaries. **Read it before building any surface that references this spec.** This file is the implementation-facing artefact; the memory is the philosophy-facing artefact. If they ever disagree, the memory wins and this file gets patched.

---

## Purpose

Add two kinds of joy to Lite without compromising the dry voice or the core product work:

1. **An always-on ambient layer** of dry observational copy in a closed list of surface slots — the wallpaper that makes the platform feel *like SuperBad* rather than like a generic CRM.
2. **A rare hidden layer** of platform-awareness eggs in the Metal Gear Solid tradition — moments where Lite quietly demonstrates it's been watching, without demonstrating anything forbidden. Rarity is the whole point.

This is not a "gamification" spec. There are no points, streaks, achievements, levels, badges, or collectable tokens anywhere in this feature. If a future PR proposes one, reject it.

---

## Two-layer model (locked)

### Layer 1 — Ambient voice (80%)

Always-on dry observational copy, concentrated in a **closed list** of surface categories:

1. **Empty states** — "no prospects yet. that's either a problem or a really good week."
2. **Error pages** — 404 / 500 / "this broke" copy.
3. **Loading copy** — anything that takes long enough to need a message.
4. **Success toasts** — the confirmation line after a successful action.
5. **Placeholder text** — input placeholders, search bar placeholders, empty filter states.
6. **Morning brief narrative** — already Tier 2 motion moment #2 in `docs/specs/design-system-baseline.md`; voice treatment is ambient-layer and lives here, motion treatment stays locked there.

**Closed list.** Any new ambient surface category requires the same explicit brainstorm gate as adding a new Tier 2 motion moment or a new sound registry entry. No drive-by additions. Voice wallpaper kills voice magic — the discipline is the point.

**Every ambient line is Claude-generated**, per `feedback_no_content_authoring` and `feedback_dont_undershoot_llm_capability`. Andy never hand-writes an error page copy line. Generation is one-shot at surface-build time (cached as seed content, regenerated on demand when Andy wants refresh), not per-render.

**Every ambient line passes the Brand-Voice Drift Check** (Foundations §11.5) against SuperBad's own Brand DNA profile. No exception. Lines that score below threshold regenerate once; a second failure surfaces a visible warning on the review surface rather than blocking. Ambient copy counts as external-facing LLM output for the purposes of discipline #17.

### Layer 2 — Hidden eggs (20%)

Rare, unannounced, never discoverable by clicking around. Platform demonstrates it's been watching — using data it already has from the activity log and the browser — and says something dry about what it's seen.

**The reward is never content.** The reward is *"oh, Lite noticed."* That's the entire magic.

Hidden eggs are:

- **Unannounced.** The egg never tells you it's an egg. No *"look what you found!"* confetti. No "achievement unlocked" framing. If it announces itself, it stops being one.
- **Rare.** Max once per user per egg per month. Every egg has an independent cooldown. Global budget caps below.
- **Context-aware suppressed.** Eggs never fire during critical moments — mid-payment, mid-email-compose, quote acceptance, error recovery, wizard steps, first-ever login, first 30 seconds of any session. The suppression rule is a non-negotiable gate, not a heuristic.
- **Fail-closed.** If the trigger evaluator cannot confidently assert the trigger condition from real event data in the activity log, the egg does not fire. Fuzzy derivation is not allowed. Every fire logs its trigger evidence so false positives can be diagnosed after the fact.
- **Never pitches.** Hidden eggs on public surfaces must never sell anything. Selling kills the magic. See tone asymmetry below.

---

## Tone asymmetry (locked)

Same mechanic, different voice posture, depending on who's looking at the screen:

- **Admin (Andy signed in, or any future SuperBad staff)** → **roommate voice**. Can push into Psycho Mantis territory because he's opted in to the platform. Can be cheeky, surveillance-adjacent, fourth-wall. Admin eggs are allowed to tell Andy things about his own behaviour that would be creepy on a public surface.
- **Public (marketing site, riddle pages, quote pages *before acceptance*, lead forms, any surface where the viewer is not yet a known authenticated user of Lite)** → **bartender voice**. Attentive, dry, never accusatory, never reveals anything invasive, never pitches. The bartender notices you came in looking tired; he doesn't announce your heart rate.
- **Client portal / SaaS dashboard (authenticated customer, not SuperBad staff)** → **bartender voice with opted-in latitude**. A customer who has signed into their own tool has a different relationship with Lite than a random marketing-site visitor. Eggs here can be slightly more personal than public, but never push into admin-roommate territory. The customer did not sign up for surveillance.

---

## Public knowledge ceiling (locked)

**Only browser-freely-given data** may feed the trigger evaluators on any public or customer surface:

| Allowed | Forbidden |
|---|---|
| Local time (client-side) | IP geolocation |
| Timezone (client-side) | ISP name |
| Referrer header | GPS / Geolocation API |
| Tab state (Page Visibility API) | Exact city from IP |
| Scroll position / dwell time | Device fingerprinting |
| Cookies / localStorage (our own) | Ad network tracking data |
| Day-of-week / public weather APIs (Open-Meteo) | Third-party analytics joins |
| Public holiday calendars (`/data/au-holidays.json`) | User agent parsing beyond "is this mobile" |

**The joke is SuperBad choosing to notice obvious things nobody else notices, not demonstrating forbidden knowledge.** A bartender commenting "you always order the same thing" is warm; a bartender citing your LinkedIn job title is a horror movie. Stay on the warm side.

---

## Admin egg catalogue (locked)

### 1. CRT turn-off (the original)

**Trigger:** Andy has been signed into `/lite` admin after 01:30 Melbourne local on three different calendar days within the last 7 days (evaluated from `session` + `activity_log` rows, not from a separate derived table).

**Effect:**
1. Screen dims 300ms → warm analog static overlay 180ms → CRT turn-off horizontal collapse → page freezes into a single dry line.
2. Copy: *"you've been up until 2am three nights running. I'm pulling the plug."*
3. Bottom of screen, small: *"close this tab."* No other UI. No "never mind" button. Closing the tab is the exit.
4. On next signin, normal platform state resumes. No persistent lockout. The event is logged in `hidden_egg_fires`.

**Cap:** once per Andy per 30 days, regardless of how many more late nights happen.

**Motion treatment:** this is an admin-only surface and the CRT effect is **not** added to the Tier 2 closed list in `docs/specs/design-system-baseline.md` because it only ever plays at most once a month and only inside the hidden-eggs module. It is explicitly exempt from the closed-list discipline as a hidden-layer effect. If a second admin egg ever proposes a new Tier 2 motion, it must go through the design-system-baseline revisit gate instead.

### 2. Milestone spotter

**Trigger:** On every `activity_log` write where `type = 'note'` (contact, company, or deal), and once daily as a background sweep across all active contacts/leads/prospects, the Client Context Engine scans recent notes and activity for personal or business milestones — child's birthday, business anniversary, founding date, funding round, office move, award, or any event that implies a specific upcoming date.

When a milestone is detected:

1. Claude extracts the event type, the approximate or exact date, and the person/company it relates to.
2. If the date is in the future and within 14 days, or if it's today, the egg fires.
3. If the date has already passed (more than 3 days ago), the egg does not fire — stale congratulations are worse than none.

**Effect:**

1. A cockpit notification appears with the tag `milestone_spotter`.
2. The notification contains: the contact/company name, the milestone detected, the source note or activity entry it was derived from (so Andy can verify it's real), and a pre-drafted email and/or SMS in SuperBad's roommate voice.
3. Andy can: **approve and send**, **edit then send**, or **dismiss**. No auto-send, ever. The draft is a suggestion, not an action.
4. Dismissed milestones are logged to `hidden_egg_fires` with outcome `dismissed` so the same milestone doesn't resurface.
5. Sent milestones are logged with outcome `sent` and the channel used (`email` / `sms`).

**Copy brief (notification):** *"you wrote 'Jess turns 5 in April' in the Harkness notes three months ago. want to send something?"*

**Copy brief (drafted email):** Claude-generated, warm, brief, personal. Not a template. Reads Brand DNA (SuperBad's own) + the contact's context. Passes the drift check. Example tone: *"Happy birthday to Jess — five is a big one. Hope the cake situation is under control."*

**SMS alternative:** if the contact has a mobile number and Andy's SMS channel is configured, the notification offers both an email draft and a shorter SMS draft. Andy picks which to send (or both, or neither).

**Cap:** no global cooldown — milestones are rare enough by nature. Per-contact cap: max 1 milestone notification per contact per 60-day rolling window (prevents multiple notes about the same person creating notification fatigue).

**Fail-closed rules:**
- If the extracted date is ambiguous (e.g. "sometime in April" with no day), the egg fires on the 1st of the month with a note: *"exact date unclear — you might want to check."*
- If the milestone is derived from a note older than 12 months and no newer confirmation exists, the egg does not fire. People change jobs, kids age out of milestones, businesses close.
- If the contact/lead is in a `lost` or `dead` deal stage, the egg does not fire. Sending a birthday note to someone who ghosted you is not warm, it's uncomfortable.

**Data source:** `activity_log` entries where `type = 'note'`, plus `contacts.notes` and `companies.notes` freeform fields. The scan reads raw text — no structured "birthday" field required. Claude does the extraction from natural language.

**Why this is an admin egg, not automation:** Andy is the bartender. Lite spots the moment; Andy decides whether to act on it. The magic is Lite quietly reading three months of notes and surfacing *"hey, this is coming up"* — not Lite sending emails on Andy's behalf without asking.

---

## Public egg catalogue (locked — Andy approved 2026-04-12)

Each egg specifies: trigger (real signal), effect, copy, cooldown, suppression rules, and which Claude generation primitive produces the rendered copy.

All copy below is indicative brief, not final. Final copy is generated by `generateInVoice(slot, context)` at surface-build time, passes the Brand-Voice Drift Check, and gets cached. Andy never writes it.

### 1. Late-night visitor

- **Trigger:** visitor's local time is between 02:00 and 05:00.
- **Effect:** page dims ~15%, slow 400ms fade-in of a margin line near the top of the current scroll position.
- **Copy brief:** *"it's 3am where you are. genuinely, go to bed."*
- **Cooldown:** once per 14-day window per visitor (cookie + localStorage redundant).
- **Counts against:** the public rolling 2-per-14-day budget.

### 2. Sunday researcher

- **Trigger:** day-of-week is Sunday AND referrer contains a known search engine AND dwell time > 45 seconds.
- **Effect:** small italic line fades into the header area.
- **Copy brief:** *"sunday. you're researching marketing agencies on a sunday. we're a bit worried about you."*
- **Cooldown:** once per visitor ever (this one is a one-shot, very deliberately).

### 3. Melbourne public holiday (site closure)

- **Trigger:** current date matches an entry in `/data/au-holidays.json` (same file Foundations §11.4 already uses for outreach quiet-window enforcement).
- **Effect:** the entire marketing site collapses to a single centred line on warm charcoal. Other routes are not rendered for the day.
- **Copy brief:** *"australian public holiday. we're not working. neither should you."*
- **Cooldown:** triggers on every visit during a holiday for all visitors — this is a **site-state** egg, not a per-visitor reward. Exempt from the 2-per-14-day budget because it's structural.
- **Suppression:** does NOT apply to `/lite` admin, to quote pages awaiting acceptance, to the Stripe-webhook endpoints, or to any authenticated customer surface.

### 4. Fifth-time visitor

- **Trigger:** returning visitor on their 5th distinct calendar-day visit (cookie-counted).
- **Effect:** a margin note fades in near the first content block.
- **Copy brief:** *"you keep coming back. if you'd like to actually talk to someone, andy@superbadmedia.com.au"* — the email is a real `mailto:` link. This is the **only** public egg that surfaces a contact mechanism, and it's phrased as observation not invitation.
- **Cooldown:** once ever per visitor.
- **Why this one gets to "almost pitch":** it doesn't sell, it acknowledges. The bartender noting *"you've been in here a lot this week"* is not selling, it's noticing. If this crosses into pitchy territory in review, it gets rewritten until it doesn't.

### 5. Returning visitor

- **Trigger:** any 2nd+ visit (cookie-detected) within 30 days, not the 5th-visit egg.
- **Effect:** brief fade-in line near footer.
- **Copy brief:** *"you're back. we didn't do anything with the place."*
- **Cooldown:** once per 14-day window per visitor.

### 6. LinkedIn referrer

- **Trigger:** `document.referrer` matches a known LinkedIn URL pattern.
- **Effect:** margin note fades into the hero area.
- **Copy brief:** *"LinkedIn sent you here. we are, in a sense, sorry."*
- **Cooldown:** once per 30 days per visitor.

### 7. Google intent — "cheap/discount"

- **Trigger:** referrer URL query string contains any of a small closed list of terms (`cheap`, `discount`, `affordable`, `low cost`, `budget`, `free`).
- **Effect:** margin note fades into the hero area.
- **Copy brief:** *"we're not cheap. we're sorry. there's a door over there."*
- **Cooldown:** once per visitor ever.
- **Suppression:** does not fire on the 5th-visit egg's visitor (if they already have that egg banked, they don't also get this one).

### 8. Rapid scroller

- **Trigger:** visitor scrolls from top of page to bottom in under 6 seconds.
- **Effect:** the short-form version of the page's core message fades in at the bottom.
- **Copy brief:** *"you scrolled past it in six seconds. here's the short version: [one-sentence summary generated per-page]."*
- **Cooldown:** once per page per 14-day window.
- **Notes:** the one-sentence summary is generated at build time for each page via `generateInVoice('rapid_scroller_summary', { pageContent })`. Drift-checked. Static after build. No live regeneration per visit.

### 9. Deep reader

- **Trigger:** visitor dwells 4 minutes+ on a single page, scroll depth > 70%.
- **Effect:** a margin note fades in near the end of the content.
- **Copy brief:** *"you actually read it. that's rare. here's the long version: [link to a deeper piece]."*
- **Cooldown:** once per page per 14-day window.
- **Suppression:** never fires if the page has no deeper piece to link to. Fails closed.

### 10. Abandoned tab

- **Trigger:** Page Visibility API reports the tab backgrounded for 10+ continuous minutes, then foregrounded.
- **Effect:** a margin note fades in at the top of the visible content on refocus.
- **Copy brief:** *"you opened us in a new tab and walked away. it's fine. we'll wait."*
- **Cooldown:** once per visitor per 14-day window.
- **Suppression:** does not fire on authenticated customer surfaces.

### 11. Melbourne rain

- **Trigger:** the visitor is timezoned to Australia/Melbourne AND an Open-Meteo call for Melbourne weather returns an active precipitation condition at the time of visit.
- **Effect:** a very soft rain ambient sound fades in at low volume AND a margin note fades in.
- **Copy brief:** *"raining in Melbourne. we're glad you're inside."*
- **Cooldown:** once per visitor per 14-day window.
- **Sound treatment:** the rain sample is **not** added to the sound registry in Foundations §10. It is explicitly exempt as a hidden-layer effect. The `soundsEnabled` user preference and `prefers-reduced-motion: reduce` both suppress it. Volume cap: 20% of normal UI sound level.
- **Suppression:** does not fire when muted.

### 12. Public CRT turn-off (structural closure)

- **Trigger:** visitor local time between 01:00 and 04:59 Melbourne AND visitor has been on the site for 3+ continuous minutes AND has not already received the Late-Night Visitor egg in the current session.
- **Effect:** screen dims → warm analog static 180ms → CRT horizontal collapse → page becomes non-renderable for this visitor until 07:00 Melbourne local.
- **Copy brief:** *"we've closed for the night. go to bed. the site will reopen at 7am melbourne time, whether you like it or not."*
- **Enforcement:** a short-lived cookie + server-check gates re-entry. A user who clears cookies gets the site back; that's acceptable — the egg is a joke, not a security control.
- **Cooldown:** once per visitor ever in a rolling 30-day window.
- **Counts against:** exempt from the public 2-per-14-day budget because it's a structural closure egg, equivalent to the public holiday egg.

---

## Cadence model (locked)

### Public visitors

- **Guaranteed first egg.** Every public visitor receives **one** egg during their first session. This is non-negotiable — the ambient layer alone is not enough payoff for the "someone will stumble across SuperBad" moment.
- **First-egg delivery logic:** during the session, the trigger evaluator ranks all eligible eggs as events occur. The highest-ranked eligible egg fires. If nothing has fired by session-end (`visibilitychange` or `beforeunload`), a default **welcome egg** fires as a safety net:
  - **Copy brief:** *"you came, you saw, nothing happened. we noticed."*
- **Subsequent cadence:** max **2 eggs per rolling 14-day window** per visitor thereafter.
- **State persistence:** `first_egg_delivered_at` stored in both cookie and localStorage (redundancy; losing one shouldn't re-fire the welcome). `last_hidden_egg_fired_at` + a short history of `fired_egg_ids` keeps the rolling window.

### Authenticated users (admin and customer)

- **Max 1 egg per user per 7-day rolling window.** Lower cadence than public because the signal is denser — a returning signed-in user has more exposure to Lite per day than a casual visitor.
- **State:** `last_hidden_egg_fired_at` column on the `user` table + a `hidden_egg_fires` log table for per-egg cooldowns.

### Crossover (public visitor logs in mid-session)

- The public visitor's cookie-based egg history **transfers into** their user account on login. Eggs they've already earned do not re-fire; eggs they haven't seen are still available. The first authenticated egg is not forced — they've already had their public first egg.

### Context-aware suppression (never fire during)

Hidden eggs are gated off during the following moments, regardless of trigger match:

- Mid-payment (Stripe Payment Element mounted, before success or cancel).
- Mid-email-compose (draft surface focused).
- Quote acceptance (between tickbox enable and webhook confirmation).
- Error recovery (any 4xx/5xx page, or a failed-action state).
- Onboarding wizard steps.
- First-ever authenticated login (user's first 30 seconds on the platform — no eggs, clean impression).
- The first 30 seconds of any session, authenticated or public, to let the page breathe before talking back.

Suppression is a **hard gate**, not a heuristic. If the trigger evaluator can't cleanly assert the user is not in a suppressed state, no egg fires.

---

## Riddle loop (locked — Q2 path)

A small mechanic that invites hidden eggs to be pulled in from social media, shortening the path from "SuperBad posts something cryptic" to "someone discovers the egg".

### Shape

1. A riddle posts to social (Instagram / LinkedIn / X). Example: *"the number of times my grandmother said 'I told you so' at dinner last year."*
2. The answer is a short string (e.g. `fourteen`).
3. The answer resolves via **one shared resolver**, `resolveRiddleAnswer(input, context)`, accessible from:
   - **The public search bar** in the marketing site header.
   - **A dedicated public URL**: `/say/[answer]` — the answer is the slug.
   - **The admin search bar** inside `/lite` (for signed-in staff / Andy).
4. The resolver normalises input (lowercase, strip whitespace, strip punctuation), hashes it with a per-riddle salt, and checks against the correct-answer hash stored in `riddles` table.

### Reward asymmetry by audience

- **Public (not logged in):** reveals a **public reward** — typically a hidden page with some dry content, a small animation, a margin note — and logs the resolution to `riddle_resolutions`.
- **Logged-in (admin or customer):** reveals a **richer reward** (longer content, a small persistent trace in their account — a tiny icon somewhere on their profile or dashboard that lingers as evidence they found it) AND logs to `riddle_resolutions` with the user_id.
- **The reward content itself is Claude-generated at riddle-creation time** from a single system prompt that takes the riddle + the audience type as input. Andy does not author reward content.

### Wrong-answer branching (Q6 — hybrid)

When `resolveRiddleAnswer(input)` misses the correct hash:

1. **First pass — pre-generated common wrongs.** Each riddle ships with a closed list of **5–7 common wrong answers** (e.g. for *"the number of times my grandmother said 'I told you so' at dinner last year"* the common wrongs might be `zero`, `one`, `seven`, `twelve`, `fifteen`, `once`, `daily`). Each common wrong has a Claude-generated dry micro-response cached at riddle-creation time. Instant response, zero runtime cost.
2. **Second pass — live Claude fallback.** If the submitted wrong answer isn't in the common-wrongs list, a live Claude call generates a one-shot dry response reading `(riddle, submitted_answer, brand_dna_profile)`. Haiku-tier. The generated response is cached against `hash(submitted_answer)` for future matches.
3. **Budget cap:** live-fallback calls per-riddle cap at **~100 unique lifetime calls**. Once exceeded, additional unknown wrongs fall back to a pre-generated catch-all dry response generated at riddle-creation time.
4. **Every wrong-answer response passes the Brand-Voice Drift Check** before being shown. Drift-check failures fall back to the catch-all.
5. **Wrong answers never get the reward.** They get a dry line and the opportunity to try again. No rate limiting on retries (it's a joke, not a password).

### Technical notes

- Riddles live in a `riddles` table with: id, slug (public URL), salt, answer_hash, created_at, retired_at, public_reward_content, loggedin_reward_content, common_wrong_answers (JSON), catch_all_wrong_content.
- Resolution lives in `riddle_resolutions`: id, riddle_id, actor_type (`public` / `admin` / `customer`), user_id (nullable), input (for audit, hashed if sensitive), resolved_at, outcome (`correct` / `common_wrong` / `novel_wrong` / `catch_all_wrong`).
- The resolver is a single pure function in `lib/riddles/resolve.ts`. Both surface bindings (public search, admin search) import the same function — no forking.
- A retired riddle continues to resolve but with a dry "that riddle's retired" response, so links aged out of social posts still behave politely.

---

## Kill switch (locked)

Every user, authenticated or public, can disable hidden eggs.

- **Authenticated** — Settings → Display → toggle **"No tricks"**. Default: off (tricks enabled). Ambient layer is unaffected and cannot be disabled — ambient IS the voice, and disabling the voice is disabling SuperBad. This is deliberate.
- **Public** — a small footer link **"No tricks"** sets a cookie disabling hidden eggs for this visitor on all public surfaces. Same scope: ambient layer unaffected.
- The public CRT turn-off egg (#12) respects the kill switch. Being 3am in Melbourne does not override the user's explicit preference.

The toggle is mentioned nowhere in normal product copy. It exists for the vanishingly rare user who hates it.

---

## Technical architecture

### New tables

**`riddles`** — source of truth for each active riddle. Shape in "Technical notes" above.

**`riddle_resolutions`** — append-only log of every resolver call. Used for debugging riddle performance, spotting popular wrong answers, and pruning the common-wrongs list over time.

**`hidden_egg_fires`** — append-only log of every hidden egg that fires. Shape:
- `id`
- `egg_id` (foreign key to the closed registry of egg IDs)
- `actor_type` (`public` / `admin` / `customer`)
- `user_id` (nullable — null for public)
- `visitor_id` (cookie-based ID for public, null for authenticated)
- `fired_at` (timestamp, UTC per Foundations §11.3)
- `trigger_evidence` (JSON — the real event data that matched the trigger; mandatory for post-hoc debugging)
- `session_id` (to deduplicate within a session)

**`ambient_copy_cache`** — cached Claude-generated ambient lines per slot. Shape:
- `slot` (enum from the closed-list of 6 ambient surface categories)
- `context_hash` (the hash of the generation context — page, entity, or slot-specific state)
- `generated_text`
- `drift_check_score` (the score from Foundations §11.5)
- `generated_at`
- `expires_at` (null for forever-cached, or a timestamp if we want scheduled refresh)

### New columns

- `user.last_hidden_egg_fired_at` (UTC timestamp, nullable)
- `user.hidden_egg_tricks_enabled` (boolean, default `true`)
- `user.fired_egg_ids_recent` (JSON array of recent egg IDs for 30-day cooldown evaluation — max 50 entries, FIFO)

### New Claude primitives

- **`generateInVoice(slot, context, brandDnaProfile)`** — single shared primitive for all voice-generated copy in this spec. Returns text. Routes through the drift check (§11.5). Used by ambient copy cache builder, egg copy generator at build time, riddle reward generator, wrong-answer fallback generator.
- **`resolveRiddleAnswer(input, context)`** — single pure function in `lib/riddles/resolve.ts`. Returns `{ outcome, content }` where outcome is one of `correct` / `common_wrong` / `novel_wrong` / `catch_all_wrong` / `retired` / `unknown_riddle`. Does the hashing, the lookup, the wrong-answer branching, and the live-Claude fallback. Called identically from public and admin surfaces.

### Trigger evaluator discipline

- **Real data only.** Every trigger evaluator reads from the activity log, the user table, the session, or the browser — never from a separately derived "inferred state" table. If a trigger needs a derived signal, that derivation happens once at evaluation time, not via a background process that might go stale.
- **Fail closed.** Ambiguous state means no fire. The system's default posture is silence; firing is the exception.
- **Log everything.** Every fire writes a row to `hidden_egg_fires` with the evidence used to decide. Non-fires that were *evaluated* and *rejected* do NOT log — that would be too much noise.
- **No ML.** Triggers are deterministic rules over explicit signals. No embedding similarity, no classifier, no "learned" thresholds. The whole feature is built on the premise that Lite is obviously noticing obvious things.

### Cost architecture

- **Haiku-tier:**
  - Drift check calls (§11.5 already covers this).
  - Ambient line generation.
  - Riddle wrong-answer novel-fallback generation.
- **Opus-tier:**
  - Riddle reward content generation (done once at riddle-creation time, very rare).
- **Budget:**
  - Ambient layer: generation cost is one-time per surface and cached. Rebuilds on explicit refresh only.
  - Hidden eggs: generation cost is zero at fire time (all copy pre-generated and cached).
  - Riddle loop: live Claude fallback capped per-riddle at ~100 unique calls lifetime. Estimated total monthly spend for the feature is sub-$5/month assuming reasonable riddle cadence.
- **Kill-switch wired into Phase 4 Autonomy Protocol.** A runaway generation loop on ambient copy or riddle fallback must be stoppable from the protocol's central budget kill-switch.

---

## Silent dependency on `docs/specs/brand-dna-assessment.md`

**Every line of voice-generated copy in this spec must pass the Brand-Voice Drift Check (Foundations §11.5).** The drift check grades generated lines against a Brand DNA profile. For SuperBad's own voice — which is what ambient copy, egg copy, and riddle reward content are measured against — **the Brand DNA profile being graded against is SuperBad's own**.

This means:

- **This spec cannot ship before `docs/specs/brand-dna-assessment.md` is locked.** The assessment's output format is the thing the drift check reads. Writing this spec earlier is fine (it's done); building it earlier is not.
- **SuperBad must take its own Brand DNA Assessment before this spec is built in Phase 5.** Andy runs through the assessment on himself (Founder Profile) and on SuperBad the business (Business Profile), and the resulting profile becomes the grading substrate.
- **The assessment's signal-tag taxonomy must be tight enough that the drift check can meaningfully distinguish "on-voice" from "generic dry".** This is a load-bearing constraint on the assessment spec's own design work — flag it when that spec is written.

**Phase 3 sequencing implication:** `brand-dna-assessment.md` stays ahead of this spec in the backlog. Building order in Phase 5 is: Brand DNA feature → SuperBad's own assessment run → then this feature.

---

## Compositional rules — how other specs reference this

Every future spec that touches a user-visible surface references this spec under a short heading **"Voice & delight treatment"** that points at:

1. Which ambient surface categories in the closed list apply to the spec's surfaces.
2. Whether any hidden egg catalogued here is expected to fire on this surface, and which (for cadence budgeting).
3. Whether the spec proposes any **new** hidden eggs, which must be flagged for a separate brainstorm gate (like Tier 2 motion additions).
4. Whether the spec proposes any **new** ambient surface category — also a brainstorm gate.

Specs that do not touch user-visible surfaces (e.g. webhook infra, background workers) do not reference this spec.

---

## What this spec does NOT do

- **Does not add achievements, streaks, points, levels, badges, collectables, or any form of completion tracking.** Not now, not later.
- **Does not expose egg state to the user.** There is no "you have seen 3 of 12 easter eggs" surface anywhere.
- **Does not track user behaviour for any purpose other than trigger evaluation.** `hidden_egg_fires` is a log, not a profile.
- **Does not personalise based on Brand DNA profiles on public surfaces.** Public visitors have no Brand DNA profile, and never will. The tone is SuperBad's, not theirs.
- **Does not auto-generate new eggs.** The catalogue is closed. Additions go through a brainstorm gate.
- **Does not modify the sound registry, the Tier 2 motion list, the density preset list, or the theme preset list.** Hidden-layer effects (CRT static, rain sample) are explicitly exempt from those closed lists because they are once-per-month-per-user rarities. A hidden effect that graduates to a normal product moment must go through the relevant closed-list gate first.

---

## Build-time disciplines added by this spec

**19. Every ambient voice line passes `generateInVoice()` + the drift check (§11.5).** No hardcoded string literals for empty states, error pages, loading copy, success toasts, placeholder text, or morning brief narrative. Enforced at code review. An inlined literal on one of those surfaces is treated the same as an inlined Resend call — refactored out.

**20. Every hidden egg trigger evaluator reads only from real event data and fails closed.** No fuzzy derivation. Evaluators live in `lib/eggs/triggers/*.ts`, one file per egg, each exporting a pure `(context) => boolean | evidence` function. Unit-tested against fixture event data. False-positive regressions are spec-level bugs, not UX polish.

**21. Every hidden egg fire logs its trigger evidence.** `hidden_egg_fires.trigger_evidence` is non-null. A fire without evidence is a bug. This is how we audit "why did Lite pull the plug at 11pm?" after the fact.

**22. The riddle resolver is singular.** `lib/riddles/resolve.ts` is the only path to `resolveRiddleAnswer()`. Public search bar, admin search bar, `/say/[answer]` route, any future surface — all import the same function. Forking is a code-review reject.

**23. Hidden-layer effects are exempt from closed-list disciplines, but each exemption is explicit.** The CRT effect, the rain sample, any future hidden-layer motion or sound — each one is named in this spec as exempt from §11 or the design-system-baseline closed lists. A hidden effect not named here does not exist; adding one reopens this spec or the appropriate closed-list gate.

---

## Data-access audit checklist (added 2026-04-13 Phase 3.5)

Every trigger evaluator in `lib/eggs/triggers/*.ts` MUST declare, in a top-of-file JSDoc block, the exact data it reads. A PR adding or modifying a trigger is rejected in review unless the JSDoc block is present and accurate. Phase 3.5 → 4 compiles these declarations into a single audit table in `docs/surprise-delight-data-access.md`.

**Required JSDoc fields per trigger:**

```ts
/**
 * @egg milestone-spotter
 * @register admin-roommate
 * @reads
 *   - deals (id, stage, closed_at, company_id) WHERE closed_at >= now() - 24h
 *   - sessions.last_signed_in_at FOR Andy only
 * @does_not_read
 *   - any other admin's activity (N/A in v1, guardrail for future)
 *   - any client-scoped data (brand_dna, context_summaries, messages)
 * @cross_client_inference false
 * @evidence_fields [deal_ids[], session_gap_hours]
 */
```

**Four invariants enforced by this audit:**

1. **Register boundary.** An admin-register egg MUST NOT read client-scoped tables (`brand_dna_profiles`, `context_summaries`, `private_notes`, `messages`, `action_items`, `quote_*`, `invoice_*`, `client_portal_*`). A public-register egg MUST NOT read any authenticated-user data. A customer-bartender egg MUST NOT read cross-client data (its own client only).
2. **No cross-client inference.** `@cross_client_inference` is `false` for every egg in v1. Setting it `true` requires a brainstorm gate.
3. **Evidence fields match `trigger_evidence`.** `@evidence_fields` must exactly match what gets written to `hidden_egg_fires.trigger_evidence`. Discipline #21 becomes testable by this match.
4. **Public eggs read cookie/localStorage only.** `@reads` for public triggers is constrained to `cookie:egg_history`, `cookie:first_egg_delivered_at`, `cookie:tricks_disabled`, `session:dwell_ms`, and `document:referrer`. Nothing else. No server-side state, no Andy-session data.

**Audit build step (Phase 4 AUTONOMY_PROTOCOL):** a CI/test-time script parses every trigger's JSDoc, validates against the invariants, and fails the suite on violations. Cross-reference the compiled table from this spec's §Build-time disciplines in every subsequent brainstorm that proposes a new egg.

---

## Success criteria

- A public visitor coming to the marketing site from a LinkedIn post at 2am on a Sunday should, within their first visit, experience **at least one** moment that makes them stop and think *"wait, did the site just—"* and then carry on. Not two. Not ten. One.
- Andy, signed into `/lite` after a three-night late binge, should see the CRT turn-off egg fire exactly once, within 30 days of meeting the trigger, and feel mildly caught-out rather than nagged.
- A customer who hates it should be able to turn it off in under 10 seconds via Settings → Display → "No tricks", with no friction, no modal, no confirmation.
- The ambient layer should make every empty state, error page, loading line, and success toast in the platform feel like SuperBad wrote it — even though SuperBad didn't write any of it.
- Zero false-positive fires in Phase 5 testing. A false fire is a spec-level defect. The calibration discipline is the work.

---

## Out of scope (explicit non-goals)

- Multi-language voice treatment (ambient copy and eggs are English-only in v1).
- User-configurable egg creation (no "build your own egg" admin UI).
- Public API for the riddle loop.
- Analytics dashboards for hidden eggs beyond the raw `hidden_egg_fires` log.
- Any form of gamified engagement mechanic.
- Any behavioural surface that rewards *frequency of use* (that way lies dark-pattern hell).

---

## Open items to resolve during build

1. **Cookie/localStorage schema for public visitor state.** Needs a short design pass in Phase 5 first-session to lock the structure (`egg_history`, `first_egg_delivered_at`, `tricks_disabled`, cookie TTL). Flag for the Phase 5 session that builds the public marketing shell.
2. **`/data/au-holidays.json` ownership.** Foundations §11.4 introduces the file for outreach quiet windows. This spec uses the same file. Its maintenance schedule is an operational task that needs to live in the Phase 6 launch checklist, not this spec.
3. **Riddle content authoring loop.** The brainstorm agreed Andy does not author reward content, but the *riddles themselves* (the social-media prompts) might be hand-written by Andy in early batches. Resolve during Phase 5 content-engine integration: do riddles get generated by the Content Engine, or are they a rare hand-touched artefact? Both paths are compatible with this spec.
4. **Admin-egg catalogue expansion.** Two admin eggs are now locked (CRT turn-off + milestone spotter). A follow-up brainstorm should produce 2–4 more before Phase 5 build of this feature starts, so there's enough variety for rotation.

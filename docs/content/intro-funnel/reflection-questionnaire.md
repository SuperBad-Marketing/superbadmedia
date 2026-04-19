# Intro Funnel — Post-Shoot Reflection Questionnaire

**Spec reference:** `docs/specs/intro-funnel.md` §13.2, §13.3, §13.4
**Voice register:** Warm, unhurried, genuine. This is the prospect reflecting on a real experience they just had. Not a feedback form — a self-persuasion arc.
**UI:** One question per screen, premium card, house-spring transitions between screens.
**Arc:** Safety valve → experience → value → relationship → specifics → future → commitment → synthesis reveal.

---

## Screen intro

*Before Q1, a brief framing screen.*

**Heading (Righteous, uppercase):**
> A FEW THINGS TO THINK ABOUT

**Subline (DM Sans):**
> This takes a couple of minutes. There's something at the end worth seeing.

---

## Q1 — Safety valve

**Question:**
> Before we get into it — was there anything about the shoot that wasn't right?

**Options (tappable cards):**
- Everything was great — let's keep going
- There was something off — I'd like to share

**If "something off" selected:**

*Screen transitions to a free-text input.*

**Prompt:**
> Tell us what happened. No filter needed.

**Placeholder:** *"Whatever it is, we'd rather hear it."*
**Character limit:** 1000

**Below the textarea (DM Sans, small, muted):**
> Andy will read this personally and get back to you.

**Submit button:** Send this through

*On submit: `safety_valve_triggered = true`, reflection completes early, urgent cockpit card for Andy. No further reflection questions. The prospect sees:*

**Confirmation screen heading:**
> Got it. Andy will be in touch.

**Subline:**
> Your photos, video, and plan are still in your portal — nothing changes there.

---

## Q2 — Experience

**Question:**
> How did the shoot feel?

**Options:**
- Better than I expected
- About what I expected — in a good way
- It was fine, nothing remarkable
- A bit awkward, but the result was worth it

---

## Q3 — Value reflected

**Question:**
> Now that you've seen everything — the photos, the video, the plan — was it worth the investment?

**Options:**
- Genuinely, yes
- More than I expected
- It was fair — I got what I paid for
- I'm not sure yet — I need more time with it

---

## Q4 — Working with Andy

**Question:**
> What was it like working with Andy?

**Options:**
- Easy — he got it quickly
- Surprisingly hands-off — in a good way
- He pushed me in directions I wouldn't have gone myself
- Professional, but I'd need more time to build trust
- He listened more than I expected

---

## Q5 — Specific value (free text, optional)

**Question:**
> Was there a moment, a photo, or something in the plan that stood out?

**Placeholder:** *"The thing you'd show someone if they asked what you got."*
**Character limit:** 500

**Skip affordance (small, below input):**
> Nothing specific — skip this one

---

## Q6 — Future-casting

**Question:**
> If this was the beginning of something longer, what would that look like for your business?

**Options:**
- Regular shoots — keep the content fresh
- Someone handling the strategy, not just the camera
- A proper marketing partner who knows my business
- I'd want to see results first before thinking bigger
- I'm not sure yet, but I'm curious

---

## Q7 — Commitment crystallisation

**Question:**
> If you kept working with SuperBad, what would you want us to handle?

**Options:**
- Content — photos, video, the creative side
- Strategy — telling me what to do and when
- Execution — actually running the ads, the emails, the posting
- All of it — I want it off my plate
- I'm not ready to think about that yet

---

## Q8 — Synthesis reveal screen

*This screen is different from the others. No question — it's the Claude synthesis.*

**Pre-reveal state (while synthesis generates, ~2–5 seconds):**

**Heading (Righteous, uppercase):**
> ONE MORE THING

**Subline (DM Sans):**
> We've been listening. Here's what we heard.

*Subtle loading state — SuperBad mark with a gentle pulse. Not a spinner. House spring on the pulse.*

**Post-reveal state (synthesis text appears):**

*Tier-2 motion: synthesis text enters with a considered reveal — not a slam, not a typewriter. A single, breathing entrance. The text should feel like it arrived, not appeared.*

**Synthesis text** rendered in Playfair Display italic, generous line height, moderate width. Set against Dark Charcoal. The text is 2–4 paragraphs, written by Opus, mirroring the prospect's own reasoning back to them in SuperBad's voice.

**Below the synthesis, after a beat (house spring, 400ms delay):**

**Decision CTA pair:**

Primary (SuperBad Red, prominent):
> Yes — let's talk about what's next

Secondary (outlined, quieter):
> Let me think about it

*No pressure copy. No "limited time" wrapper. The synthesis is the argument — the CTAs are just doors.*

**Below CTAs (DM Sans, small, muted):**
> Either way, your portal stays open. Your plan is yours.

---

## Synthesis prompt framing

**Prompt file:** `lib/intro-funnel/prompts/reflection-synthesis.ts`
**Model:** Opus
**Voice:** SuperBad's voice — dry, warm, observational. Never salesy. Mirrors back what the prospect said and connects dots they might not have connected themselves.

**Prompt direction:**

> You are writing a short personal synthesis for someone who just completed a trial shoot with SuperBad Marketing. You have their full context: their questionnaire answers about their business, the type of business they run, their reflection on the shoot experience, and SuperBad's own Brand DNA profile.
>
> Write 2–4 paragraphs that:
> 1. Mirror back what they said — use their own language where possible
> 2. Connect their business situation to what they experienced in the shoot
> 3. Name what's actually at stake for them (not in a dramatic way — in a matter-of-fact way)
> 4. End on a note that makes continuation feel like the obvious next step, without asking for it
>
> Voice rules:
> - Dry, observational, warm. Never urgent. Never salesy.
> - Short sentences. Leave room.
> - You can be direct about what you see — this person just spent an hour with Andy and $297. They can handle honesty.
> - Never use: "synergy", "leverage", "solutions", "unlock", "journey", "transform"
> - Never explain SuperBad's services. The prospect knows what happened.
> - If the safety valve was triggered, do NOT generate a synthesis. Return null.
>
> Output: plain text (rendered in Playfair Display italic on the frontend). No markdown, no headers, no formatting.

**Drift check:** §11.5 brand-voice drift check passes before display. On fail, use safe fallback:

**Safe fallback synthesis:**
> You showed up. That's the part most people talk about but don't do.
>
> Everything from the shoot — the photos, the video, the plan — it's in your portal whenever you're ready to look at it properly. Take your time with it.
>
> If something clicks, you know where to find us.

*The fallback is warm but generic. It doesn't reference the prospect's answers (since the drift-failed synthesis might have mishandled them). It still earns the reveal moment without risking a jarring tone.*

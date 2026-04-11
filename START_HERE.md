# START HERE

You are a fresh Claude Code session in the SuperBad Lite project directory. If Andy has just said **"let's go"** (or any variant), this file is your first read after `CLAUDE.md`.

## Your job in the first turn

1. Read `CLAUDE.md` in full (the full rules of engagement are there).
2. Read `SESSION_TRACKER.md` and find the **🧭 Next Action** block. It tells you which phase to run.
3. Match the phase to the protocol below.
4. Begin the phase. In your first message to Andy, say (in plain English) which phase you're in, what it's going to produce, and ask the first brainstorm question.

Do not dump this file's contents at Andy. Do not ask him which phase to run. The tracker decides, you execute.

---

## Phase 1 — Scope Brainstorm

**Goal:** decide what SuperBad Lite actually does. Ruthlessly limited.

**Output:** `SCOPE.md` — a short document listing the features Lite will include, in plain English, with explicit non-goals.

**Protocol:**

1. Start by reminding Andy of the goal of Lite: operations platform to take load off him (lead gen, sales, client management, daily planning, SaaS billing), beautifully designed, satisfying to use, built in weeks not months.
2. Brainstorm the scope **one multiple-choice question at a time**, following the brainstorm rules in `CLAUDE.md`:
   - Start broad (which operational areas matter most right now) and narrow down (what does "lead gen" look like in Lite — a CRM? an inbox? a scheduler?).
   - Every question has 3–5 options, a recommendation, and a rationale in plain English.
   - Self-check each option for cascading consequences before asking.
3. Cover at minimum:
   - Which of the five core areas (lead gen, sales, client mgmt, daily planning, SaaS billing) are **in** for v1 and which are deferred.
   - What the "daily planning" surface looks like (what Andy sees when he opens the app in the morning).
   - How SaaS subscriptions are handled (customer self-serve? Andy creates subs manually? Stripe Checkout?).
   - What the absolute minimum feature set is to make Lite useful on day one (MVP cut).
4. End the brainstorm with an **honest build/success reality check**: what's the hardest part, what could go wrong, is this actually doable in the time Andy has.
5. Write `SCOPE.md` and update `SESSION_TRACKER.md` to point at Phase 2.
6. Write `sessions/phase-1-handoff.md` — what was decided, what was deferred, open questions for Phase 2.

---

## Phase 2 — Foundations Brainstorm

**Goal:** lock in the tech stack, hosting, domain setup, auth, data model approach, and resolve the marketing-site access question.

**Output:** `FOUNDATIONS.md` — plain-English summary of the stack decisions, plus a one-paragraph justification for each.

**Protocol:**

1. Read `SCOPE.md` first. The stack has to serve the scope, not the other way round.
2. Brainstorm foundations one question at a time. Each question needs a recommendation with rationale in plain English. Andy cannot evaluate tech tradeoffs himself — make the call, explain the impact.
3. Cover:
   - **Framework:** Next.js App Router is almost certainly the answer (matches HQ, well-documented, lots of existing skills) but confirm explicitly.
   - **Database:** SQLite + Drizzle (simple, file-based, zero-ops) vs Postgres. Recommend SQLite for Lite.
   - **Auth:** NextAuth v5 / Auth.js with magic link email. Simplest thing that works.
   - **Payments:** Stripe Checkout + Billing Portal (hands off most of the work to Stripe).
   - **Email:** Resend (transactional) + one template for magic links.
   - **Hosting:** Vercel (simplest, zero-config) vs reusing HQ's Coolify+DigitalOcean setup. Recommend Vercel.
   - **Domain:** how `superbadmedia.com.au/lite` actually resolves (DNS, Cloudflare, path-based routing to a separate Vercel project or a subfolder in a monorepo).
   - **Marketing site access:** where does `superbadmedia.com.au/` currently live, and how do we edit it from this working directory? **This is the "Marketing site" question from CLAUDE.md — surface it early in Phase 2.** If the answer is "separate repo", decide whether to clone it into `/Users/Andy/Desktop/SuperBad Lite/marketing-site/` or reference it via symlink.
   - **Design system baseline:** one set of colours, one type scale, motion tokens, sound effect approach (for the "Apple-satisfying" feel Andy wants).
4. After decisions are locked, copy the relevant project skills from `/Users/Andy/superbad-hq/.claude/skills/` into `./.claude/skills/`. Likely set: `nextauth`, `stripe`, `drizzle-orm`, `tailwind-v4`, `nextjs16-breaking-changes`, `email-nodejs`, `react-19`, `framer-motion`, `nextjs-seo`, `webapp-testing`, `typescript-validation`. Copy, don't symlink — Lite needs to be independently maintainable.
5. Write `FOUNDATIONS.md`, update `SESSION_TRACKER.md` to point at Phase 3, write `sessions/phase-2-handoff.md`.

---

## Phase 3 — Feature Specs

**Goal:** turn each scoped feature into a concrete spec that a build session can implement without needing to re-decide anything.

**Output:** `docs/specs/<feature>.md` — one file per feature from SCOPE.md.

**Protocol:**

1. Read `SCOPE.md` and `FOUNDATIONS.md`.
2. **One feature per conversation.** Do not try to spec multiple features in a single session — context will burn out and quality will drop. If SCOPE.md has 5 features, Phase 3 is 5 sessions.
3. Each spec must cover:
   - **User story** — one paragraph in plain English: what Andy (or a customer) does, and what they get.
   - **UI description** — screen by screen, described in words. Reference the design system baseline from FOUNDATIONS.md.
   - **Data model** — what tables/fields are needed (Drizzle schema described in plain English, not code).
   - **Integrations** — any external APIs involved (Stripe, email, etc.).
   - **Success criteria** — how we'll know it works.
   - **Out of scope** — explicit non-goals to prevent scope creep.
4. For each spec session, brainstorm the open questions one multiple-choice question at a time (same rules).
5. After each spec, update `SESSION_TRACKER.md` and write a handoff note.
6. Phase 3 is done when every feature in SCOPE.md has a spec.

---

## Phase 4 — Build Plan

**Goal:** order the feature specs into build sessions, each sized to finish in one conversation with headroom. Produce a dependency-ordered build plan.

**Output:** `BUILD_PLAN.md` — the ordered list of build sessions, with a one-line summary of each and its dependencies.

**Protocol:**

1. Read all of `docs/specs/*.md`.
2. For each spec, break it into atomic build sessions. A build session is: one feature surface, small enough to finish in a single Claude Code conversation with room for debugging.
3. Order by dependency — you can't build a feature that consumes auth before auth itself works.
4. **First build session must always be the foundation session**: auth, database, base layout, design system tokens, sound effect primitives. Nothing visible to end users, but everything else depends on it.
5. Tag each session with: type (FEATURE / INFRA / UI / FIX), estimated context budget (small / medium / large), and any preconditions.
6. Update `SESSION_TRACKER.md` to point at the first build session in Phase 5.
7. Write `sessions/phase-4-handoff.md`.

---

## Phase 5 — Build Execution

**Goal:** build the platform, session by session, without drift.

**Protocol (for every build session):**

1. Read the last 2 handoff notes from `sessions/`.
2. Read the spec for the feature being built.
3. Implement. Touch only what the spec says.
4. **Verification before marking done:**
   - Typecheck: `npx tsc --noEmit` — zero errors.
   - Tests: `npm test` — green.
   - Manual browser check — feature works end to end.
5. Write `sessions/<session-id>-handoff.md`.
6. Update `SESSION_TRACKER.md` Next Action pointer.

If verification fails: stop, diagnose root cause, fix. Do not bulldoze. Do not bypass checks.

---

## Phase 6 — Launch

**Protocol:**

1. Configure `superbadmedia.com.au/lite` DNS + path routing (decided in Phase 2).
2. Deploy to production.
3. Configure Stripe live keys (Andy must do this manually — the keys never live in the repo).
4. Smoke test every feature on production.
5. Write `sessions/phase-6-handoff.md` documenting the live URLs, env vars needed, and monitoring setup.

---

## Meta rules that apply to every phase

- Brainstorm format: **one multiple-choice question at a time, recommendation with rationale, plain English**. Violating this is the single most common failure mode — do not.
- When in doubt, split. New scope inside a brainstorm = new session.
- Compact context between sessions. A fresh conversation is cheaper than a confused one.
- If you finish a phase and the tracker isn't updated, the phase isn't done.

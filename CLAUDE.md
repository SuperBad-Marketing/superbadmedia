# SuperBad Lite — CLAUDE.md

## What this project is

A stripped-down v1 operations platform for SuperBad Marketing, built while the more ambitious SuperBad HQ is still in development. Lives at **superbadmedia.com.au/lite** (platform path) alongside the existing marketing site at **superbadmedia.com.au/** (untouched by this project but editable from this same working directory — see "Marketing site" below).

Goal: take as much operational load off Andy as possible — lead generation, sales, client management, daily planning, and SaaS subscription billing — while staying simple enough to actually ship in weeks, not months.

This is NOT a v2 of anything. It's a pragmatic v1 that is allowed to be boring under the hood as long as it's beautiful and satisfying on top.

## Who Andy is

- Solo founder of SuperBad Marketing (Melbourne). Non-technical background.
- Cannot evaluate implementation tradeoffs. Never ask him to pick between technical options — make the call, explain the impact in plain language, and let him redirect if he disagrees.
- Voice: dry, observational, self-deprecating, slow burn. Never explain the joke. Ban "synergy", "leverage", "solutions".
- Mouse-first — does not use keyboard shortcuts.

Load the `superbad-business-context`, `superbad-brand-voice`, and `superbad-visual-identity` skills when they're relevant.

## The "let's go" protocol

When Andy says **"let's go"** (or "next", "continue", "what's next"), do this in order:

1. Read `START_HERE.md` (always, every time — the phase protocols live there).
2. Read `SESSION_TRACKER.md` and find the **🧭 Next Action** block.
3. Execute the phase that block points at, following the protocol from `START_HERE.md`.
4. At the end of the session, update the Next Action block to point at the next incomplete item and write a handoff note to `sessions/<session-id>-handoff.md`.

Do not guess what's next. Do not skip phases. The tracker is the source of truth.

## Build phases (high level)

```
Phase 0 — Pre-flight scaffolding (DONE, carried out from the HQ session)
Phase 1 — Scope brainstorm            → SCOPE.md
Phase 2 — Foundations brainstorm       → FOUNDATIONS.md (tech stack, hosting, domain, auth, data)
Phase 3 — Feature specs                → docs/specs/*.md (one per scoped feature)
Phase 4 — Build plan                   → BUILD_PLAN.md + updated SESSION_TRACKER.md
Phase 5 — Build execution              → session by session, handoff notes, verification
Phase 6 — Launch + iterate             → domain cutover, monitoring, real use
```

Details of each phase's protocol live in `START_HERE.md`.

## Brainstorm rules (non-negotiable)

These apply in Phase 1, Phase 2, Phase 3, and any future brainstorm:

1. **One multiple-choice question at a time.** Never dump a list of questions at Andy. Ask, wait, move on.
2. **Every question has a recommendation with rationale.** Say which option you'd pick and why, in plain English. Andy will accept or redirect.
3. **Plain English only.** No jargon. If a technical term is unavoidable, define it in the same sentence.
4. **Self-check every question before asking.** For each option, think through the cascading consequences. Flag any option that would create problems later.
5. **Default to splitting.** If new scope emerges inside a brainstorm, spin it into its own session rather than bundling.
6. **End every brainstorm with an honest build/success reality check.** What could go wrong, what's the hardest part, is this actually doable given context limits.

## Code discipline

- **No HQ reuse.** Never copy code from `/Users/Andy/superbad-hq/`. It exists for context only — read it to understand patterns or check how something was done, but Lite is a fresh build.
- **Boring tech wins.** Proven, minimal, well-documented. Every dependency is a liability.
- **Never install an npm package without flagging the reason.**
- **Search before creating.** Check the existing Lite codebase for equivalents before writing new components.
- **One concern per commit.** Log unrelated issues, don't fix them in the same pass.
- **Touch only what was asked.** No scope creep inside a session.

## Session discipline

- **Tight scope per session.** Each build session must be small enough to finish in one conversation with headroom for debugging. If a session looks borderline, split it.
- **Handoff notes mandatory.** At the end of every build session, write `sessions/<session-id>-handoff.md` covering: what was built, key decisions, what the next session should know. Bullets, not paragraphs.
- **Start of every build session: read the last 2 handoff notes.** Do not rediscover what the previous session documented.
- **Verification before "done":** typecheck passes, test suite green, feature manually verified in the browser, handoff note written. No exceptions.
- **Compact between sessions.** Context hygiene is how we avoid the "Claude forgot half the codebase" failure mode.

## Error handling (for when code actually starts existing)

- No empty catch blocks. Error, toast, return typed error, or re-throw.
- Three-state rule: loading → error → empty → success. No blank screens.
- `useEffect` cleanup mandatory for listeners, intervals, timers, subscriptions.
- No `console.log` in committed code. `console.error`/`console.warn` only.
- Env vars: never raw `process.env` in components. Client vars need `NEXT_PUBLIC_`. Missing vars fail loudly.

## Git

- Do not commit unless Andy asks.
- Message format: `[PHASE|TYPE] description` (e.g. `[PHASE-1] Scope brainstorm output`, `[BUILD] Add stripe webhook handler`).
- Never push without instruction. Never amend existing commits.

## Marketing site

Andy wants to edit the existing SuperBad Marketing site (currently at `superbadmedia.com.au/`) from this same Claude Code working directory, without tangling it into the Lite build.

**Status:** the marketing site's actual location (separate repo? subfolder? live hosting platform?) is not yet known in this project. This is a **Phase 2 Foundations question** — do not attempt to touch the marketing site until Phase 2 has resolved where it lives and how we access it. Flag it early in Phase 2.

## Skills

Global skills auto-load from `~/.claude/skills/`. Relevant ones for brainstorm phases:
- `brainstorming`, `writing-plans`, `spec-driven-development`, `planning-with-files`
- `superbad-business-context`, `superbad-brand-voice`, `superbad-visual-identity`
- `code-review`, `systematic-debugging`, `context-compression`

Project-specific skills (Next.js, Drizzle, Stripe, NextAuth, etc.) will be copied into `.claude/skills/` during Phase 2 once the stack is locked. Until then, reference the HQ skills library at `/Users/Andy/superbad-hq/.claude/skills/` for lookups only — do not copy code from HQ.

## What to do when you're stuck

- Context running low → compact, write a handoff note, stop. Better to end cleanly than bulldoze through.
- Scope unclear → ask Andy one multiple-choice question. Do not guess.
- Two approaches both look fine → pick one, explain why, move on.
- Something in HQ looks relevant → read it for context, do not copy.

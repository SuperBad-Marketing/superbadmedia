# Phase 0 — Scaffold Note

**Written by:** the HQ Claude Code session on 2026-04-11, before the SuperBad Lite project was opened in its own Claude Code session.

**Why this file exists:** so the first fresh Claude Code session in `/Users/Andy/Desktop/SuperBad Lite/` knows what was set up, what decisions were pre-made, and what was intentionally left open.

## What was decided in Phase 0

- **Project lives at:** `/Users/Andy/Desktop/SuperBad Lite/`
- **Platform will be served at:** `superbadmedia.com.au/lite` (the `/lite` path on the main marketing domain, which stays untouched at the root).
- **Marketing site:** Andy wants to also edit the existing marketing site from this same working directory, but the marketing site's actual location is not yet known. This is deferred to Phase 2 — Foundations. Do not touch the marketing site until Phase 2 has resolved it.
- **No HQ code reuse.** Read HQ for context only. Everything in Lite is built fresh.
- **Project-level skills** will be copied from `/Users/Andy/superbad-hq/.claude/skills/` into `./.claude/skills/` during Phase 2, after the stack is locked. Global skills at `~/.claude/skills/` are already available.

## What was scaffolded

```
/Users/Andy/Desktop/SuperBad Lite/
├── CLAUDE.md                      ← Project instructions (rules, voice, discipline)
├── START_HERE.md                  ← "let's go" protocol + per-phase protocols
├── SESSION_TRACKER.md             ← Next Action pointer + phase roadmap + session log
└── docs/
    └── phase-0-scaffold-note.md   ← This file
```

Everything else (`SCOPE.md`, `FOUNDATIONS.md`, `docs/specs/`, `sessions/`, `BUILD_PLAN.md`, `package.json`, source code) will be created as the phases run.

## What was deliberately NOT scaffolded

- **No `package.json`, no source code, no install.** The stack isn't locked yet — Phase 2 decides. Starting Next.js before then would pre-commit us to choices we haven't made.
- **No `.gitignore` or git init.** Andy decides whether this is a git repo, when, and under what account. Flag it in Phase 2.
- **No memory directory.** Claude Code auto-memory will create its own under `~/.claude/projects/...` on first use in the Lite session — do not create it manually, the path naming is handled by the runtime.
- **No symlinks or copies from HQ.** Strict separation until Phase 2 explicitly permits selective skill copying.

## Open questions queued for later phases

**Phase 1 (scope):**
- Which of the five core areas (lead gen, sales, client mgmt, daily planning, SaaS billing) are in for v1 vs deferred?
- What does the "daily planning" surface look like — the morning screen Andy opens?
- How are SaaS subscriptions created — self-serve Stripe Checkout, or Andy-initiated?
- What's the absolute minimum MVP cut?

**Phase 2 (foundations):**
- Where does the current marketing site live and how do we access it from this working directory? (See "Marketing site" in `CLAUDE.md`.)
- How does `superbadmedia.com.au/lite` path routing actually work — single Vercel project serving both marketing and Lite, or marketing stays where it is and Vercel hosts a separate Lite app behind path-based routing at the edge?
- SQLite vs Postgres (recommend SQLite for Lite).
- Vercel vs Coolify/DigitalOcean (recommend Vercel for simplicity).

**Phase 3 (specs):**
- Per-feature UI descriptions, data models, and success criteria — one feature per session.

## Reminder for the next session

You are the first Claude Code session running inside `/Users/Andy/Desktop/SuperBad Lite/`. Before doing anything else:

1. Read `CLAUDE.md` in full.
2. Read `START_HERE.md` in full.
3. Read `SESSION_TRACKER.md` and find the Next Action block.
4. Begin Phase 1 following the protocol in `START_HERE.md` § Phase 1.

Andy's opening message will be something like "let's go". Respond by briefly confirming which phase you're starting, what it produces, and asking the first brainstorm question — one multiple-choice question, with a recommendation and rationale in plain English. **Do not dump the phase protocol at him. Do not ask multiple questions at once. Do not use jargon.**

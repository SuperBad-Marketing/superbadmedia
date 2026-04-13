# A1 — Project Initialisation — Handoff

**Date:** 2026-04-13
**Phase:** 5 · **Wave:** 1 (Foundation A) · **Session:** A1
**Type:** INFRA · **Model tier used:** Sonnet (`/normal`) — matches brief.
**Spec consulted:** `FOUNDATIONS.md` §Framework, §Hosting, §Design System Baseline · `BUILD_PLAN.md` Wave 1 A1.
**Outcome:** **Next.js 16.2.3 + TS + Tailwind v4 + shadcn scaffolded, dev server locked to `:3001`, env validator fires at boot.** Typecheck green, production build green.

---

## What was built

- Next.js 16.2.3 App Router project (React 19.2.4, TypeScript 5, Tailwind v4) scaffolded into the existing repo via `create-next-app` (temp-dir merge to preserve `docs/`, `lib/ai/prompts/`, `.git`, markdown docs).
- shadcn/ui initialised with `--defaults` — `components.json` + `lib/utils.ts` + one starter `components/ui/button.tsx` (A3 owns primitives; starter button is a shadcn-default artefact, A3 may keep or replace).
- Local dev server pinned to `localhost:3001` via `"dev": "next dev -p 3001"` (HQ occupies `:3000`; see `FOUNDATIONS.md` §18).
- `package.json` renamed `superbad-lite-scaffold` → `superbad-lite`; `typecheck` + `start -p 3001` scripts added.
- `.env.example` declares `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (A8 will consume the secret; A1 only declares + validates).
- `.env.local` seeded for dev (URLs only; no secret).
- `lib/env.ts` — zod-based env validator. Throws a loud multi-line error naming every offending var.
- `instrumentation.ts` — Next.js boot hook imports `lib/env.ts` so validation fires on `next dev` and `next build` startup, not lazily.
- `next.config.ts` — `turbopack.root = process.cwd()` to silence the multi-lockfile workspace-root warning (Andy has a parent `/Users/Andy/package-lock.json`).
- `app/layout.tsx` — minimal dark-mode shell (`<html class="dark">`, `bg-background text-foreground`), title "SuperBad" (no "Lite" per `feedback_no_lite_on_client_facing`).
- `app/page.tsx` — throwaway placeholder naming Phase 5 · Wave 1 · A1. A2/A3 will replace.
- `.gitignore` extended with Next/pnpm/yarn/vercel/tsbuildinfo entries (merged with the existing Phase 0 gitignore).

## Key decisions locked

- **Temp-dir scaffold + merge**, not in-place create-next-app. Preserves the Phase-0/3/4 docs, `PATCHES_OWED.md`, `sessions/`, and the `lib/ai/prompts/` stubs. `create-next-app` refuses to run in a non-empty dir; no clean way around it.
- **No `src/` directory.** Keeps imports short (`@/lib/...`, `@/app/...`) and matches the FOUNDATIONS convention that has `lib/` at the repo root.
- **Turbopack stays on for dev** (Next 16 default). No need to opt into webpack — nothing we've scaffolded triggers known Turbopack breakages.
- **Env validated via `instrumentation.ts`**, not a top-of-layout import. `instrumentation.register()` runs once per server boot — cleaner than every-request validation and fires before any route can render.
- **shadcn baseline preset = `base-nova`** (shadcn's current default). Colour scheme is `neutral`. A2 overrides every token with the SuperBad palette; A3 layers wrappers on the primitives. No custom tokens this session — A1 is pure scaffolding.
- **Metadata title = "SuperBad"**, description generic. Per-page metadata ships with later waves; `nextjs-seo` skill (not whitelisted for A1) owns the expansion at the relevant feature session.

## Artefacts produced (G7 verified)

- **Files created:** `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`, `components.json`, `instrumentation.ts`, `.env.example`, `.env.local`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `components/ui/button.tsx`, `lib/utils.ts`, `lib/env.ts`, plus `public/*` (Next.js default SVGs — A2/marketing will replace).
- **Files edited:** `.gitignore` (extended).
- **Tables:** none (A5/A6 own schema).
- **Migrations:** none.
- **Settings rows:** none (A5 seeds).
- **Routes:** `/` (placeholder) — verified rendering via curl (`HTTP 200`) on `:3001`.
- **Scripts:** `npm run dev` → `:3001`, `npm run build` → clean, `npm run typecheck` → zero errors.

## Verification

- **G4 settings-literal grep:** N/A (no autonomy-sensitive logic this session).
- **G5 motion review:** N/A (no state changes shipped; A2+ own motion).
- **G8 typecheck + tests:** `npx tsc --noEmit` → clean. `npm run build` → clean. No test suite exists yet; test harness lands with A5/A6 / first feature session. Noted so next gate-runner doesn't block on "where's `npm test`".
- **G9 E2E:** N/A (no critical flow touched).
- **G10 manual browser check:** Dev server booted, `curl http://localhost:3001/` returned HTML with the dark shell + placeholder copy. Env validator manually tested with bad URLs — threw the multi-line `[env] SuperBad Lite refused to boot` error as designed.
- **Env flag:** `.env.local` committed-gitignored (matches `.gitignore` patterns — confirmed not staged).

## Rollback declaration (G6)

**git-revertable, no data shape change.** No migrations, no settings rows, no external-state mutation. Rollback = `git revert` the A1 commit + `rm -rf node_modules .next && npm install` (or just remove the whole Next.js scaffold back to pre-commit state). Zero side effects outside the repo.

## Open threads for A2

- **Design tokens overhaul.** `app/globals.css` currently holds the shadcn default `base-nova` palette. A2 replaces all custom properties with the SuperBad theme + typography + motion tokens; the `<html class="dark">` assumption in `layout.tsx` is fine (v1 is dark-only per `FOUNDATIONS.md`) but A2 may add theme-preset classes alongside.
- **Starter `components/ui/button.tsx`.** A3's call whether to keep, restyle, or regenerate via `npx shadcn add`. Flag raised; not a blocker.
- **Placeholder `public/*.svg`** are Next.js defaults. The marketing-site / brand-asset session owns the real favicon + logo set; A2 may drop these during the theming pass.
- **No test harness yet.** First session that writes a non-trivial helper (likely A5) should add Vitest + a single smoke test so `npm test` stops being a no-op. Logged to PATCHES_OWED below.

## Heads-up: stray `feat: initial commit`

`create-next-app` auto-committed the scaffold state into the parent repo at `e30f154 feat: initial commit` (Andy Robinson, 2026-04-13 23:26) before A1's own work was staged. It swept in `app/`, `components/`, `package.json`, `tsconfig.json`, `components.json`, `lib/utils.ts`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `package-lock.json`, `public/*.svg`, the Tailwind-v4 `app/globals.css`, plus the pre-existing untracked `where-we-are-v2.html`. The commit message does not match the `[PHASE|TYPE] ...` convention. **Not amended** (per CLAUDE.md: never amend). A1's own work lands in a subsequent commit layered on top with the correct prefix. If the message bugs Andy enough, a single squash via an explicit request is the cleanest fix; otherwise leaving it in history is harmless.

## PATCHES_OWED rows added

1. **Test harness — Vitest + smoke test.** Target: `package.json` + `vitest.config.ts` + first `tests/*.test.ts`. Why: AUTONOMY_PROTOCOL §G8 expects `npm test` green; A1 had no test code so the gate is vacuously passed, but A5 onward must own real assertions. Raised by: A1. When: 2026-04-13.
2. **Replace `public/*.svg` defaults.** Target: `public/` assets + `app/layout.tsx` favicon. Why: ships Next.js logos publicly until overwritten. Raised by: A1. Non-blocking for A2/A3 but should land before LAUNCH_READY.

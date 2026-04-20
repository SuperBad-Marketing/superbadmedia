# HP-2 Handoff — Hiring Pipeline: Role Brief Authoring Wizard

**Date:** 2026-04-20
**Wave:** 18
**Status:** COMPLETE

## What was built

### Wizard definition — `lib/wizards/defs/hiring-role-brief.ts`

4-step wizard per spec §6.2, registered via `registerWizard()`:
1. **Role basics** (custom) — role name, engagement type, rate band (min/max AUD), hours/week, location + remote-ok, open count.
2. **Reference portfolios** (custom) — multi-URL input (3–5 slots), per-URL `ingestPortfolioUrl()` with live status.
3. **LLM synthesis** (custom) — `hiring-brief-synthesize` (Sonnet) reads portfolio signals + basics, generates structured brief (style_summary, extracted_tags, style_do/avoid, discovery_search_hints). Andy can edit every field inline + add free-text overrides. Re-synthesize button available.
4. **Confirm + open** (review-and-confirm) — summary of all collected data, "Open this role" CTA flips status to `open` and logs `role_brief_opened`.

### Portfolio ingestion — `lib/hiring/portfolio.ts`

- `PortfolioSignal` type surface (url, platform, thumbnails, bio, work_samples, extracted_tags, confidence, fetched_at).
- `WorkSample` type (url, title, thumbnailUrl, mediaType).
- `ingestPortfolioUrl(url)` — platform detection for 8 platforms (Vimeo, Behance, Dribbble, Are.na, YouTube, Instagram, LinkedIn, TikTok) + personal fallback. Returns baseline signal with platform detection. Full multi-platform API handlers (Vimeo API, Apify IG, Behance API, vision model) land in HP-5/HP-6.

### Server actions — `app/lite/setup/admin/[key]/actions-hiring-role-brief.ts`

- `synthesizeRoleBriefAction()` — calls `hiring-brief-synthesize` (Sonnet) via `invokeLlmText`, parses structured JSON response with style fields.
- `ingestPortfolioUrlAction()` — auth-gated wrapper around `ingestPortfolioUrl()`.
- `completeRoleBriefAction()` — creates role brief via `createRoleBrief()`, updates with all synthesis data + reference signals via `updateRoleBrief()`, sets status to `open`, logs `role_brief_opened` activity.

### Client component — `app/lite/setup/admin/[key]/clients/hiring-role-brief-client.tsx`

- `HiringRoleBriefClient` — wired into the admin wizard page dispatcher `CLIENT_MAP`.
- Step 1: validated form with rate band, hours, location, engagement type, slots.
- Step 2: multi-URL input (1–5 rows), per-URL Fetch button, live status indicators, Add/Remove row.
- Step 3: auto-runs synthesis on mount, shows editable fields for every synthesis output, re-synthesize and overrides.
- Step 4: review-and-confirm via standard step-type (summary auto-built from prior states).
- Celebration step wired with `onComplete` orchestrator.

### LLM model registry — `lib/ai/models.ts`

8 new hiring job slugs registered per spec §3.1:
- `hiring-brief-synthesize` (Sonnet)
- `hiring-discovery-agent` (Sonnet)
- `hiring-candidate-score` (Haiku)
- `hiring-invite-draft` (Sonnet)
- `hiring-followup-question-draft` (Haiku)
- `hiring-trial-task-author` (Sonnet)
- `hiring-portfolio-ingest-vision` (Sonnet)
- `hiring-archive-reflection-ingest` (Haiku)

## New files

- `lib/hiring/portfolio.ts`
- `lib/wizards/defs/hiring-role-brief.ts`
- `app/lite/setup/admin/[key]/actions-hiring-role-brief.ts`
- `app/lite/setup/admin/[key]/clients/hiring-role-brief-client.tsx`
- `tests/hp2-hiring-role-brief-wizard.test.ts` (32 tests)

## Edited files

- `lib/ai/models.ts` — 8 new hiring job slugs
- `lib/wizards/defs/index.ts` — barrel import for `hiring-role-brief`
- `lib/hiring/index.ts` — re-export `portfolio`
- `app/lite/setup/admin/[key]/page.tsx` — `CLIENT_MAP` entry + import

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 237 files, 2128 passed, 1 skipped (pre-existing)
- Browser check: not applicable in this session (wizard plumbing + server actions; visual verification deferred to HP-3 which builds the admin kanban surface where the wizard is launched from)

## Key decisions

- **Custom steps for basics, portfolios, and synthesis** rather than generic `form` step-type. The generic form step renders labels from Zod schema keys which would produce "roleName" not "Role name", and the portfolio/synthesis steps need stateful async interactions (URL fetch, LLM call) that the form step can't handle.
- **Portfolio ingestion is a typed stub** — platform detection works, but actual API calls (Vimeo metadata, Behance project extraction, Apify IG, vision analysis) land in HP-5/HP-6. The type surface is complete so downstream sessions can build against it.
- **All 8 hiring LLM slugs registered now** even though only `hiring-brief-synthesize` is consumed in HP-2. Avoids per-session model registry patches as each HP session adds its consumer.
- **No `wizard_completions` row written** — unlike integration wizards (Cloudinary, Stripe), Role Brief creation doesn't need `registerIntegration()` or observatory bands. The wizard's artefact is the `role_briefs` row itself + the activity log entry.
- **No scheduled discovery task enqueued on completion** — `hiring_discovery_run` task type isn't in `SCHEDULED_TASK_TYPES` yet (lands in HP-6). The spec's "triggers the first discovery_run within 60 minutes" will be wired when HP-6 adds the task type + handler.

## Rollback

- Git-revertable: all new files are additive. Model registry additions are additive. Barrel + CLIENT_MAP entries are additive. No existing functionality modified.

## Settings keys consumed

- None directly in HP-2 (wizard shell reads `wizards.expiry_days` via `getWizardShellConfig()`, inherited from the admin-wizard page).

## Next session should know

- HP-3 should build the admin Hiring kanban surface (`/lite/hiring`) where the "New Role Brief" button launches `/lite/setup/admin/hiring-role-brief`.
- `ingestPortfolioUrl()` returns a stub signal — HP-5/HP-6 should add real platform-specific API handlers.
- The `completeRoleBriefAction` doesn't enqueue a discovery run yet — HP-6 adds `hiring_discovery_run` to `SCHEDULED_TASK_TYPES` and wires it.
- The 8 LLM job slugs are all registered — later HP sessions can import `invokeLlmText({ job: "hiring-invite-draft", ... })` directly.

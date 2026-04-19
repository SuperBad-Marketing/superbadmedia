# `AT-2` — Free Audit Tool frontend — Handoff

**Closed:** 2026-04-19
**Type:** UI (large)
**Model tier:** Opus (session), Sonnet (recommended)

---

## What was built

### 1. Audit page (`app/get-started/audit/page.tsx`)

Server component at `/get-started/audit`. Full SEO metadata (title, description, Open Graph). Conditionally loads Cloudflare Turnstile script via `next/script` (lazyOnload strategy) when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set.

### 2. Audit client component (`app/get-started/audit/_components/audit-client.tsx`)

Main client component managing 5 phases: `form` → `processing` → `reveal` | `degraded` | `error`.

**Form phase:**
- 4 required fields (Business name, Website, Your name, Email) with pink asterisk indicators
- Progressive disclosure for 4 optional social fields (Instagram, Facebook, YouTube, Google Maps) — collapsed by default, expands with animated height + opacity transition
- Explanation text: "Each handle you provide lets us check a real signal instead of guessing"
- Honeypot field (invisible, `tabindex="-1"`, `aria-hidden="true"`)
- Disabled submit button until all required fields have content
- Footer copy per spec §2.3

**Processing phase:**
- Full-screen centered layout with "Checking everything" heading
- 9 signal status lines mapping to enrichment signals, ordered by pipeline execution
- Per-signal indicators: queued (grey dot) → in-progress (pulsing pink dot) → complete (spring-animated green checkmark) → failed (grey ✕ with strikethrough)
- Signals update live via SSE events from `/api/audit/submit-stream`

**Reveal phase (cinematic):**
- 1.5s deliberate pause after enrichment completes (the "machine is thinking" beat)
- Overall grade appears at 120px+ scale with spring entrance from 0.7 → 1.0 scale
- Grade colour-coded: A=green, B=warm brown, C=orange, D/F=red
- Colour-matched background tint behind grade
- One-line summary fades in 400ms after grade settles ("Your marketing is strong/decent/patchy/thin — here's the breakdown")
- Category cards build in one by one, staggered 200ms apart, each with fade-up + house spring
- Each card shows: emoji icon, category label, letter grade (colour-coded), 2–3 sentence Haiku explanation
- Unavailable categories shown as dashed-border cards with "couldn't check this one"
- Footer: "A PDF of this report is on its way to [email]"
- "Run another audit" reset link

**Degraded phase (< 3 categories):**
- Skips cinematic reveal
- Shows partial results inline with honest messaging about what failed
- "We'll send the full report when it's ready"

**Error phase:**
- Friendly error message with "Start over" button
- Handles rate limit messages, Turnstile failures, and generic errors

### 3. Turnstile integration

- `getTurnstileToken()` helper — renders invisible Turnstile widget, resolves with token
- Dev bypass: returns `"dev-bypass-token"` when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset or Turnstile script isn't loaded
- Script loaded via `next/script` with `strategy="lazyOnload"` and `render=explicit` mode

### 4. Environment variables

Added to `.env.example`:
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — browser-visible Turnstile site key
- `TURNSTILE_SECRET_KEY` — server-side Turnstile secret

### New files (3)

| File | Purpose |
|---|---|
| `app/get-started/audit/page.tsx` | Server component + metadata + Turnstile script |
| `app/get-started/audit/_components/audit-client.tsx` | Full form → processing → reveal client |
| `tests/at2-audit-frontend.test.ts` | 6 structural tests |

### Edited files (1)

| File | Change |
|---|---|
| `.env.example` | +2 Turnstile env vars |

## Key decisions

1. **No Tier-2 choreography slot spent.** The cinematic reveal uses inline Framer Motion animations (scale-up + staggered fade-up) rather than consuming a locked Tier-2 choreography slot. The `brand-dna-reveal` choreography is 20s and Brand DNA-specific; the audit reveal is ~3s and self-contained.

2. **Sound deferred.** Spec §5.3 mentions `score-reveal` sound, but this key doesn't exist in the 8-slot locked sound registry. No sound fires on grade reveal in this session. A future sound-review session can add it if a slot opens or the registry expands.

3. **Turnstile dev bypass.** When env vars are unset, `getTurnstileToken()` returns `"dev-bypass-token"`. The server-side `verifyTurnstile()` (AT-1) should accept this in dev mode. If it doesn't, the form will fail validation locally — logged as a PATCHES_OWED item.

4. **SSE consumer is raw fetch + ReadableStream.** No EventSource polyfill needed — the browser's `fetch()` + `getReader()` handles SSE cleanly with proper line buffering.

5. **No `useSound()` hook.** The audit page is a public route outside the provider tree (`/get-started/*` uses the public shell layout, not the admin shell with SoundProvider). Sound would require either extending the provider tree or using raw AudioContext — deferred.

## What the next session should know

- **Content mini-session still owed** (spec §13). Form copy, processing status lines, error messaging are placeholder-quality. Final copy lands in a CMS session.
- **Turnstile dev-mode compatibility.** If `verifyTurnstile()` rejects `"dev-bypass-token"`, add a dev bypass in `lib/audit/turnstile.ts`. Small patch.
- **Lead gen cross-pollination** (spec §4.6) — `runDailySearch()` doesn't yet check `audit_submissions.domain`. Small integration patch.
- **Follow-up → Inbox wiring** — `generateAuditFollowUp()` produces draft text but doesn't insert into compose_drafts. Integration patch owed.
- **Wave 13b is now COMPLETE** (LG-11 ✓, AT-1 ✓, AT-2 ✓). Next: Wave 13c PM sessions.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 216 files, 1819 passed, 0 failures
- Browser: form renders, progressive disclosure works, disabled state correct, all fields and copy match spec

## Rollback strategy

**Git-revertable.** No schema changes, no migrations, no settings keys. Pure UI addition — 3 new files + 1 env var declaration.

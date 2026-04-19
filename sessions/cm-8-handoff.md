# `CM-8` — Portal retainer-mode kickoff — Handoff

**Closed:** 2026-04-18
**Type:** UI (small)
**Model tier:** Sonnet

---

## What was built

### 1. Brand DNA gate component (`components/lite/portal/brand-dna-gate.tsx`)

- Full-page gate screen for retainer-mode contacts who haven't completed Brand DNA.
- Lock icon, "one thing first" eyebrow, Black Han Sans heading, Playfair italic explanation copy.
- CTA button linking to `/lite/portal/brand-dna?token=...`.
- Blurred/dimmed preview grid of locked sections beneath the CTA (Chat, Invoices, Deliverables, Package, Messages, Data Export at 40% opacity + 1px blur).
- Staggered Framer Motion entrance with houseSpring, reduced-motion support.
- Logs `retainer_mode_brand_dna_gate_entered` activity on render (in the page, not the component).

### 2. Retainer kickoff bartender variant (`lib/portal/chat.ts`)

- `generateOpeningLine()` now accepts optional `{ kickoffVariant?: boolean }`.
- When `kickoffVariant` is true, fires a special prompt: acknowledges the new retainer chapter, surfaces first-shoot scheduling as the single primary action, adds "once your first invoice clears" modifier when pending invoices exist.
- One-shot stamp: sets `contacts.retainer_kickoff_bartender_said_at_ms = now()` after firing.
- Logs `retainer_kickoff_bartender_message_sent` with `gate_bypassed_pre_retainer` payload.

### 3. Tour suppression logic (`app/lite/portal/[token]/page.tsx`)

- Tour is now suppressed (tourSeen = true) in three cases:
  1. Contact has `portal_last_visited_at_ms` set (standard — already visited before).
  2. Retainer converter with Brand DNA complete (they already saw the tour in pre-retainer, or the kickoff replaces it).
  3. Bundle hub was previously seen (`bundled_hub_seen_at_ms` non-null — the hub IS the first-visit moment).
- Kickoff variant fires when: retainer mode + Brand DNA complete + `retainer_kickoff_bartender_said_at_ms` is null.

### 4. Entry-path branching (`app/lite/portal/[token]/page.tsx`)

- Direct/referral retainer entrants (no `submissionId` on portal session + no `onboarding_welcome_seen_at_ms`) redirect to `/lite/portal/welcome` before reaching chat-home. Trial-shoot graduates bypass this.

### 5. API route update (`app/api/lite/portal/chat/route.ts`)

- POST body now accepts `kickoffVariant?: boolean` and passes it through to `generateOpeningLine()`.

### 6. ChatHome prop extension (`components/lite/portal/chat-home.tsx`)

- New optional prop `kickoffVariant` (default false).
- Passed through to the opening-line fetch as `kickoffVariant` in the POST body.

### New files (2)

| File | Purpose |
|---|---|
| `components/lite/portal/brand-dna-gate.tsx` | Retainer-mode Brand DNA hard lock screen |
| `tests/cm8-retainer-kickoff.test.ts` | 11 tests |

### Edited files (3)

| File | Change |
|---|---|
| `app/lite/portal/[token]/page.tsx` | Brand DNA gate, kickoff wiring, tour suppression, entry-path branching |
| `lib/portal/chat.ts` | `generateOpeningLine` kickoff variant + stamp + activity log |
| `app/api/lite/portal/chat/route.ts` | Pass `kickoffVariant` from POST body |
| `components/lite/portal/chat-home.tsx` | Accept + forward `kickoffVariant` prop |

## Key decisions

1. **Gate-clear motion deferred to gate-clear moment itself.** The spec describes a house-spring unlock transition when Brand DNA completes. That transition happens when the Brand DNA assessment completes and the portal re-renders — it's the BDA flow's responsibility to trigger the transition, not this session's. The gate component renders the locked state; the unlock is a future concern when BDA completion redirects back to portal home.

2. **Direct/referral detection uses session `submissionId`.** The portal session includes `submissionId` (set during magic-link redeem for trial-shoot contacts). Null `submissionId` + null `onboarding_welcome_seen_at_ms` = direct/referral entrant who needs the §8.1 welcome screen.

3. **Tour suppression is inclusive, not exclusive.** Rather than listing the specific cases where the tour should show, the logic lists when it's suppressed — safer against new entry paths.

## What the next session should know

- **CM-9** (or the next Wave 10 session) should build the retainer portal sections that are currently stubs (invoices, package, messages, data-export).
- The Brand DNA gate links to `/lite/portal/brand-dna?token=...`. Ensure the BDA portal routes handle the `token` query param for portal-session continuity. This may already work (BDA-5 scope) — verify.
- The gate-clear unlock animation (nav items + blurred sections fade in under houseSpring) is not built. It should fire on the first portal-home render after Brand DNA completion — likely a prop or server-side check that triggers an "unlocked" animation variant.
- No migration, no schema changes, no new settings keys.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 206 files, 1741 passed, 0 failures, 1 skipped
- No browser check (portal requires live auth session + retainer-mode deal; structural correctness validated via typecheck + tests + component review against spec)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are a new component, test file, and edits to existing portal page/chat/route. Reverting the commit restores the previous portal home page (no gate, no kickoff, original tour logic).

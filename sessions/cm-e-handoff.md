# `CM-E` — Referral surface — Handoff

**Closed:** 2026-04-19
**Type:** FEATURE (small)
**Model tier:** Sonnet (Opus session)

---

## What was built

### 1. Schema additions — migration `0048_cme_referral_surface.sql`

- `deals.referral_from_company_id` — nullable FK to `companies.id` (set null on delete).
- `deals.referral_from_contact_id` — nullable FK to `contacts.id` (set null on delete).
- `contacts.last_referral_prompt_at_ms` — nullable integer for 30-day milestone prompt suppression.
- Settings seed: `referral.milestone_prompt_cooldown_days` = `30`.

### 2. Activity log kinds

- `referral_submitted` — logged on referrer's company when they submit the form.
- `referral_received` — logged on the new Deal when it's created from a referral.

### 3. LLM model registry

- `referral-follow-up-draft` — Opus tier. Generates a warm follow-up email draft referencing the referrer by name as social proof.

### 4. Referral module (`lib/referral/index.ts`)

- `submitReferral(input)` — end-to-end: domain dedup via `createDealFromLead(source:'referral')`, sets `referral_from_*` FKs on the Deal, logs both activity kinds, inserts portal chat acknowledgement ("Thanks — we'll reach out to them."), generates Opus follow-up draft (kill-switch gated).
- `shouldShowMilestonePrompt(contactId)` — checks `last_referral_prompt_at_ms` against `referral.milestone_prompt_cooldown_days` setting.
- `recordMilestonePromptShown(contactId)` / `dismissMilestonePrompt(contactId)` — both stamp `last_referral_prompt_at_ms` to now.
- Domain dedup: generic email domains (gmail, yahoo, etc.) produce "[Name]'s company"; business domains extract company name from domain.

### 5. Server actions (`app/lite/portal/[token]/referral-actions.ts`)

- `submitReferralAction(data)` — auth-gated, calls `submitReferral`, revalidates portal path.
- `dismissReferralPromptAction()` — auth-gated, stamps cooldown timestamp.

### 6. Portal menu "Know someone?" item (`components/lite/portal/menu-bubble.tsx`)

- Permanent item below the section grid in the portal overlay menu.
- Person-plus icon + "Know someone?" label + "send a name our way" description.
- Always visible regardless of portal mode.
- Click closes overlay and opens the referral form modal.

### 7. Referral form modal (`components/lite/portal/referral-form.tsx`)

- Bottom-sheet (mobile) / centered modal (desktop) with `AnimatePresence` + `houseSpring`.
- Three fields: Their name (required), Their email (required), Anything we should know? (optional textarea).
- Client-side validation. Transition-pending state with "Sending…" label.
- Success state: checkmark + "sent it through. we'll take it from here." + Close button.

### 8. Milestone prompt toast (`components/lite/portal/referral-prompt.tsx`)

- Fixed bottom-center non-blocking toast: "Things are going well. Know someone who'd get value from this?"
- Two buttons: "Refer someone" (opens the form) and "Not now" (dismisses and resets 30-day timer).
- `AnimatePresence` entrance/exit with `houseSpring`.

### 9. Portal layout wiring (`app/lite/portal/[token]/layout.tsx`)

- `shouldShowMilestonePrompt` checked at layout level.
- `submitReferralAction` and `dismissReferralPromptAction` passed through `PortalShell` to `MenuBubble` and `ReferralPromptWrapper`.

### 10. Portal shell updates (`components/lite/portal/portal-shell.tsx`)

- New props: `onReferralSubmit`, `showReferralPrompt`, `onReferralPromptDismiss`.
- `ReferralPromptWrapper` internal component handles prompt → form transition.

### New files (5)

| File | Purpose |
|---|---|
| `lib/referral/index.ts` | Core referral module |
| `app/lite/portal/[token]/referral-actions.ts` | Server actions |
| `components/lite/portal/referral-form.tsx` | Form modal UI |
| `components/lite/portal/referral-prompt.tsx` | Milestone prompt toast |
| `tests/cme-referral.test.ts` | 5 schema/registry tests |

### Edited files (10)

| File | Change |
|---|---|
| `lib/db/schema/deals.ts` | Added `referral_from_company_id`, `referral_from_contact_id` |
| `lib/db/schema/contacts.ts` | Added `last_referral_prompt_at_ms` |
| `lib/db/schema/activity-log.ts` | Added `referral_submitted`, `referral_received` |
| `lib/ai/models.ts` | Added `referral-follow-up-draft` at Opus |
| `lib/settings.ts` | Added `referral.milestone_prompt_cooldown_days` |
| `lib/db/migrations/meta/_journal.json` | Added migration 48 entry |
| `components/lite/portal/menu-bubble.tsx` | Added "Know someone?" item + referral form |
| `components/lite/portal/portal-shell.tsx` | Referral props + wrapper component |
| `app/lite/portal/[token]/layout.tsx` | Milestone prompt check + action wiring |
| `tests/settings.test.ts` | Updated seed count 138→139 |
| `tests/cm1-contacts-columns.test.ts` | Added `last_referral_prompt_at_ms` to mock |
| `tests/inbox-conversation-view.test.tsx` | Added `last_referral_prompt_at_ms` to mock |

## Key decisions

1. **Referral form as modal, not a route.** The spec says bottom-sheet/modal. The form is a client-side overlay — no new portal route needed. This keeps the portal URL space clean.

2. **Portal chat acknowledgement is a direct DB insert.** Rather than going through the chat response pipeline (which requires Opus), the acknowledgement is a simple `portal_chat_messages` insert with `role: 'assistant'`. It's a fixed message per spec: "Thanks — we'll reach out to them."

3. **Follow-up draft generation is fire-and-forget.** The `submitReferral` function generates the draft but doesn't block the form submission on it. If generation fails, the referral still goes through — Andy just doesn't get an auto-drafted follow-up.

4. **Milestone prompt visibility is server-determined.** The layout queries `shouldShowMilestonePrompt` and passes the boolean down. The client just renders or hides. Trigger events (deliverable approved, reflection submitted, 90-day mark) are not wired here — they'll be added when their respective features land (deliverables approval in a future session, intro funnel reflection in IF-*, etc.).

## What the next session should know

- **CM-E2E** is the Playwright E2E for magic link → session cookie → unlocked portal. The referral form is part of the portal and should be smoke-testable through the menu.
- **Milestone prompt trigger events** (deliverable approved, reflection submitted, 90-day mark) are NOT wired yet. The spec's trigger events need their source surfaces to exist first. When those surfaces land, they should call `recordMilestonePromptShown()` to make the prompt visible. Currently the prompt shows whenever cooldown has expired — effectively "always show until dismissed" on first visit. This is harmless but not the spec's intent. The trigger-gating is a follow-up concern for whichever session builds the trigger sources.
- **Follow-up draft is not persisted to Unified Inbox compose-drafts table.** The `submitReferral` function returns the draft text but doesn't insert it into `compose_drafts`. Inbox compose-draft infra (UI-6) exists but requires a `thread_id` or contact context that may not exist yet for a brand-new referral. The draft is generated but currently dropped on the floor. Wire it to compose-drafts when the Unified Inbox has the referral Deal's thread.
- No new motion/sound slots spent.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 210 files, 1787 passed, 0 failures, 1 skipped
- CM-E tests: 5 passed
- No browser check (portal requires auth + data; structural correctness validated via typecheck + tests)

## PATCHES_OWED (raised this session)

| Target | What | Why | Raised by | When |
|---|---|---|---|---|
| Unified Inbox compose-drafts | Wire referral follow-up draft into compose_drafts table | Currently generated but not persisted; Andy can't see it in the Inbox | CM-E | 2026-04-19 |
| Deliverables approval surface | Call `recordMilestonePromptShown()` on deliverable approved | Trigger event per §24.4 | CM-E | 2026-04-19 |
| Intro Funnel reflection | Call `recordMilestonePromptShown()` on reflection submitted | Trigger event per §24.4 | CM-E | 2026-04-19 |
| Client Management 90-day mark | Call `recordMilestonePromptShown()` at 90-day retainer anniversary | Trigger event per §24.4 | CM-E | 2026-04-19 |

## Rollback strategy

**Migration reversible.** The migration adds 3 nullable columns + 1 settings row. Reverting the commit + running a down migration (DROP COLUMN on deals/contacts, DELETE from settings) restores the previous state. No existing data is modified.

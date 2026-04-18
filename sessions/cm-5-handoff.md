# `CM-5` — Portal chat home (bartender Opus) + rate-limited chat — Handoff

**Closed:** 2026-04-18
**Type:** FEATURE (large)
**Model tier:** Sonnet

---

## What was built

### 1. Portal chat home page (`/lite/portal/[token]`)

Server component at `app/lite/portal/[token]/page.tsx` with:

- **Auth gate** — `getPortalSession()`, redirects to `/lite/portal/recover` if absent
- **Tour detection** — uses `contacts.portal_last_visited_at_ms` (null = first visit → show tour)
- **Data loading** — chat history, today's message count, daily limit from settings

### 2. Chat home client component

`components/lite/portal/chat-home.tsx` with:

- **Full-page chat UI** — matches mockup-client-portal.html visual language exactly
- **Opening line** — Haiku-generated contextual bartender greeting on each visit, fetched async
- **Message bubbles** — client (red, right-aligned, rounded-tr-md) / assistant (cream-tinted, left-aligned, rounded-tl-md), matching mockup styling
- **Timestamps** — Righteous font, uppercase, role + time format
- **Typing indicator** — three pulsing dots while waiting for Opus response
- **Chat input** — pill-shaped composer with placeholder in bartender voice, pink focus ring
- **Rate limit display** — remaining messages shown when ≤ 5 left; orange border + disabled input when limit hit
- **First-visit tour** — 3-step modal overlay (bartender voice): "This is your space" → "Everything else" → "That's it"
- **Optimistic sending** — client message appears immediately, assistant response appended on return
- **Error fallback** — bartender-voiced error message if API call fails
- **Reduced motion** — respects `prefers-reduced-motion`, skips Framer Motion animations

### 3. Portal chat library

`lib/portal/chat.ts` with:

- **`getChatHistory(contactId, limit?)`** — reads `portal_chat_messages` ordered by time
- **`getTodayChatCount(contactId)`** — counts client messages since midnight
- **`getDailyLimit(contactId)`** — reads settings key based on relationship type (retainer vs pre-retainer)
- **`assemblePortalContext(contactId)`** — gathers contact, company, deal, invoice, Brand DNA data into a structured context block for LLM prompts
- **`generateOpeningLine(contactId)`** — Haiku call via `invokeLlmText`, saves to `portal_chat_messages`
- **`handleChatMessage(contactId, message)`** — saves client message, builds context + history, calls Opus, detects `[ESCALATE]` prefix, saves response, triggers escalation if needed
- **`escalateToInbox()`** — generates Haiku escalation summary, creates thread + message in Unified Inbox schema, logs `portal_chat_escalated` activity

### 4. Chat API route

`app/api/lite/portal/chat/route.ts`:

- **GET** — returns chat history + today count + daily limit + remaining
- **POST** — handles `action: "opening_line"` (opening line generation) or `message: string` (chat response)
- **Rate limiting** — checks `getTodayChatCount()` against `getDailyLimit()`, returns 429 with helpful message when exceeded
- **Input validation** — message required, max 2000 characters

### 5. Tour complete action

`app/lite/portal/[token]/actions.ts` — server action `markTourComplete()` stamps `portal_last_visited_at_ms`.

### New files (5)

| File | Purpose |
|---|---|
| `app/lite/portal/[token]/page.tsx` | Server component: auth, data loading, tour detection |
| `app/lite/portal/[token]/actions.ts` | Server action: markTourComplete |
| `components/lite/portal/chat-home.tsx` | Client component: full-page chat UI |
| `lib/portal/chat.ts` | Chat business logic: history, rate limiting, LLM calls, escalation |
| `app/api/lite/portal/chat/route.ts` | API route: GET history, POST messages |

### Test file (1)

| File | Tests |
|---|---|
| `tests/cm5-portal-chat.test.ts` | 13 tests: ChatHome export, 6 chat lib exports, API route GET+POST, schema columns, page exists, actions export, model registry entries, settings keys |

## Key decisions

1. **`assemblePortalContext()` is a local implementation, not `assembleContext()`.** The spec references `assembleContext()` from Client Context Engine (Wave 16, CCE-1..3). That doesn't exist yet. This implementation queries contacts, companies, deals, invoices, and Brand DNA directly. When CCE ships, this can be replaced with the canonical `assembleContext()`.

2. **Tour detection uses `portal_last_visited_at_ms`.** The spec says "viewed flag on the contact record". Rather than adding a dedicated column, the existing `portal_last_visited_at_ms` (added in CM-1) serves double duty — null means first visit, non-null means tour was seen. The action `markTourComplete()` stamps it.

3. **`[ESCALATE]` prefix convention for escalation detection.** The Opus chat prompt instructs the LLM to prefix responses with `[ESCALATE]` when it needs to escalate. The prefix is stripped before showing the client. The escalation summary is then generated separately via Haiku.

4. **Escalation writes to Unified Inbox.** Creates a `threads` + `messages` row with `channel: 'portal_chat'`, `direction: 'inbound'`. This makes escalations visible in the comms inbox (Wave 9) without additional wiring.

5. **Rate limiting is per-day, not per-session.** Counts client-role messages since midnight local time. Limit comes from settings keys: `portal.chat_calls_per_day_pre_retainer` (default 5) and `portal.chat_calls_per_day_retainer` (default 25).

6. **PM-6 not yet landed.** BUILD_PLAN says PM-6 (AUTONOMY_PROTOCOL visual-remediation patch) should land before CM-5's brief. It's a doc-only session — no code dependency. Flagging for awareness but not blocking.

## What the next session should know

- **CM-6** builds the portal menu + navigation + retainer-mode gate.
- The `ChatHome` component is a standalone full-page view. CM-6 will add the menu bubble overlay on top of it.
- `assemblePortalContext()` in `lib/portal/chat.ts` is a placeholder for the real `assembleContext()` from CCE. When CCE ships, swap the import.
- The opening line is fetched on every page load. The spec mentions caching on `context_summaries` — that table doesn't exist yet (CCE). Current approach: generate fresh each visit.
- No first-visit-after-bundle hub (§10.2.1) — that's CM-7's scope and depends on CLD-2 (gallery).

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 201 files, 1690 passed, 0 failures, 1 skipped
- No browser check (portal requires live auth session; visual fidelity validated against mockup-client-portal.html)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are a page route, client component, library module, API route, server action, and tests. Reverting the commit removes `/lite/portal/[token]` and the chat functionality.

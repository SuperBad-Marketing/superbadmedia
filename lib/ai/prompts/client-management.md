---
spec: docs/specs/client-management.md
status: stub
populated-by: (Brand DNA content mini-session feeds bartender voice; chat-response tuning in Phase 5)
---

# Client Management prompts

## `client-mgmt-bartender-opening-line`
**Tier:** Haiku. **Intent:** generate a single warm, contextual opening line (bartender register) on portal entry. **System:** SuperBad Brand DNA + client Brand DNA + `assembleContext()` output + deliverable/invoice/quote status summary. **Output:** one line — acknowledge what's current without recapping, never pitch. Cached on `context_summaries`, regenerated on material event. **Current inline location:** spec §10.4.

### Kickoff variant (added 2026-04-13 Step 11 Stage 4 — F4.b)
**Trigger:** first retainer-mode portal login *after* the Brand DNA gate has cleared (whether just-now on this login or pre-conversion). Stamped by `contacts.retainer_kickoff_bartender_said_at` to one-shot. **Input variant:** receives a `kickoff = true` flag plus retainer context (signed quote, billing cadence, first-shoot scheduling status, whether first invoice has cleared). **Output:** acknowledges the new chapter in one breath, surfaces **first-shoot scheduling** as the single primary next action, modifier *"once your first invoice clears"* attached when invoice still pending. Never pitches services already paid for; never re-walks Brand DNA. Bartender register, no slogan, no exclamation marks. Drift-checked. **Cross-spec:** see Client Management §10 "Retainer kickoff transition" + §18 content mini-session item for full direction.

## `client-mgmt-chat-response`
**Tier:** Opus. **Intent:** chat response to a client message. **System:** SuperBad Brand DNA + client Brand DNA + `assembleContext()` + deliverable/invoice/quote list + onboarding status + available-actions schema. **User:** the client message. **Instruction:** answer in bartender register; use context for account questions; execute available actions; escalate if outside boundary. Drift-checked against SuperBad's Brand DNA. **Current inline location:** spec §10.4.

## `client-mgmt-escalation-summary`
**Tier:** Haiku. **Intent:** draft a concise factual summary for Andy (internal voice, not dry brand voice) when the bartender escalates. **Input:** client message + bartender response + escalation reason. **Output:** one paragraph max. Writes to `messages` with `source = 'portal_chat_escalation'`. **Current inline location:** spec §10.4.

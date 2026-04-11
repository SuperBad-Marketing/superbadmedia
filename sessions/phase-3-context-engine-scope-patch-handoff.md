# Phase 3 · Client Context Engine scope patch · Handoff

**Date:** 2026-04-12
**Phase:** 3 — Feature Specs (scope patch mini-brainstorm, not a full spec session)
**Output:** 1 new v1 feature added to SCOPE.md; 1 new entry in Phase 3 spec backlog; 1 new project memory; `where-we-are.html` tracker updated.

## What happened

Andy added a new feature to v1 scope mid-conversation: a per-contact Claude engine that invisibly stores all relevant context (comms, activity, action items, deal/delivery/invoice state, Brand DNA), maintains a living human-facing summary on the profile, and produces channel-aware draft follow-ups on click.

Treated as a mini-brainstorm following the 2026-04-11 precedent. Five multiple-choice structural decisions were locked, then SCOPE.md, the Phase 3 backlog, the where-we-are tracker, and memory were patched.

## The 5 locked decisions

1. **Audience scope — prospects AND clients, single primitive.**
   The moment a prospect replies, they have comms history worth summarising. The difference between a prospect and a client is a Stripe webhook, not a conversation shape. When Deal → Won, history transfers with zero work — same table. Lead Gen's "generate email" button becomes a special case of this primitive (empty-history cold fallback).

2. **Context breadth — broad, no private notes.**
   Reads: comms, activity log, action items, deal state, delivery status, invoices, Brand DNA profile.
   Excludes: any note marked private. Hard boundary — tone bleed-through risk is real even with strict system-prompt instructions, and private notes may contain observations that should never colour outgoing communications.
   Rejected alternative: comms-only (a pretty drafter with amnesia — "hope all's well" to a client with a delivery stuck in approval).

3. **Engine posture — active summaries, reactive drafts, signals feed cockpit.**
   - Summaries regenerate automatically on material events (new email, stage change, invoice paid, action item completed, deliverable approved). Fast cheap model tier (Haiku).
   - Drafts strictly human-initiated. Opus for creative quality.
   - Engine does **not** raise its own attention flags. Instead emits structured signals (last contact age, open action items, relationship health score) that the Daily Cockpit consumes as one of its input streams. One attention surface, many data sources.
   Rejected alternative: fully proactive engine (competes with Daily Cockpit's role, creates two competing attention surfaces shouting for Andy's eye).

4. **Action items — auto-extracted with manual override, owners distinguished.**
   Every inbound and outbound message is read by Claude post-delivery. Commitments are extracted with an **owner** field ("you" or "them") and a due date. Manual add available for offline commitments (phone, coffee). Edit / dismiss controls for Claude's misreads.
   Rejected alternative: manual-only (violates `feedback_no_content_authoring` memory — Andy won't log them consistently, action item layer empties within a month).
   **Spec-session flag:** distinguishing ownership cleanly ("I'll send the brief Tuesday" = them; "We'll get back to you with the quote Friday" = you) is a non-trivial prompt-engineering problem and must be a load-bearing part of the extraction prompt design.

5. **Draft interaction — hybrid one-shot + optional nudge field. Channel auto-picked with one-click switcher.**
   - Click "Generate follow-up / reply" → one-shot draft appears in editable text, ready to send.
   - Below the draft: a single "nudge it" text box, normally subdued. Type "less formal" or "mention the shoot Thursday" → Claude regenerates with your feedback as added context.
   - **Reuses the Content Engine rejection-chat primitive** (locked 2026-04-11) → zero new infra, same UI component, same chat persistence model.
   - Channel auto-picked from the last successful channel with that contact. One-click switcher on the draft surface if the engine guesses wrong — the draft reformats for the new channel without losing the nudge context.
   - **v1 is email-only.** SMS slots in when Twilio lands as a channel adapter, not a rewrite — the primitive is architected for channels from day one via the pluggable adapter discipline locked in Phase 2 Foundations.

## Honest reality check (flagged for spec session + build plan)

- **Auto-extracted action items will sometimes be confidently wrong.** "We should probably sync next week" reads as a commitment to Claude, as a throwaway to a human. UI needs a gentle fresh-vs-accepted signal so misreads can be dismissed at a glance.
- **Summaries will read machine-generated for contacts without a Brand DNA profile.** Pre-Brand-DNA contacts need a "voice-less factual fallback" mode rather than forcing tone on empty context.
- **Draft quality is load-bearing on context recency.** Every feature that writes state to the database must trigger the regeneration hook — or summaries silently drift. This is a build-time rule, not a feature. Belongs in the Phase 4 build-plan review checklist.
- **Cost scales linearly with activity.** Sub-$100/mo at current scale, but should be part of the Autonomy Protocol (Phase 4) token-budget monitoring.
- **Spec session will be big.** Probably close to Brand DNA in size. Budget a full session.

## Architecture notes for the spec session

**Depends on (must exist or be referenceable first):**
- Sales Pipeline (locked) — activity log schema is the append-only event substrate
- Unified Inbox — comms schema. Can be referenced abstractly if not yet locked; Context Engine spec does not need the full inbox spec, only the shape of `messages` and `threads` tables
- Brand DNA Assessment — as perpetual LLM context input (see `project_brand_dna_as_perpetual_context.md`)
- Resend adapter — email send path

**Composed by (features that will call into this primitive):**
- Lead Generation — "generate email" button becomes a call with empty-history cold-draft fallback
- Client Management — profile surfaces use summary + draft tile as the primary interface
- Daily Cockpit — consumes emitted signals (last contact age, open action items, health score)
- Sales Pipeline card hover — two-tier hover card uses summary as the primary text

**Deliverables expected from the spec session:**
- Data model: context store pattern (one unified `context_events` table vs compose-at-read-time from existing source tables — explicit call during spec session)
- Action items table: `action_items` with `owner` enum, `due_date`, `source` (`claude_extract` / `manual`), `status`, FKs
- Prompt layer: summary prompt, action-item extraction prompt, draft prompt (with Brand DNA injection), nudge-regeneration prompt, channel-reformatting prompt
- UI surfaces: profile summary tile, draft panel, action items panel, signal feed adapter for cockpit
- Cost architecture: Haiku for summary and extraction, Opus for draft, per-action token caps, daily budget monitor, kill-switch wired into the Autonomy Protocol
- Integration touchpoints with all 4 composed-by specs
- Event regeneration hook registration — build-time rule requiring all state-writing code paths to trigger the regeneration hook
- Privacy boundary enforcement — private notes stored with a strict `never_pass_to_llm` flag, enforced at the query layer, not just the prompt layer

## Next session (unchanged)

**Lead Generation** (position 1 in the backlog, recommended next). This scope patch does not change what's next up. Lead Gen remains the highest-leverage next session — it's the first feature to feed the pipeline, and its "generate email" button is now spec'd as a call into the Client Context Engine primitive.

The Client Context Engine itself sits at **position 7** in the backlog, to be spec'd after Brand DNA Assessment (5) and Onboarding + Segmentation (6), and before Client Management (8).

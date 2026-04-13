# Phase 3 — Client Management — Handoff Note

**Date:** 2026-04-12
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/client-management.md`
**Status:** Locked, 33 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for Client Management — the profile layer and client portal. 33 questions asked, all locked. This is the largest spec by surface area: admin profiles (company + contact), the full client portal with AI chat, clients index, global search, data export, and Intro Funnel portal migration.

One mid-brainstorm correction from Andy:

1. **Q9 — Portal navigation.** I proposed four conventional navigation options (sidebar, tab bar, hub-and-spoke, minimal top bar). Andy pushed back: "This feels too functional and steers away from the experience focus we're aiming for." This led to the defining decision of the spec — the client portal opens on the AI chat as its home page, with a menu bubble for everything else. Andy specifically requested: a super clean chat UI with nothing else on screen, a subtle pulsing glow around the chat box, and a bartender-register opening line. He also proposed the fallback chain (Pixieset gallery → branded error page) instead of my static summary fallback.

Two scope additions from Andy:

2. **Q7 — Portal AI chat.** I proposed the "What's Next" landing paragraph as a static summary. Andy added "with a 'SuperBad AI' chat function" — transforming the portal from a reference surface into a conversational experience. This cascaded into 5 sub-questions (Q7a–Q7c, Q8, Q9 revision).

3. **Q29a — Real-time notifications.** I proposed no real-time portal push as a non-goal. Andy pushed back on both the deliverable visibility non-goal and the no-notifications non-goal. This led to the three-tier notification system (email + badge on load + real-time SSE push).

No other corrections needed — Andy accepted recommendations on all other questions.

---

## 2. Key decisions summary

### Admin profiles
- **Dual entry** — companies and contacts both first-class, linked. Company = account view (billing, deliverables, Brand DNA blend, package). Contact = person view (Context Engine, draft drawer, action items, comms).
- **Company profile: 7 tabs** — Overview / Deliverables / Billing / Brand DNA / Comms / Portal Chat / Activity.
- **Contact profile: 5 tabs** — Overview / Comms / Brand DNA / Portal Chat / Activity.
- **Contact Overview layout** — two-column (left: Context Engine summary tile, right: deal snapshot + action items + tasks) with private notes full-width below. Draft drawer slides from right edge.
- **Private notes on Overview, unified timeline on Activity tab.** Clean separation of working notes from audit trail.

### Client portal
- **Chat-first design.** Portal opens on a full-page AI chat — nothing else on screen except the conversation, the input with a pulsing glow, and the menu bubble. The bartender opening line is the "What's Next" surface, delivered conversationally.
- **AI chat: bartender register.** Unnamed, warm, knows your name, never pitches. Honest about being AI if asked. Reads both Brand DNA profiles (SuperBad's for voice, client's for personalisation) + `assembleContext()` for state.
- **AI chat capabilities:** Read-only Q&A + escalation to Andy + limited safe actions (approve deliverable, trigger export, view invoice, Billing Portal link).
- **Chat persistence:** Persistent per contact. Escalations to comms inbox. Full log viewable by Andy on admin Portal Chat tabs. Client experience feels private.
- **Menu bubble → full-page overlay menu.** Clean, minimal. Sections: Chat, Deliverables, Invoices, Brand DNA, Package, Messages, Gallery, Download My Data.
- **First-visit tour:** 3 steps, bartender voice, runs once. Static copy (content mini-session).
- **Fallback chain:** Chat unavailable → Pixieset gallery → SuperBad-branded error page with dry voice.
- **Real-time notifications:** Email on deliverable status change + "new" badge on portal menu (checked on load) + SSE push toast if portal tab is open.
- **Individual isolated portals.** Each contact at a company gets their own portal. Shared company data visible. Chat, Brand DNA, opening line scoped to the individual.

### Admin discovery
- **`/lite/clients` index** — summary cards (active clients, monthly revenue, needing attention, overdue invoices) + compact list with health score dots + Active/Completed/Churned filters.
- **Global search** — `Cmd+K` / header click. Searches entities by name + documents by reference + tasks by title. Grouped results. Recents on empty state.
- **Won → client transition:** automatic and invisible. No ceremony, no gate.

### Other
- **External links** — typed categories with auto-reference in automated emails.
- **Data export** — background ZIP via `scheduled_tasks`. Admin-triggered or client-triggered via chat.
- **Intro Funnel migration** — background job on Won transition preserves portal artifacts.

---

## 3. No new memories

No new principles surfaced. The spec applied existing memories (`feedback_individual_feel`, `feedback_no_lite_on_client_facing`, `project_two_perpetual_contexts`, `project_brand_dna_as_perpetual_context`, `feedback_no_content_authoring`, `project_client_size_diversity`) without needing new ones.

---

## 4. Sprinkle bank updates

Browser tab titles claimed for Client Management pages — marked `[CLAIMED by client-management]` in `docs/candidates/sprinkle-bank.md`.

Admin pages: `/lite/clients` (count + dry zero variant), `/lite/companies/[id]` (company name), `/lite/contacts/[id]` (contact name).
Portal pages: "SuperBad" prefix (never "Lite") — chat, section names.

---

## 5. Cross-spec flags (consolidated)

### 5.1 Unified Inbox (#11)
- Must provide `messages` table + thread queries by company and contact.
- Must support `source = 'portal_chat_escalation'` for AI chat escalation messages.

### 5.2 Daily Cockpit (#12)
- Should surface: new client onboarded, churned client, stale portal chat escalations (unanswered > 24h), data export failures.

### 5.3 Setup Wizards (#13)
- External links setup during onboarding practical setup steps should write to company external links.

### 5.4 SaaS Subscription Billing (#9)
- Portal subscription management pages consume cancel flow definitions. SaaS billing spec must define its own variant if it diverges.

### 5.5 WebSocket/SSE infrastructure
- New lightweight event channel for portal real-time push. Not in any prior spec. SSE recommended for v1.

### 5.6 Flags fulfilled from locked specs
- Context Engine: summary tile, action items, draft drawer, private notes, browser tab title, "Visible to AI" toggle. ✓
- Task Manager: deliverables via exported functions, `approveDeliverable()`, no fork. ✓
- Branded Invoicing: Billing tab, portal invoice list (read-only + pay). ✓
- Quote Builder: subscription state on profile, portal cancel flow pages. ✓
- Brand DNA: completion status, individual + blend display. ✓
- Onboarding: progress status, retake nudge on portal. ✓
- Intro Funnel: fork-at-Won migration + portal redirect. ✓
- Sales Pipeline: Won → client graduation. ✓

---

## 6. New data

### 6.1 New table: `portal_chat_messages`
- `id`, `contact_id`, `role` (client/assistant), `content`, `escalated_to_inbox`, `tool_action`, `created_at`

### 6.2 New columns on `contacts`
- `portal_chat_last_seen_at` (timestamp, nullable)
- `portal_last_visited_at` (timestamp, nullable)

### 6.3 `activity_log.kind` gains 8 values
- `portal_chat_message_sent`, `portal_chat_escalated`, `portal_chat_action_taken`, `data_export_requested`, `data_export_completed`, `external_link_added`, `external_link_removed`, `client_profile_viewed_by_admin`

### 6.4 `scheduled_tasks.task_type` gains 2 values
- `client_data_export`, `intro_funnel_portal_migration`

---

## 7. New build-time disciplines

34. No direct `tasks` table queries from Client Management — use Task Manager's exported functions.
35. No direct `messages` table queries — use Unified Inbox's exported functions.
36. Portal chat knowledge boundary enforced at prompt level — only this contact's data + company data.
37. Every portal action routes through an existing primitive — no new action primitives.

---

## 8. Claude prompts

3 prompts:
1. **Bartender opening line** (Haiku) — contextual greeting per visit.
2. **Chat responses** (Opus) — Q&A, escalation, limited actions.
3. **Escalation summary** (Haiku) — concise handoff to Andy's inbox.

Plus 1 static content item: first-visit tour copy (content mini-session).

---

## 9. Content mini-session scope

Small — can fold into another spec's session:
- First-visit portal tour copy (3 steps, bartender voice)
- Portal error page dry one-liner (fallback chain terminal)
- Empty state copy for: no clients, no deliverables, no invoices, no comms, no external links, no Brand DNA
- Loading state copy for: AI chat warming up, export generating, gallery loading
- "New deliverable" notification email template

---

## 10. Phase 5 sizing

4 sessions:
- **Session A:** Admin profiles + global search. Data model, company profile (7 tabs), contact profile (5 tabs), clients index, `Cmd+K` search, external links CRUD. Medium-large.
- **Session B:** Portal chat. Full-page chat UI, bartender prompts (Opus streaming), escalation, limited actions, persistence, menu bubble + overlay, first-visit tour, fallback chain. Large.
- **Session C:** Portal sections + notifications. Deliverables, invoices, Brand DNA, package, messages, gallery, download. Email notifications, badges, SSE push. Medium.
- **Session D:** Export + migration + cancel flow. ZIP export job, client-triggered export via chat, Intro Funnel migration job, `/lite/portal/subscription` cancel flow pages. Medium.

A before B. B before C. D parallels B or C.

---

## 11. What the next session should know

### 11.1 Next recommended spec: SaaS Subscription Billing (#9)

The infrastructure for Lite's second arm — self-serve subscription products. Defines the public signup flow, tier pricing with commitment-length discounts, and the SaaS-specific cancel flow variant. Quote Builder already locked the `scheduled_tasks` primitive and the cancel flow UX patterns (pre-term: pay remainder / 1-month pause / continue; post-term: upgrade / downgrade / "here's what you'd be losing" / cancel through). This spec inherits those and defines the SaaS-specific implementation.

### 11.2 Things easily missed

- **The portal chat is the home page.** If the next session references "the client portal," it opens on a chat, not a dashboard. The "What's Next" information is delivered conversationally by the bartender, not as a static card.
- **Portal Chat tabs on admin profiles.** Both company and contact profiles have a Portal Chat tab. Andy can see all AI chat conversations. This is operational visibility, not a feature the client knows about.
- **Intro Funnel migration is a background job.** When a deal moves to Won, the Intro Funnel portal data migrates to the client portal. The old magic link redirects. This is a `scheduled_tasks` job, not a synchronous transition.
- **The cancel flow pages are owed by this spec.** `/lite/portal/subscription` with pre-term and post-term branches defined by Quote Builder. SaaS Subscription Billing may need its own variant — flag early in that session.
- **SSE is new infrastructure.** No prior spec introduces WebSocket or SSE. Keep it minimal — portal-only, server-to-client, scoped to active tabs.
- **External links have typed categories.** Not freeform. The categories (Google Drive, Frame.io, Pixieset Gallery, Dropbox, Other) are auto-referenced in automated emails. If a future spec needs a new category, add it to the soft enum.

---

## 12. Backlog state

**Phase 3 spec backlog: 17 total, 11 locked, 6 remaining.**

Locked: Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel, Quote Builder, Branded Invoicing, Surprise & Delight (pre-written), Task Manager, Brand DNA Assessment, Onboarding + Segmentation, Client Context Engine, **Client Management** (this session).

Next recommended: SaaS Subscription Billing (#9).

---

**End of handoff.**

# `ui-2` — Inbound router classifier (Haiku) + contact resolution + auto-create — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** `UI-2`
- **Wave:** 9 — Unified Inbox (2 of 13)
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes
- **Estimated context:** medium

## 2. Spec references

- `docs/specs/unified-inbox.md` §7.1 — Inbound router (Q5): classification output shape, effects per category, correction loop
- `docs/specs/unified-inbox.md` §5.1 — `classification_corrections` table schema
- `docs/specs/unified-inbox.md` §5.2 — New columns on `contacts` table (`relationship_type`, `inbox_alt_emails`, `notification_weight`, `always_keep_noise`)
- `docs/specs/unified-inbox.md` §6.1 — Inbound channel pipeline (parse → classify → insert → thread → notify → draft)
- `docs/specs/unified-inbox.md` §11.3 — `inbox_routed` + `inbox_routed_reviewed` activity-log kinds
- `docs/specs/unified-inbox.md` §16 — Disciplines: #52 (three classifiers in parallel), #54 (shared corrections table)
- `lib/ai/prompts/unified-inbox.md` — `inbox-classify-inbound-route` prompt stub

## 2a. Visual references (required for `UI` type)

N/A — FEATURE session, no UI surfaces.

## 3. Acceptance criteria (verbatim)

From spec §7.1 + BUILD_PLAN UI-2 row:

```
- Haiku classifier prompt for inbox-classify-inbound-route that accepts message body + subject + from address + headers + existing contacts list + Brand DNA + recent corrections
- Output shape: { classification, contact_id, new_contact_fields, reason }
- classification enum: match_existing / new_lead / non_client / spam
- match_existing: assigns thread.contact_id, detects alt-email and appends to contact.inbox_alt_emails
- new_lead: auto-creates contact with relationship_type=lead + inferred tag, links thread
- non_client: auto-creates contact with relationship_type=non_client/supplier/personal (LLM sub-type), links thread
- spam: silent-archive, thread hidden, 7-day purge timer set via keep_until
- classification_corrections table created (shared across all three classifiers)
- contacts table gains relationship_type, inbox_alt_emails, notification_weight, always_keep_noise columns
- Router reads recent corrections as few-shot examples
- All classifications stored on message row (router_classification + router_reason columns already exist)
- Activity log: inbox_routed kind logged per classification
```

## 4. Skill whitelist

- `drizzle-orm` — migration + schema edits for contacts columns + classification_corrections table
- `typescript-validation` — Zod schema for classifier output parsing
- `llm-integration` — Haiku prompt composition + model registry wiring

## 5. File whitelist (G2 scope discipline)

- `lib/graph/router.ts` — router classifier entry point + contact resolution logic (`new`)
- `lib/graph/router-prompt.ts` — Haiku prompt builder for `inbox-classify-inbound-route` (`new`)
- `lib/ai/prompts/unified-inbox.md` — flesh out `inbox-classify-inbound-route` stub (`edit`)
- `lib/db/schema/classification-corrections.ts` — shared corrections table (`new`)
- `lib/db/schema/contacts.ts` — add 4 new columns (`edit`)
- `lib/db/schema/index.ts` — re-export `classification-corrections` (`edit`)
- `lib/db/migrations/0031_ui2_classification_corrections.sql` — table creation (`migration`)
- `lib/db/migrations/0032_ui2_contacts_inbox_columns.sql` — ALTER TABLE for 4 new columns (`migration`)
- `lib/graph/sync.ts` — wire router call after message insert in delta sync (`edit`)
- `lib/graph/index.ts` — barrel export for router (`edit`)
- `tests/graph-router.test.ts` — classifier output parsing + contact resolution logic (`new`)
- `sessions/ui-2-handoff.md` — handoff note (`new`)

## 6. Settings keys touched

- **Reads:** none (router uses model registry, not settings keys; corrections read directly from DB)
- **Seeds (new keys):** none

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] `lib/graph/normalize.ts` exports `NormalizedMessage` — verify: `grep "export type NormalizedMessage" lib/graph/normalize.ts`
- [ ] `lib/graph/thread.ts` exports `resolveThread` — verify: `grep "export async function resolveThread" lib/graph/thread.ts`
- [ ] `lib/graph/sync.ts` exists — verify: `ls lib/graph/sync.ts`
- [ ] `lib/graph/client.ts` exports `createGraphClient` — verify: `grep "export async function createGraphClient" lib/graph/client.ts`
- [ ] `lib/db/schema/messages.ts` has `router_classification` column — verify: `grep "router_classification" lib/db/schema/messages.ts`
- [ ] `lib/db/schema/messages.ts` has `router_reason` column — verify: `grep "router_reason" lib/db/schema/messages.ts`
- [ ] `lib/ai/models.ts` has `inbox-classify-inbound-route` registry entry — verify: `grep "inbox-classify-inbound-route" lib/ai/models.ts`
- [ ] `lib/kill-switches.ts` has `inbox_sync_enabled` — verify: `grep "inbox_sync_enabled" lib/kill-switches.ts`
- [ ] `lib/db/schema/activity-log.ts` has `inbox_routed` kind — verify: `grep "inbox_routed" lib/db/schema/activity-log.ts`
- [ ] `contacts` table defined — verify: `grep "contacts" lib/db/schema/contacts.ts`
- [ ] `graph_api_state` table defined — verify: `grep "graph_api_state" lib/db/schema/graph-api-state.ts`

## 8. Rollback strategy (G6 — exactly one)

- [x] `feature-flag-gated` — kill-switch `inbox_sync_enabled` in `lib/kill-switches.ts`; router only fires inside the sync pipeline which is already gated. Rollback = leave the switch off.

## 9. Definition of done

- [ ] `lib/graph/router.ts` exports `classifyAndRouteInbound(msg: NormalizedMessage): Promise<RouterResult>` — verify: `grep "export async function classifyAndRouteInbound" lib/graph/router.ts`
- [ ] `lib/graph/router-prompt.ts` builds the Haiku prompt with contacts list + Brand DNA + corrections — verify: `grep "buildRouterPrompt" lib/graph/router-prompt.ts`
- [ ] `classification_corrections` table created with migration — verify: `ls lib/db/migrations/0031_ui2_classification_corrections.sql`
- [ ] `contacts` table has `relationship_type` column — verify: `grep "relationship_type" lib/db/schema/contacts.ts`
- [ ] `contacts` table has `inbox_alt_emails` column — verify: `grep "inbox_alt_emails" lib/db/schema/contacts.ts`
- [ ] Router output parsed via Zod with fallback on malformed LLM response — verify: `grep "RouterOutputSchema" lib/graph/router.ts`
- [ ] `match_existing` path assigns `thread.contact_id` and handles alt-email detection — verify: `grep "inbox_alt_emails" lib/graph/router.ts`
- [ ] `new_lead` path creates contact with `relationship_type: "lead"` + tag — verify: `grep "new_lead" lib/graph/router.ts`
- [ ] `non_client` path creates contact with LLM-inferred sub-type — verify: `grep "non_client" lib/graph/router.ts`
- [ ] `spam` path sets silent-archive + 7-day keep_until — verify: `grep "spam" lib/graph/router.ts`
- [ ] `inbox_routed` activity logged — verify: `grep "inbox_routed" lib/graph/router.ts`
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.
- [ ] **G10.5 external-reviewer gate** — sub-agent verdict is `PASS` or `PASS_WITH_NOTES`; verdict attached verbatim to handoff; any notes logged to `PATCHES_OWED.md`. FAIL = session closes as FAILED handoff.
- [ ] **Memory-alignment declaration** — handoff lists every applied memory with a one-line "how applied" per G11.
- [ ] G-gates run end-to-end (G0 → G12) with a clean handoff written.

## 10. Notes for the next-session brief writer (G11 extension)

- UI-3 (Notification triage classifier) consumes the same `classification_corrections` table and follows the same Haiku classifier pattern. The prompt builder pattern from UI-2 should be reusable.
- The `contacts.notification_weight` column added in this session is consumed by UI-3's notifier classifier (Q10 input: `Contact.notification_weight`).
- `lib/graph/sync.ts` will have a hook point where UI-2 wires in the router call — UI-3 and UI-4 classifiers will wire into the same point (spec discipline #52: all three run in parallel).
- The `classification_corrections` table is shared across all three classifiers (discipline #54) — UI-3 and UI-4 read from it with their own `classifier` enum filter.
- Brand DNA context retrieval pattern used by the router prompt will be needed by the reply drafter (UI-5, Opus).

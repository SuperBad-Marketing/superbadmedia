# `ui-1` — Graph API client + M365 sync layer — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** `UI-1`
- **Wave:** 9 — Unified Inbox
- **Type:** `INFRA`
- **Model tier:** `/deep` (Opus)
- **Sonnet-safe:** `no`
- **Estimated context:** `medium`

## 2. Spec references

- `docs/specs/unified-inbox.md` §1 (Q2, Q3) — email infrastructure + staged migration decisions
- `docs/specs/unified-inbox.md` §5.1 (`graph_api_state` table) — sync state schema
- `docs/specs/unified-inbox.md` §6 — channel routing + delivery (inbound §6.1, outbound §6.2, identity §6.3)
- `docs/specs/unified-inbox.md` §8 — threading (RFC 5322 header-based)
- `docs/specs/unified-inbox.md` §13 — setup wizard (steps 1–3: story, connect M365, history import shell)
- `docs/specs/unified-inbox.md` §16 — build-time disciplines 51 (token lifecycle), 59 (webhook replay / idempotency), 61 (Outlook-sent message handling)

## 2a. Visual references (required for `UI` type)

N/A — `INFRA` session. No user-facing surfaces.

## 3. Acceptance criteria (verbatim)

From spec §15 mapped to UI-1 scope:
```
- Graph API connection established, tokens stored encrypted, refresh cycle works.
- Inbound email from M365 lands in `messages` table with correct threading.
- Outbound email sends via Graph as both `andy@` and `support@`.
- Webhook subscription created, renewed on schedule.
- Delta sync produces incremental message inserts (no duplicates on replay).
- Kill-switch `inbox_sync_enabled` gates all Graph API calls.
```

## 4. Skill whitelist

- `drizzle-orm` — migration for `graph_api_state` table
- `typescript-validation` — Zod schemas for Graph API responses

## 5. File whitelist (G2 scope discipline)

- `lib/graph/client.ts` — Graph API authenticated client wrapper (`new`)
- `lib/graph/types.ts` — Graph API response types + Zod schemas (`new`)
- `lib/graph/normalize.ts` — Graph message → MessageInsert normalizer (`new`)
- `lib/graph/sync.ts` — delta sync + webhook-triggered sync logic (`new`)
- `lib/graph/send.ts` — outbound send via Graph API (`new`)
- `lib/graph/thread.ts` — RFC 5322 header-based threading logic (`new`)
- `lib/graph/index.ts` — barrel export (`new`)
- `lib/db/schema/graph-api-state.ts` — `graph_api_state` table schema (`new`)
- `lib/db/schema/index.ts` — re-export new table (`edit`)
- `lib/db/migrations/NNNN_ui1_graph_api_state.sql` — migration (`new`)
- `app/api/webhooks/graph/route.ts` — Graph webhook receiver (`new`)
- `app/api/oauth/graph-api/callback/route.ts` — complete OAuth token exchange (`edit`)
- `lib/integrations/vendors/graph-api.ts` — add `Mail.ReadWrite` + `MailboxSettings.Read` scopes (`edit`)
- `lib/kill-switches.ts` — add `inbox_sync_enabled` (`edit`)
- `lib/scheduled-tasks/handlers/inbox-graph-sync.ts` — sync cron handler (`new`)
- `lib/scheduled-tasks/handlers/inbox-graph-subscription-renew.ts` — subscription renewal handler (`new`)
- `lib/scheduled-tasks/worker.ts` — register new handlers (`edit`)
- `docs/settings-registry.md` — add inbox sync settings keys (`edit`)
- `tests/graph-client.test.ts` — client tests (`new`)
- `tests/graph-normalize.test.ts` — normalization tests (`new`)
- `tests/graph-sync.test.ts` — sync logic tests (`new`)
- `tests/graph-thread.test.ts` — threading tests (`new`)
- `tests/graph-send.test.ts` — outbound send tests (`new`)

## 6. Settings keys touched

- **Seeds (new keys):**
  - `inbox.graph_sync_interval_seconds` — `300` — polling interval for delta sync fallback
  - `inbox.graph_subscription_ttl_hours` — `48` — how long Graph webhook subscriptions last (max 4230 min ≈ 70.5h; renew at 48h)
  - `inbox.graph_subscription_renew_buffer_hours` — `6` — renew this many hours before expiry

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] `lib/db/schema/messages.ts` exists — verify: `ls lib/db/schema/messages.ts`
- [ ] `messages` table exported — verify: `grep "export const messages" lib/db/schema/messages.ts`
- [ ] `threads` table exported — verify: `grep "export const threads" lib/db/schema/messages.ts`
- [ ] `graph_message_id` column on messages — verify: `grep "graph_message_id" lib/db/schema/messages.ts`
- [ ] `integration_connections` table — verify: `ls lib/db/schema/integration-connections.ts`
- [ ] `lib/crypto/vault.ts` exists — verify: `ls lib/crypto/vault.ts`
- [ ] `lib/ai/models.ts` exists — verify: `ls lib/ai/models.ts`
- [ ] `lib/kill-switches.ts` exists — verify: `ls lib/kill-switches.ts`
- [ ] `lib/scheduled-tasks/worker.ts` exists — verify: `ls lib/scheduled-tasks/worker.ts`
- [ ] `inbox_graph_subscription_renew` task type registered — verify: `grep "inbox_graph_subscription_renew" lib/db/schema/scheduled-tasks.ts`
- [ ] `.env.example` has `MS_GRAPH_CLIENT_ID` — verify: `grep "MS_GRAPH_CLIENT_ID" .env.example`
- [ ] `lib/integrations/vendors/graph-api.ts` exists — verify: `ls lib/integrations/vendors/graph-api.ts`
- [ ] `lib/wizards/defs/graph-api-admin.ts` exists — verify: `ls lib/wizards/defs/graph-api-admin.ts`
- [ ] `lib/settings.ts` exports `settings` — verify: `grep "export" lib/settings.ts`

## 8. Rollback strategy (G6 — exactly one)

- [x] `feature-flag-gated` — kill-switch named `inbox_sync_enabled` in `lib/kill-switches.ts`; rollback = flip the flag. Migration is additive (new table only, no destructive changes).

## 9. Definition of done

- [ ] `graph_api_state` table exists in schema — verify: `grep "graph_api_state" lib/db/schema/graph-api-state.ts`
- [ ] Migration runs clean — verify: run migration
- [ ] `lib/graph/client.ts` exports `createGraphClient` — verify: `grep "createGraphClient" lib/graph/client.ts`
- [ ] `lib/graph/send.ts` exports `sendViaGraph` — verify: `grep "sendViaGraph" lib/graph/send.ts`
- [ ] `lib/graph/sync.ts` exports `runDeltaSync` — verify: `grep "runDeltaSync" lib/graph/sync.ts`
- [ ] `lib/graph/thread.ts` exports `resolveThread` — verify: `grep "resolveThread" lib/graph/thread.ts`
- [ ] OAuth callback does real code→token exchange — verify: read `app/api/oauth/graph-api/callback/route.ts`
- [ ] Webhook route handles Graph validation + notifications — verify: `grep "validationToken" app/api/webhooks/graph/route.ts`
- [ ] `inbox_sync_enabled` kill-switch exists — verify: `grep "inbox_sync_enabled" lib/kill-switches.ts`
- [ ] Settings keys seeded — verify: `grep "inbox.graph_sync_interval_seconds" docs/settings-registry.md`
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.
- [ ] **G10.5 external-reviewer gate** — sub-agent verdict is `PASS` or `PASS_WITH_NOTES`.
- [ ] **Memory-alignment declaration** — handoff lists every applied memory with a one-line "how applied" per G11.

## 10. Notes for the next-session brief writer (G11 extension)

- UI-2 (Inbound router classifier) consumes `lib/graph/normalize.ts` output + threading from `lib/graph/thread.ts`. Verify these exports match what UI-2 expects.
- The `graph_api_state.last_delta_token` is the sync cursor — UI-2's classifier runs after the sync pipeline inserts messages.
- OAuth scopes expanded to include `Mail.ReadWrite` — if Andy's Azure AD app hasn't been reconsented, the wizard will re-prompt.
- `inbox_sync_enabled` ships disabled. Phase 6 or a follow-up session enables it.
- Outbound send via Graph (`sendViaGraph`) is wired but not yet connected to the inbox compose UI (that's UI-6).

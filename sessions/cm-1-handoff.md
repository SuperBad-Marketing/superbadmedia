# `CM-1` — Client Management INFRA: portal_chat_messages + portal auth wiring — Handoff

**Closed:** 2026-04-18
**Type:** INFRA (small)
**Model tier:** Sonnet

---

## What was built

The **data model and auth foundation** for Client Management (Wave 10).

### New files (4)

| File | Purpose |
|---|---|
| `lib/db/schema/portal-chat-messages.ts` | `portal_chat_messages` table: id (autoincrement PK), contact_id (FK → contacts, cascade), role (client/assistant enum), content, escalated_to_inbox (boolean default false), tool_action (nullable), created_at_ms. Indexed on (contact_id, created_at_ms). |
| `lib/db/migrations/0044_cm1_portal_chat.sql` | DDL: CREATE TABLE portal_chat_messages, ALTER TABLE contacts (3 new columns), INSERT OR IGNORE 1 new settings key (`portal.data_export_zip_ttl_days`). |
| `lib/portal/require-session.ts` | `requirePortalSession()` helper — reads portal session cookie, redirects to `/lite/portal/recover` if absent. Shared by all authenticated portal pages. |
| `tests/portal-chat-messages-schema.test.ts` | Schema shape tests: table name, column names, role enum, Row/Insert type inference. |

### Modified files (8)

| File | Change |
|---|---|
| `lib/db/schema/contacts.ts` | +3 nullable integer columns: `portal_chat_last_seen_at_ms`, `portal_last_visited_at_ms`, `retainer_kickoff_bartender_said_at_ms` |
| `lib/db/schema/activity-log.ts` | +2 kinds: `retainer_mode_brand_dna_gate_entered`, `retainer_kickoff_bartender_message_sent` (8 other CM kinds already existed from Phase 3.5 pre-registration) |
| `lib/db/schema/index.ts` | Added `portal-chat-messages` export |
| `lib/db/migrations/meta/_journal.json` | Added entry idx 44 for `0044_cm1_portal_chat` |
| `lib/settings.ts` | Added `portal.data_export_zip_ttl_days` to SETTINGS_KEYS type map |
| `docs/settings-registry.md` | Added `portal.data_export_zip_ttl_days` row (default 7, integer) |
| `tests/settings.test.ts` | Updated count assertion 137 → 138 |
| `tests/inbox-conversation-view.test.tsx` | Added 3 portal columns to mock ContactRow |

### New test files (3)

| File | Covers |
|---|---|
| `tests/cm1-contacts-columns.test.ts` | 3 new contact columns exist + nullable in Row type |
| `tests/cm1-activity-log-kinds.test.ts` | 10 CM-1 kinds present in ACTIVITY_LOG_KINDS |
| `tests/require-portal-session.test.ts` | requirePortalSession returns session / redirects on missing/malformed cookie |

## Key decisions

1. **`portal_chat_messages.id` is integer autoincrement, not UUID.** Spec §15.1 says "integer PK". Chat messages are append-only and high-volume; autoincrement is simpler and more efficient for ordered reads.

2. **2 of 10 activity_log kinds were genuinely new.** The other 8 were already pre-registered during Phase 3.5 in the Client Management block. Only `retainer_mode_brand_dna_gate_entered` and `retainer_kickoff_bartender_message_sent` needed adding (per F4.b, 2026-04-13).

3. **`requirePortalSession()` as a standalone helper, not a layout-level guard.** Existing portal sub-routes (brand-dna, onboarding, welcome) already have their own auth checks. A shared layout guard would double-check. Better to provide a reusable helper that CM-2+ portal pages import explicitly.

4. **Settings seed aligned with registry.** `portal.chat_calls_per_day_retainer` seeded as `25` (matching `docs/settings-registry.md`), not `20`. Two portal chat keys already existed in 0001_seed_settings.sql; only `portal.data_export_zip_ttl_days` is genuinely new.

## What the next session should know

- **CM-2** builds the admin company profile (7 tabs). All data sources exist from prior waves. The `portal_chat_messages` table is ready for the Portal Chat tab's read-only admin view.
- **`requirePortalSession()`** at `lib/portal/require-session.ts` is the pattern for portal page auth. Import it instead of calling `getPortalSession()` + manual redirect.
- The contacts schema now has 22 columns (19 original + 3 new). Mock ContactRow objects in tests must include the new portal columns.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 197 files, 1659 passed, 0 failures, 1 skipped
- No UI to browser-check (INFRA session, schema + helpers only)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Migration reversible.** Down-migration:
```sql
DROP TABLE IF EXISTS `portal_chat_messages`;
-- SQLite doesn't support DROP COLUMN; to reverse contacts columns,
-- recreate the table without them (standard SQLite migration pattern).
DELETE FROM `settings` WHERE `key` = 'portal.data_export_zip_ttl_days';
```

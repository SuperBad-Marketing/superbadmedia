# `CM-11` — Private notes (Visible to AI toggle) — Handoff

**Closed:** 2026-04-19
**Type:** FEATURE (small)
**Model tier:** Sonnet

---

## What was built

### 1. `private_notes` schema (`lib/db/schema/private-notes.ts`)

- Dedicated table per CCE spec §12.3: `id`, `contact_id`, `content`, `created_by`, `created_at_ms`, `updated_at_ms`.
- FK to `contacts` (cascade) and `user` (set null).
- Indexed on `(contact_id, created_at_ms)`.
- Re-exported from `lib/db/schema/index.ts`.

### 2. Migration (`lib/db/migrations/0047_cm11_private_notes.sql`)

- CREATE TABLE + CREATE INDEX with statement-breakpoint separator.

### 3. Private notes module (`lib/private-notes/index.ts`)

- `createPrivateNote()` — routes to `activity_log` (kind: "note") if visibleToAi=true, or to `private_notes` table if false.
- `getPrivateNotesForContact()` — returns all private (AI-invisible) notes for a contact.
- `toggleNoteVisibility()` — moves a note between tables in a delete+insert pair. Private→public = delete from `private_notes`, insert into `activity_log`. Public→private = delete from `activity_log`, insert into `private_notes`.
- **Module boundary enforced:** `lib/private-notes/` imports nothing from `lib/context-engine/`. Physical separation per spec §7.

### 4. Server actions (`app/lite/admin/contacts/[id]/actions.ts`)

- `addNote()` — auth-gated, creates note via `createPrivateNote()`, revalidates path.
- `toggleVisibility()` — auth-gated, moves note between tables, revalidates path.

### 5. PrivateNotesFeed component (`components/lite/admin/contacts/private-notes-feed.tsx`)

- Client component replacing the Overview tab placeholder.
- Add-note textarea with "Visible to AI" toggle (default on). Checkmark/cross icon + pink/grey states.
- Chronological feed (newest first) merging `private_notes` and `activity_log` notes.
- Each note shows: timestamp, private/public indicator, content, and a "Make visible to AI" / "Make private" toggle button.
- Lock icon (SVG) on private notes, dot on public notes.
- Empty state in brand voice.

### 6. Activity tab upgrade (`components/lite/admin/companies/activity-tab.tsx`)

- Now accepts optional `privateNotes` prop.
- Interleaves `private_notes` into the unified timeline with lock icon and "Private note" label.
- Both company and contact profile pages pass private notes to the Activity tab.

### 7. Contact profile page data loading (`app/lite/admin/contacts/[id]/page.tsx`)

- Loads `private_notes` for the Overview tab (notes feed) and Activity tab (interleaved timeline).
- Loads `activity_log` notes (kind="note") separately for the Overview tab feed.

### 8. Company profile page data loading (`app/lite/admin/companies/[id]/page.tsx`)

- Loads private notes for all contacts in the company when viewing the Activity tab.

### New files (5)

| File | Purpose |
|---|---|
| `lib/db/schema/private-notes.ts` | Table schema + types |
| `lib/db/migrations/0047_cm11_private_notes.sql` | Migration |
| `lib/private-notes/index.ts` | CRUD module |
| `app/lite/admin/contacts/[id]/actions.ts` | Server actions |
| `components/lite/admin/contacts/private-notes-feed.tsx` | Notes feed UI |
| `tests/cm11-private-notes.test.ts` | 13 tests |

### Edited files (4)

| File | Change |
|---|---|
| `lib/db/schema/index.ts` | Re-export `private-notes` |
| `lib/db/migrations/meta/_journal.json` | Add migration entry |
| `app/lite/admin/contacts/[id]/page.tsx` | Replace placeholder, load notes data, wire actions |
| `app/lite/admin/companies/[id]/page.tsx` | Load private notes for company Activity tab |
| `components/lite/admin/companies/activity-tab.tsx` | Accept optional privateNotes, interleave with lock icon |

## Key decisions

1. **Physical table separation per spec §7.** Notes with "Visible to AI" off go into `private_notes` table. Notes with it on go into `activity_log` as kind="note". The Context Engine module (`lib/context-engine/`) has no import path to `lib/private-notes/`. This is the strongest possible boundary — even a bad query can't leak private notes into AI context.

2. **Toggle moves rows between tables.** Flipping visibility deletes from one table and inserts into the other. Simple, atomic (same transaction scope via sequential awaits), and keeps the boundary absolute.

3. **Merge-sort display on the client.** The Overview tab feed and Activity tab both merge entries from two tables into a single chronological view. Done in JS, not SQL, because the two tables have different shapes.

## What the next session should know

- **CM-12** is Portal polish + responsive + dark-mode + S&D ambient slots.
- **CCE-1** will also create the `private_notes` table as part of its schema session. The migration already exists (0047), so CCE-1 should skip re-creating it and just consume `lib/private-notes/` as a dependency.
- The `contacts.notes` column (plain text field) still exists but is no longer used by the Overview tab. It could be deprecated in a future cleanup — not worth removing now since other code may still reference it.
- The toggle operation is not wrapped in a single SQL transaction — it's two sequential async calls. For this use case (admin-only, low concurrency) this is fine. If it ever matters, wrap in `db.transaction()`.
- No new settings keys.

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 209 files, 1782 passed, 0 failures, 1 skipped
- CM-11 tests: 13 passed
- No browser check (admin profile tabs require auth + data; structural correctness validated via typecheck + tests)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** Migration creates a new table (no existing data affected). All changes are new files + edits to existing components. Reverting the commit restores the placeholder and removes the private notes infrastructure.

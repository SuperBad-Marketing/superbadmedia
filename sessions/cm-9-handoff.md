# `CM-9` — Data export primitive — Handoff

**Closed:** 2026-04-19
**Type:** INFRA (medium)
**Model tier:** Sonnet

---

## What was built

### 1. Export storage module (`lib/export/storage.ts`)

- Filesystem-based ZIP storage at `data/exports/` with configurable TTL via `settings.get("portal.data_export_zip_ttl_days")` (default 7 days).
- `storeExportZip(id, buffer, filename)` — writes ZIP + metadata JSON.
- `readExportZip(id)` — reads ZIP + validates not expired; auto-deletes expired files.
- `getExportMeta(id)` — metadata-only check without reading the ZIP.
- `sweepExpiredExports()` — batch cleanup of all expired exports.

### 2. CSV generator (`lib/export/csv.ts`)

- Zero-dependency CSV generator: handles commas, quotes, newlines, null/undefined.
- Used by the ZIP generator for all tabular data files.

### 3. Data gathering module (`lib/export/gather.ts`)

- `gatherCompanyData(companyId)` — queries contacts, deals, invoices, communications (via threads join), Brand DNA profiles + answers, and activity log for a company.
- Returns structured data ready for CSV generation and PDF rendering.

### 4. ZIP generation orchestrator (`lib/export/generate-zip.ts`)

- `generateExportZip(companyId, companyName)` — orchestrates full ZIP creation per spec §13.4:
  - CSVs: contacts, deals, communications, invoices, action-items, brand-dna-tags.
  - PDFs: Brand DNA prose portrait (rendered via Puppeteer), invoice PDFs, quote PDFs.
  - Manifest text file (external links placeholder — table not yet built).
- Filename format: `superbad-[company-slug]-export-[YYYY-MM-DD].zip`.
- Uses JSZip (newly installed dependency, spec-specified).

### 5. Scheduled task handler (`lib/scheduled-tasks/handlers/client-data-export.ts`)

- `client_data_export` handler registered in the worker handler registry.
- Reads company from payload, generates ZIP, stores it, logs `data_export_completed` activity.
- For client-triggered exports: inserts an assistant message into `portal_chat_messages` with the download link.

### 6. API route (`app/api/lite/exports/[id]/route.ts`)

- GET handler serves stored ZIPs by export ID.
- Returns 404 for missing or expired exports.
- Sets Content-Disposition for proper filename on download.

### 7. Portal data-export page (`app/lite/portal/[token]/data-export/page.tsx`)

- Replaced placeholder with real page: locked for `pre_retainer`, real export panel for retainer mode.
- Logs `client_profile_viewed_by_admin` activity on page load.

### 8. Data export panel component (`components/lite/portal/data-export-panel.tsx`)

- Three-state UI: idle (CTA button) → requested (confirmation) → error (retry).
- Brand-consistent styling: Righteous eyebrow, Black Han Sans heading, Playfair italic copy.
- Framer Motion entrance animation with reduced-motion support.
- One export per day limit (idempotency key on date).
- Download link delivery described in help text: "appears in your chat within a few minutes".

### 9. Server action (`app/lite/portal/[token]/data-export/actions.ts`)

- `requestDataExport()` — portal-session-gated, enqueues `client_data_export` task, logs `data_export_requested`.
- Idempotent per company per day via `idempotencyKey`.

### New files (8)

| File | Purpose |
|---|---|
| `lib/export/storage.ts` | ZIP file storage with TTL |
| `lib/export/csv.ts` | CSV generator |
| `lib/export/gather.ts` | Company data queries |
| `lib/export/generate-zip.ts` | ZIP orchestration |
| `lib/scheduled-tasks/handlers/client-data-export.ts` | Background job handler |
| `app/api/lite/exports/[id]/route.ts` | Download API route |
| `components/lite/portal/data-export-panel.tsx` | Portal export UI |
| `app/lite/portal/[token]/data-export/actions.ts` | Server action |
| `tests/cm9-data-export.test.ts` | 16 tests |

### Edited files (3)

| File | Change |
|---|---|
| `lib/scheduled-tasks/handlers/index.ts` | Register `CLIENT_DATA_EXPORT_HANDLERS` |
| `app/lite/portal/[token]/data-export/page.tsx` | Replace placeholder with real page |
| `.gitignore` | Add `data/exports/` |

## Key decisions

1. **Filesystem storage, not database BLOBs.** Same pattern as `data/content-assets/`. Simpler, no DB bloat, and the 7-day TTL + sweep function handles cleanup. Production migration to R2/S3 is a v1.1 concern.

2. **One export per day idempotency.** The idempotency key is `data_export_{companyId}_{date}`. Prevents accidental duplicate ZIP generation (which is expensive — Puppeteer PDF rendering for every invoice/quote).

3. **Download link delivered via portal chat.** For client-triggered exports, the handler inserts an assistant message into `portal_chat_messages` with a markdown link. The client sees it next time they visit chat.

4. **PDF rendering failures are non-fatal.** Individual invoice/quote/Brand DNA PDFs that fail to render (e.g. Puppeteer not available) are silently skipped. The ZIP still generates with whatever succeeded.

5. **JSZip installed.** Spec-named dependency. Lightweight, zero native deps, well-maintained. Added `@types/jszip` as devDependency.

## What the next session should know

- **CM-10** builds the admin-facing "Portal Chat" tab on the company profile. The export download message will appear there once built.
- **Admin trigger** (the "Export everything" button on company Overview tab) is not built in this session — that's CM-12 or a later admin UI session. The handler supports both `admin` and `client` trigger modes already.
- **External links manifest** is a placeholder. The `external_links` table/feature doesn't exist yet. When it ships, update `lib/export/gather.ts` to query it and `lib/export/generate-zip.ts` to write real links into `manifest.txt`.
- **Expired export sweep** (`sweepExpiredExports()`) is implemented but not wired to a scheduled task. It should be called from a daily cron or the worker's idle tick. Can be wired in the settings audit pass or a cleanup session.
- No migration, no schema changes, no new settings keys (the key `portal.data_export_zip_ttl_days` was already registered).

## Verification

- `npx tsc --noEmit` — 0 errors (excluding pre-existing `.next/types` duplicates)
- `npm test` — 207 files, 1757 passed, 0 failures, 1 skipped
- No browser check (export is a background job + download API; structural correctness validated via typecheck + tests)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are new files + handler registration + page replacement + .gitignore addition. Reverting the commit restores the placeholder page and removes the export infrastructure.

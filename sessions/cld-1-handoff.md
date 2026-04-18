# `CLD-1` — Cloudinary integration setup + upload helper — Handoff

**Closed:** 2026-04-18
**Type:** INFRA (medium)
**Model tier:** Sonnet

---

## What was built

### 1. Vendor manifest (`lib/integrations/vendors/cloudinary.ts`)

Replaces `pixieset.ts`. Three jobs registered:
- `cloudinary.upload` (p95: 3000ms, p99: 8000ms)
- `cloudinary.list_folder` (p95: 800ms, p99: 2000ms)
- `cloudinary.generate_archive` (p95: 10000ms, p99: 25000ms)

Dedicated kill-switch: `integrations.cloudinary.enabled`.

### 2. Cloudinary module (`lib/cloudinary/index.ts`)

SDK wrapper reading credentials from `integration_connections` via `getCredential("cloudinary")`. Exports:
- `uploadToCloudinary(filePath, folder, options?)` — upload with auto resource type detection
- `listFolder(folder, options?)` — paginated folder listing
- `transformUrl(publicId, transforms)` — on-the-fly transform URL generation (resize, crop, quality, format)
- `generateArchiveUrl(folder)` — ZIP download URL for entire folder
- `testConnection(cloudName, apiKey, apiSecret)` — credential verification via `api.ping()`
- `resetCloudinaryConfig()` — for credential rotation scenarios

### 3. Wizard definition (`lib/wizards/defs/cloudinary.ts`)

Replaces `pixieset-admin.ts`. Three-step flow: form (cloud name + API key + API secret) → review-and-confirm → celebration. `completionContract.verify` calls `testConnection()` to confirm credentials work before completing. Zod schema validates cloud name format and numeric API key.

### 4. Server actions (`app/lite/setup/admin/[key]/actions-cloudinary.ts`)

Replaces `actions-pixieset.ts`. `completeCloudinaryAction()` — celebration orchestrator following the established pattern: `registerIntegration` → `verifyCompletion` → `wizard_completions` insert. Credentials stored as JSON blob (`{ cloudName, apiKey, apiSecret }`).

### 5. Client component (`app/lite/setup/admin/[key]/clients/cloudinary-admin-client.tsx`)

Replaces `pixieset-admin-client.tsx`. Three-field form state, API secret masked in review summary. Same `useAdminShell` hook as all other admin wizard clients.

### 6. Schema: `deals.cloudinary_gallery_folder`

New nullable `text` column on `deals`. Migration `0045_cld1_cloudinary_gallery.sql`. Stores the Cloudinary folder path for a deal's gallery (e.g. `shoots/deal-abc123`). Consumed by CLD-2 (portal gallery page).

### 7. Barrel + page dispatcher updates

- `lib/wizards/defs/index.ts` — `pixieset-admin` → `cloudinary`
- `app/lite/setup/admin/[key]/page.tsx` — `PixiesetAdminClient` → `CloudinaryAdminClient`, CLIENT_MAP key `pixieset-admin` → `cloudinary`

### New files (6)

| File | Purpose |
|---|---|
| `lib/integrations/vendors/cloudinary.ts` | Vendor manifest |
| `lib/cloudinary/index.ts` | SDK wrapper module |
| `lib/wizards/defs/cloudinary.ts` | Wizard definition |
| `app/lite/setup/admin/[key]/actions-cloudinary.ts` | Server actions |
| `app/lite/setup/admin/[key]/clients/cloudinary-admin-client.tsx` | Client component |
| `tests/cloudinary-wizard.test.ts` | 11 tests |

### Deleted files (5)

| File | Reason |
|---|---|
| `lib/integrations/vendors/pixieset.ts` | Replaced by cloudinary.ts |
| `lib/wizards/defs/pixieset-admin.ts` | Replaced by cloudinary.ts |
| `app/lite/setup/admin/[key]/actions-pixieset.ts` | Replaced by actions-cloudinary.ts |
| `app/lite/setup/admin/[key]/clients/pixieset-admin-client.tsx` | Replaced by cloudinary-admin-client.tsx |
| `tests/pixieset-admin-wizard.test.ts` | Replaced by cloudinary-wizard.test.ts |

### Edited files (9)

| File | Change |
|---|---|
| `lib/wizards/defs/index.ts` | Barrel: pixieset-admin → cloudinary |
| `app/lite/setup/admin/[key]/page.tsx` | CLIENT_MAP: pixieset-admin → cloudinary |
| `lib/db/schema/deals.ts` | Added `cloudinary_gallery_folder` column |
| `lib/db/migrations/meta/_journal.json` | Added migration 0045 entry |
| `tests/twilio-wizard.test.ts` | pixieset-admin → cloudinary in registry assertion + comment |
| `tests/api-key-wizard.test.ts` | pixieset-admin → cloudinary in registry assertion |
| `tests/google-ads-wizard.test.ts` | pixieset-admin → cloudinary in registry assertion |
| `tests/meta-ads-wizard.test.ts` | pixieset-admin → cloudinary in registry assertion + comment |
| `tests/wizard-schema.test.ts` | pixieset → cloudinary in integration_connections test |

Also updated comments in: `actions-twilio.ts`, `twilio-client.tsx`, `actions-saas-product.ts`, `sb2a-wizard-def.test.ts`.

### New dependency

`cloudinary` npm package added. Required for SDK access (upload, transform, list, archive, ping).

### Migration

`0045_cld1_cloudinary_gallery.sql` — `ALTER TABLE deals ADD COLUMN cloudinary_gallery_folder TEXT`.

## Key decisions

1. **Form step, not api-key-paste.** Cloudinary needs three fields (cloud name, API key, API secret) whereas `api-key-paste` is single-field. Used a `form` step with a Zod schema instead.

2. **Credentials stored as JSON blob.** `registerIntegration` takes `credentials.plaintext` as a string. Cloudinary needs three values, so they're JSON-stringified. Same pattern as Twilio (`{ accountSid, authToken }`).

3. **`testConnection()` uses `api.ping()`.** The cheapest authenticated Cloudinary Admin API call. Confirms all three credential fields are valid.

4. **Dedicated kill-switch `integrations.cloudinary.enabled`.** Unlike the old Pixieset which shared `setup_wizards_enabled`, Cloudinary is a live API integration — it needs independent circuit-breaking.

5. **`cloudinary_gallery_folder` on deals, not a separate table.** One folder per deal. Simple enough to be a column. CLD-2 reads this to render the portal gallery.

## What the next session should know

- **CLD-2** builds the portal gallery page at `/portal/[token]/gallery`. It reads `deals.cloudinary_gallery_folder` and uses `listFolder()` + `transformUrl()` from `lib/cloudinary/` to render the masonry grid. The gallery stub route already exists (CM-6).
- The `lib/cloudinary/index.ts` module lazy-loads credentials on first use via `ensureConfigured()`. Tests that import it won't trigger real API calls.
- The admin gallery upload UI (where Andy uploads photos and clicks "Publish gallery") is built in IF-2 (Wave 14), not here. CLD-1 provides the infrastructure; IF-2 builds the admin surface.
- `CLOUDINARY_URL` or individual env vars are NOT needed — credentials come from `integration_connections` after the wizard runs. The Cloudinary SDK is configured programmatically.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 202 files, 1705 passed, 0 failures, 1 skipped
- `npm run build` — clean
- No browser check (wizard requires live admin session + Cloudinary credentials; structural correctness validated via tests + typecheck)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable + migration reversible.** Migration is a single `ALTER TABLE ADD COLUMN` — reversible with `ALTER TABLE deals DROP COLUMN cloudinary_gallery_folder`. Reverting the commit removes the Cloudinary module, wizard, and restores the old Pixieset files from git history. No data shape dependency from other sessions yet (CLD-2 hasn't shipped).

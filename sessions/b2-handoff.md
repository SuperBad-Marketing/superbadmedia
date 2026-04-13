# B2 Handoff — Backups + DR + credential vault

**Session:** B2 | **Date:** 2026-04-13 | **Model:** Sonnet 4.6 (prescribed tier, no upshift needed)
**Wave:** 2 — Foundation B
**Type:** INFRA
**Rollback:**
1. **Litestream** — git-revertable: remove `litestream.yml` + env vars; Coolify deployment reverts to no replication. App runtime unaffected (Litestream is a sidecar, not in-process).
2. **Vault** — feature-flag-gated (encrypt-new-only; existing unencrypted values still work; stop calling `vault.encrypt()` to revert). No data migration needed.

---

## What was built

All B2 acceptance criteria met.

### New files

| File | Purpose |
|---|---|
| `lib/crypto/vault.ts` | `vault.encrypt(plaintext, context)` / `vault.decrypt(ciphertext, context)` — AES-256-GCM, 12-byte random IV prepended, AAD = context, key from `CREDENTIAL_VAULT_KEY` (64 hex chars = 32 bytes) |
| `lib/crypto/index.ts` | Barrel export: `export { vault } from "./vault"` |
| `lib/eslint-rules/no-direct-crypto.ts` | ESLint rule blocking `createCipheriv`, `createDecipheriv`, `subtle.encrypt`, `subtle.decrypt` outside `lib/crypto/vault.ts` |
| `litestream.yml` | Litestream replication config: `${DB_FILE_PATH}` → R2 (`${R2_BUCKET_NAME}` / `${R2_ENDPOINT_URL}`), 1s sync-interval, 24h Litestream retention |
| `INCIDENT_PLAYBOOK.md` | Stub with 8 sections: Brand DNA Gate bypass, critical-flight bypass, Litestream restore drill, vault key rotation, cost alert, outreach kill-switch, Stripe webhook failures (stub), Resend suspension (stub) |
| `docs/dr-runbook.md` | Runnable restore procedure: stop app → set R2 env vars → `litestream restore` → verify row counts → restart. Includes restore drill instructions for Phase 6 launch gate. |
| `tests/vault.test.ts` | 10 tests: round-trip (3), random IV, different contexts → different ciphertexts, wrong context throws, tampered ciphertext throws, too-short ciphertext throws, missing key throws, wrong-length key throws |

### Edited files

| File | Change |
|---|---|
| `lib/eslint-rules/index.ts` | Added `no-direct-crypto` import + rule registration |
| `eslint.config.mjs` | Added `lib/crypto/vault.ts` to ignores + `"lite/no-direct-crypto": "error"` rule |
| `FOUNDATIONS.md` §5 | Added ATO 7-year retention bullet (PATCHES_OWED row closed) + updated Mandatory Phase 5 verification note with refs to `docs/dr-runbook.md` + `LAUNCH_READY.md` |
| `.env.example` | Added `CREDENTIAL_VAULT_KEY`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `DB_FILE_PATH` with full comments |

---

## Key decisions

- **`DB_FILE_PATH` separate from `DATABASE_URL`:** Litestream needs the raw filesystem path (no `file:` prefix). Rather than stripping the prefix at Litestream startup, a separate `DB_FILE_PATH` env var is used. Local dev defaults `DB_FILE_PATH="./dev.db"`. Production sets it to the Coolify volume path (e.g. `/data/db.sqlite`). Both vars are documented in `.env.example`.

- **Litestream retention = 24h, not 7 years:** The `retention: 24h` in `litestream.yml` controls how long Litestream keeps historical WAL frames for point-in-time restore. The 7-year ATO retention is a Cloudflare R2 **bucket lifecycle policy** (configure in the R2 dashboard to never-expire). These are orthogonal settings. FOUNDATIONS.md §5 and `docs/dr-runbook.md` both call this out explicitly.

- **`no-direct-crypto` excludes `createHash`/`randomUUID`:** The ESLint rule only fires on `createCipheriv`, `createDecipheriv`, and `subtle.encrypt/decrypt`. Non-cipher crypto use (`createHash` for magic-link tokens, `crypto.randomUUID()` for IDs) is allowed — confirmed by `magic-link.test.ts` imports of `createHash` continuing to lint-clean.

- **INCIDENT_PLAYBOOK.md seeded with 8 sections:** Brief specified 4 (Brand DNA bypass, critical-flight bypass, Litestream restore drill, vault key rotation). Added 4 more placeholder sections (cost alert, outreach kill-switch, Stripe webhook, Resend bounce) to give a complete incident-handling skeleton for Phase 6.

- **B3 brief already pre-compiled (by A8):** G11.b check passed — `sessions/b3-brief.md` exists and is up to date. B2 artefacts (`CREDENTIAL_VAULT_KEY` in `.env.example`, `INCIDENT_PLAYBOOK.md` existence) satisfy B3's G1 preconditions.

---

## Artefacts produced (G7 verification)

- **Files created:** 7 new files (listed above)
- **Files edited:** 4 files (listed above)
- **Tables created:** none (B2 is infra-only — no DB schema changes)
- **Migrations written:** none
- **Settings rows added:** none (vault key is env var, not DB — secret material must not be in DB)
- **Routes added:** none
- **Dependencies added:** none (Node.js `node:crypto` is built-in; Litestream is a sidecar binary, not an npm package)

---

## Verification gates

- **G1 preflight:** All 6 preconditions verified before build started ✓
- **G4 settings-literal grep:** No autonomy-sensitive literals in B2 diff. vault uses `process.env.CREDENTIAL_VAULT_KEY` (env var, not settings table — correct; secret material must not be in DB). Litestream config uses env var interpolation (`${R2_BUCKET_NAME}` etc.) ✓
- **G5 motion:** INFRA session — no UI surfaces, no state transitions. G5 N/A ✓
- **G6 rollback:** Dual rollback declared — Litestream git-revertable + vault feature-flag-gated (encrypt-new-only) ✓
- **G7 artefacts:** All 7 new files + 4 edited files confirmed present via `ls` + Read ✓
- **G8 typecheck + tests:** `npx tsc --noEmit` → 0 errors ✓. `npm test` → 172/172 green (162 pre-B2 + 10 new vault tests). Note: first run hit pre-existing flaky `settings.test.ts` "database is locked" (parallel DB access timing); second run 172/172 clean — consistent with pre-B2 baseline. `npm run lint` → clean ✓
- **G9 E2E:** Not applicable — B2 does not touch a critical flow ✓
- **G10 browser:** INFRA session — no UI surfaces built. G10 N/A ✓
- **`npm run build`:** Pre-existing Google Fonts 403 in sandbox (9 font errors) — consistent with B1/A7/A8 precedent. No B2 build regressions ✓

---

## Migration state after B2

```
0000_init.sql                    — Drizzle journal idx 0
0001_seed_settings.sql           — Drizzle-untracked seed (68 settings rows)
0002_a6_activity_scheduled_inbox — Drizzle journal idx 2
0003_a7_email_stripe_pdf         — Drizzle journal idx 3
0004_a8_portal_auth              — Drizzle journal idx 4
0005_b1_support                  — Drizzle journal idx 5
(no B2 migration — B2 is infra-only, no schema changes)
```

B3's migration must be `0006_b3_*.sql`.

---

## PATCHES_OWED rows (B2 — none new)

No new PATCHES_OWED rows. All B2 work is new-file/new-infra. The FOUNDATIONS.md §5 ATO retention patch row (from Phase 3.5 Batch C step 13) is now CLOSED (applied in this session).

---

## Open threads for B3 (next session)

- **`INCIDENT_PLAYBOOK.md` exists** at repo root — B3 may add a "cookie-consent incident" section if the brief calls for it, but the file is already seeded.
- **`vault.encrypt/decrypt`** available at `lib/crypto/vault.ts` — B3 likely doesn't use it (legal pages + cookie consent have no secrets to encrypt), but it's available if the MaxMind API key needs storing.
- **`legal_doc_versions` table** was created in A7 (not B2) — B3 seeds rows into it; the table itself does not need re-creating. Verify: `grep "legal_doc_versions" lib/db/schema/`.
- **`no-direct-crypto` ESLint rule** is active — if B3 imports `node:crypto` for UUID or hash, use `crypto.randomUUID()` (allowed) not `createCipheriv` (blocked). The rule excludes `lib/crypto/vault.ts` only.
- **Migration naming:** B3's migration is `0006_b3_legal.sql` (cookie_consents table + legal_doc_versions seed rows).
- **DB_FILE_PATH env var:** Added to `.env.example`. B3 does not need this var, but it should not conflict with anything B3 declares.
- **B3 is the Foundation-B exit gate session.** After B3 closes, the Foundation-B exit checklist (B1 Sentry + B2 Litestream restore drill + B2 vault round-trip + B3 legal pages + B3 GDPR banner) must all pass before Wave 3 opens.
- **Litestream restore drill** is documented in `docs/dr-runbook.md` — B3's Foundation-B exit checklist verifies this file exists.

---

## Autonomy loop note

`RemoteTrigger` tool was not available in this environment. The hourly safety-net cron will fire the next session (Wave 2 B3). This is a known environment limitation — no action required.

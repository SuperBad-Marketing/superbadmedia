# B2 — Backups + DR + credential vault — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** B2
- **Wave:** 2 — Foundation B
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** medium

## 2. Spec references

- `BUILD_PLAN.md` Wave 2 §B2 — owner block.
- `FOUNDATIONS.md` §5 — SQLite + Litestream → R2 backup; 7-year ATO retention policy note owed.
- `FOUNDATIONS.md` §11 — credential vault primitive (`lib/crypto/vault.ts`) — Phase 3.5 Batch C step 13 row.
- `PATCHES_OWED.md` "Credential vault primitive" row (Phase 3.5 Batch C step 13) — `vault.encrypt/decrypt`, AES-256-GCM, `CREDENTIAL_VAULT_KEY` env var.
- `PATCHES_OWED.md` "Tax record retention policy" row (Phase 3.5 Batch C step 13) — R2 backup objects ≥ 7 years, no aged-out deletes.

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md B2)

```
B2 — Backups + DR + credential vault
- Builds: Litestream → Cloudflare R2 continuous replication; mandatory
  restore-from-R2 verification (not skippable per FOUNDATIONS reality-check);
  7-year retention policy note in FOUNDATIONS §5 (ATO compliance); credential
  vault `lib/crypto/vault.ts` with `vault.encrypt(plaintext, context)` /
  `vault.decrypt(ciphertext, context)` (AES-256-GCM, key from
  `CREDENTIAL_VAULT_KEY`, AAD = context scope). No feature code imports raw
  crypto libraries.
- Owns: `lib/crypto/vault.ts`, Litestream config, DR runbook (seeds
  INCIDENT_PLAYBOOK.md stub).
- Consumes: A5 (settings for key locations), env vars.
- Rollback: Litestream can be disabled; vault is backwards-compatible with
  new-only encryption.
```

## 4. Skill whitelist

- (none required — Litestream + Cloudflare R2 + Node.js `crypto` are well-documented; WebFetch Litestream docs if needed)

## 5. File whitelist (G2 scope discipline)

- `litestream.yml` — Litestream replication config pointing at `DATABASE_URL` → R2 bucket (`new`).
- `lib/crypto/vault.ts` — `vault.encrypt(plaintext, context)` / `vault.decrypt(ciphertext, context)` (AES-256-GCM, 12-byte random IV prepended, AAD = context) (`new`).
- `lib/crypto/index.ts` — barrel (`new`).
- `INCIDENT_PLAYBOOK.md` — seed stub: sections for Brand DNA Gate bypass, critical-flight bypass, Litestream restore drill, vault key rotation. (Owed by F2.b + admin-first-login-sequencing-lock rows in PATCHES_OWED.md. B2 creates the file; Phase 6 fills each section.) (`new`).
- `docs/dr-runbook.md` — restore drill procedure: stop app → `litestream restore` from R2 → verify row-count → restart. Must be executable, not aspirational. (`new`).
- `FOUNDATIONS.md` §5 — patch: R2 backup objects retained ≥ 7 years (ATO); no delete tooling for invoices/deals/subscriptions/payments in v1 (`edit`).
- `.env.example` — `CREDENTIAL_VAULT_KEY`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL` (`edit`).
- `lib/eslint-rules/no-direct-crypto.ts` — ESLint rule blocking raw `crypto.createCipheriv` / `createDecipheriv` / `subtle.encrypt` outside `lib/crypto/vault.ts` (`new`).
- `eslint.config.mjs` — register `no-direct-crypto` rule (`edit`).
- `tests/vault.test.ts` — round-trip: encrypt → decrypt → equals original; different contexts produce different ciphertexts; tampered ciphertext throws (`new`).

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none — vault key from env var, not settings table (secret material must not be in DB).
- **Seeds (new keys):** none.

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] B1 closed cleanly — verify: `ls sessions/b1-handoff.md`.
- [ ] `DATABASE_URL` in `.env.example` — verify: `Grep "DATABASE_URL" .env.example`.
- [ ] `lib/db/index.ts` exports `db` — verify: `Grep "export.*db" lib/db/index.ts`.
- [ ] INCIDENT_PLAYBOOK.md does NOT exist yet (B2 creates it) — verify: `ls INCIDENT_PLAYBOOK.md 2>/dev/null` returns nothing.
- [ ] `lib/crypto/` does NOT exist yet (B2 creates it) — verify: `ls lib/crypto/ 2>/dev/null` returns nothing.
- [ ] No `litestream.yml` in repo root — verify: `ls litestream.yml 2>/dev/null` returns nothing.

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**Two independent rollbacks:**
1. **Litestream** — remove `litestream.yml` + associated env vars; Coolify deployment reverts to no replication. App runtime unaffected (Litestream runs as a sidecar, not in-process).
2. **Vault** — vault is encrypt-new-only; existing unencrypted values continue to work. Rollback = stop calling `vault.encrypt()` in new sessions. No data migration needed. Key rotation procedure is documented in `INCIDENT_PLAYBOOK.md`.

## 9. Definition of done

- [ ] `vault.encrypt("test", "context")` + `vault.decrypt(ciphertext, "context")` round-trips — verify: `tests/vault.test.ts` green.
- [ ] Different context strings produce different ciphertexts (AAD enforcement) — verify: test.
- [ ] Tampered ciphertext throws (GCM authentication tag) — verify: test.
- [ ] `no-direct-crypto` ESLint rule blocks `createCipheriv` in any file outside `lib/crypto/vault.ts` — verify: lint test file with a violating import.
- [ ] `litestream.yml` exists at project root with `R2_BUCKET_NAME` / `R2_ENDPOINT_URL` interpolation — verify: `cat litestream.yml`.
- [ ] `INCIDENT_PLAYBOOK.md` created with stub sections (Brand DNA Gate bypass, critical-flight bypass, Litestream restore drill, vault key rotation) — verify: `Read INCIDENT_PLAYBOOK.md`.
- [ ] `docs/dr-runbook.md` describes a runnable restore procedure — verify: `Read docs/dr-runbook.md`.
- [ ] `FOUNDATIONS.md` §5 patched with 7-year retention note — verify: `Grep "7 year\|7-year\|ATO" FOUNDATIONS.md`.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.

## 10. Notes for the next-session brief writer (B3)

B3 must know from B2:
- `INCIDENT_PLAYBOOK.md` now exists at repo root (B3 may want to add cookie-consent incident section).
- `vault.encrypt/decrypt` is available at `lib/crypto/vault.ts` — B3's MaxMind geo-lookup may store an API key that uses the vault.
- `legal_doc_versions` table was created in A7 (not B2/B3) — B3 seeds rows into it; the table itself does not need re-creating.
- ESLint `no-direct-crypto` rule is active — if B3 imports `crypto` for the consent-banner UUID or hash, use `crypto.randomUUID()` (allowed) not `createCipheriv` (blocked).
- B3 is the Foundation-B exit gate session — after B3, B1+B2+B3 exit checklist must all pass before proceeding to Wave 3.

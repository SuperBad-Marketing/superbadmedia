# B2 — Backups + DR + credential vault — Session Brief

> Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0 + §G11.b rolling cadence.
> Written by A8 (Wave 1 closing session) against current repo state 2026-04-13.
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1).

---

## 1. Identity

- **Session id:** B2
- **Wave:** 2 — Foundation B
- **Type:** INFRA
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** medium

## 2. Spec references

- `BUILD_PLAN.md` Wave 2 §B2 — owner block (full description).
- `FOUNDATIONS.md` §5 — Backup + DR strategy (Litestream → R2, 7-year retention ATO compliance).
- `FOUNDATIONS.md` §4 — Database section (SQLite + Litestream context).

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md B2)

```
B2 — Backups + DR + credential vault
- Litestream → Cloudflare R2 continuous replication configured.
  litestream.yml present at project root; `LITESTREAM_ACCESS_KEY_ID`,
  `LITESTREAM_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT` env vars
  declared in .env.example + validated in lib/env.ts.
- Mandatory restore-from-R2 verification documented: README.md or
  docs/dr-runbook.md step-by-step restore procedure. The restore drill
  itself is a human-run verification step, not automated in CI (single-server
  SQLite restore requires human coordination).
- 7-year retention policy noted in FOUNDATIONS.md §5 + in DR runbook
  (ATO compliance for Australian business records).
- Credential vault: lib/crypto/vault.ts with vault.encrypt(plaintext, context)
  and vault.decrypt(ciphertext, context). Algorithm: AES-256-GCM.
  Key source: CREDENTIAL_VAULT_KEY env var. AAD = context scope string
  (e.g. "stripe_secret_key:company-123").
  No feature code imports raw crypto libraries — vault is the only interface.
- ESLint rule: no-direct-crypto-import blocks `import crypto from 'node:crypto'`
  in app/ and lib/ feature code outside lib/crypto/.
- INCIDENT_PLAYBOOK.md stub created (or extended from any existing stub):
  covers vault key rotation + Litestream restore trigger.
- npx tsc --noEmit → zero errors.
- npm test → green.
```

## 4. Skill whitelist

(No skill needed — B2 is Litestream config + Node.js crypto. Standard patterns.)

## 5. File whitelist (G2 scope discipline)

- `lib/crypto/vault.ts` — `vault.encrypt()` + `vault.decrypt()` + `VaultContext` type (`new`)
- `lib/crypto/index.ts` — barrel export (`new`)
- `lib/eslint-rules/index.ts` — add `no-direct-crypto-import` rule (`edit`)
- `litestream.yml` — Litestream config template (`new`)
- `docs/dr-runbook.md` — restore procedure + 7-year ATO retention note (`new`)
- `INCIDENT_PLAYBOOK.md` — stub covering vault key rotation + restore trigger (`new` or `edit` if already exists)
- `lib/env.ts` — add `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `CREDENTIAL_VAULT_KEY` validation (`edit`)
- `.env.example` — add the 5 new env vars above (`edit`)
- `tests/vault.test.ts` — unit tests for `vault.encrypt()` / `vault.decrypt()` (`new`)
- `package.json` + lock — `litestream` is a binary, not an npm package; no npm dep needed for the config file.

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none.
- **Seeds (new keys):** none.

## 7. Preconditions (G1 — must be grep-verifiable)

- [ ] B1 closed cleanly — verify: `ls sessions/b1-handoff.md`
- [ ] `lib/env.ts` exists and has existing `NEXTAUTH_SECRET`, `DATABASE_URL` validation — verify: `grep "NEXTAUTH_SECRET" lib/env.ts`
- [ ] `SENTRY_DSN` added by B1 to `.env.example` — verify: `grep "SENTRY_DSN" .env.example`
- [ ] `lib/eslint-rules/index.ts` exists (A5 artefact) — verify: `ls lib/eslint-rules/index.ts`
- [ ] No prior `lib/crypto/` directory — verify: `ls lib/crypto/ 2>/dev/null` returns nothing (avoid clobber)
- [ ] `CREDENTIAL_VAULT_KEY` not yet declared in `.env.example` — verify: `grep "CREDENTIAL_VAULT_KEY" .env.example` returns nothing

## 8. Rollback strategy (G6)

**git-revertable, no data shape change** — B2 adds no database tables. `lib/crypto/vault.ts` is a pure helper with no persistent state. Litestream config is a YAML file; disabling replication requires removing or emptying `litestream.yml`. ESLint rule addition is git-revertable.

## 9. Definition of done

- [ ] `lib/crypto/vault.ts` exports `vault` with `.encrypt()` + `.decrypt()` — verify: `grep "export" lib/crypto/vault.ts`
- [ ] `vault.encrypt()` / `vault.decrypt()` round-trip — verify: tests/vault.test.ts green
- [ ] `CREDENTIAL_VAULT_KEY` in `.env.example` + validated in `lib/env.ts` — verify: `grep "CREDENTIAL_VAULT_KEY" lib/env.ts`
- [ ] `litestream.yml` present at project root — verify: `ls litestream.yml`
- [ ] `docs/dr-runbook.md` present with restore procedure — verify: `ls docs/dr-runbook.md`
- [ ] `INCIDENT_PLAYBOOK.md` present with vault + restore sections — verify: `ls INCIDENT_PLAYBOOK.md`
- [ ] `no-direct-crypto-import` ESLint rule added — verify: `grep "no-direct-crypto-import" lib/eslint-rules/index.ts`
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run lint` → clean

## 10. Notes for the next-session brief writer (B3)

B2 closes with:
- `lib/crypto/vault.ts` available — B3's legal pages don't need the vault but can reference it for future PII storage.
- `INCIDENT_PLAYBOOK.md` stub exists — A8 logged `a8_incident_playbook_rollback` in PATCHES_OWED; B2 should expand the stub to cover both B2's vault rotation and A8's portal gate rollback (`BRAND_DNA_GATE_BYPASS=true`).
- `litestream.yml` present — B3 is UI-only and doesn't touch infra.
- Migration state after B2: 5 migrations (0000–0005, assuming B1 used 0005). B2 adds no migration. B3's migration should be `0006_b3_*.sql` if B3 adds tables (it does: `cookie_consents`).
- `MaxMind` geo-lookup for B3: B3 evaluates a library for EU IP detection. B3 may need to install an npm dep — flag it in the handoff per CLAUDE.md discipline.

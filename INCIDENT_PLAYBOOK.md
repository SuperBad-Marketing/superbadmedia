# SuperBad Lite — Incident Playbook

**Status:** stub — seeded by Phase 5 Wave 2 B2. Each section below is a placeholder.
Sections are filled in as the relevant features land. Phase 6 completes this document
before go-live.

Andy is solo. This playbook is the colleague.

---

## How to use this playbook

1. Identify which section applies to the incident.
2. Follow the steps in order. Do not skip steps.
3. If a step says "contact", do it before proceeding.
4. After the incident is resolved, write a one-paragraph post-mortem and append
   it to the relevant section.

---

## 1. Brand DNA Gate bypass (emergency admin access)

> **When:** Andy cannot complete the Brand DNA Assessment and is locked out of the
> admin surface.

**Steps (temporary bypass — production only, never leave it on):**

1. SSH into the Coolify droplet (credentials in your password manager under "Coolify SSH").
2. In Coolify → SuperBad Lite service → Environment Variables, set:
   ```
   BRAND_DNA_GATE_BYPASS=true
   ```
3. Redeploy the service (takes ~60 seconds).
4. Sign in at `/lite` — the Brand DNA Gate is now bypassed.
5. Resolve the underlying issue (complete the Brand DNA Assessment or debug the gate).
6. Remove `BRAND_DNA_GATE_BYPASS` from the env and redeploy again.

**Do NOT leave `BRAND_DNA_GATE_BYPASS=true` in production.** It disables a
security gate. See `.env.example` for context.

---

## 2. Critical-flight bypass (onboarding loop workaround)

> **When:** a user is stuck in the onboarding loop and cannot reach the portal.

_Section to be filled in by the feature session that ships the critical-flight
check (`lib/auth/has-completed-critical-flight.ts`)._

**Placeholder steps:**

1. Identify the stuck user ID in the `support_tickets` table.
2. Manually update the relevant record to mark the critical flight as completed.
3. Ask the user to sign out and sign back in.

---

## 3. Litestream restore drill

> **When:** the Coolify droplet is lost, corrupt, or the SQLite file is deleted.
> Also: run this drill before Phase 6 launch as a mandatory test.

See `docs/dr-runbook.md` for the full step-by-step restore procedure.

**Quick reference:**
1. Provision a new droplet or clean volume.
2. Stop the Next.js service.
3. Run `litestream restore` from R2 (see runbook for exact command).
4. Verify row counts match the last known state.
5. Start the Next.js service.

**Contact:** Cloudflare support if R2 bucket is inaccessible — R2 SLA is 99.9%.
Ticket at: https://dash.cloudflare.com/support

---

## 4. Vault key rotation

> **When:** `CREDENTIAL_VAULT_KEY` is suspected to be compromised, or as a
> planned annual rotation.

**Steps:**

1. Generate a new 32-byte key:
   ```bash
   openssl rand -hex 32
   ```
2. Write a one-off migration script that:
   - Reads every encrypted value from the database (columns that use `vault.encrypt`).
   - Decrypts each with the **old key** (set `CREDENTIAL_VAULT_KEY` to old key in env).
   - Re-encrypts with the **new key**.
   - Writes the new ciphertext back.
3. Run the migration in a maintenance window (put the app in read-only mode first).
4. In Coolify, update `CREDENTIAL_VAULT_KEY` to the new key.
5. Redeploy.
6. Verify: attempt to decrypt a known value using `vault.decrypt()` in a one-off script.
7. Shred the old key from all records (password manager, notes, etc.).

**Columns that use vault encryption (update this list when new columns land):**

_None yet in v1. This list is populated as Wave 3+ sessions add encrypted columns._

---

## 5. Cost alert triggered

> **When:** Andy receives a cost-alert email from `cost-alerts.ts`.

1. Check `/lite/admin/errors` for any spike in support tickets.
2. In Anthropic console, check daily usage breakdown — identify which job name is
   spiking.
3. If a runaway LLM job: flip `llm_calls_enabled = false` in `settings` table via
   a DB update, or set it in the kill-switches until the root cause is identified.
4. If a cost threshold is wrong (the alert fired too early): update
   `alerts.anthropic_daily_cap_aud` in the `settings` table.

---

## 6. Outreach email stopped (kill-switch)

> **When:** the outreach email dispatcher needs to be halted immediately.

1. Set `outreach_send_enabled = false` in the `settings` table:
   ```sql
   UPDATE settings SET value = 'false' WHERE key = 'outreach_send_enabled';
   ```
2. Verify: check that new outreach jobs are being skipped (look at `activity_log`
   for `outreach_send_skipped` entries).
3. Investigate root cause before re-enabling.

---

## 7. Stripe webhook failures

_Section to be filled in by the session that ships the Stripe webhook handler._

---

## 8. Resend sender suspended / bounce rate spike

_Section to be filled in by the session that ships Resend inbound parsing._

---

## Post-mortems

_Append one paragraph per incident after it is resolved._

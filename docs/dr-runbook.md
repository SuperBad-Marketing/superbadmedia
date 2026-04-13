# SuperBad Lite — Disaster Recovery Runbook

**Owner:** Wave 2 B2 (Backups + DR)
**Last updated:** 2026-04-13
**Related:** `litestream.yml`, `INCIDENT_PLAYBOOK.md §3`

This runbook describes the steps to restore SuperBad Lite from a Litestream
backup in Cloudflare R2. Follow these steps if the Coolify droplet is lost,
the persistent volume is corrupt, or the SQLite file is deleted.

---

## Pre-requisites

Before a real incident, verify you have access to:

- [ ] Coolify admin panel (URL and credentials in password manager).
- [ ] Cloudflare dashboard (for R2 bucket access, if manual download is needed).
- [ ] The four R2 env vars: `R2_BUCKET_NAME`, `R2_ENDPOINT_URL`,
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
- [ ] `litestream` CLI installed on the recovery machine
      (install: `curl -s https://api.github.com/repos/benbjohnson/litestream/releases/latest | ... `
      or from https://litestream.io/install/).

---

## Step 1 — Stop the application

**Why:** Litestream restores into an empty file. If the app is running it may
write to the file while the restore is in progress, causing corruption.

In Coolify, navigate to the SuperBad Lite service and **stop** it.
Confirm the container is stopped before continuing.

---

## Step 2 — Identify the target restore path

The SQLite file lives on the Coolify persistent volume. In production, the
path is the value of `DB_FILE_PATH` (e.g. `/data/db.sqlite`).

SSH into the Coolify droplet:
```bash
ssh root@<droplet-ip>
```

Confirm the volume is mounted and the file path exists (or is empty after a
catastrophic failure):
```bash
ls -lh /data/db.sqlite
```

If the file exists and is corrupt, move it aside before restoring:
```bash
mv /data/db.sqlite /data/db.sqlite.pre-restore-$(date +%s)
```

---

## Step 3 — Restore from R2

Set the R2 credentials as environment variables:
```bash
export R2_BUCKET_NAME="<your-bucket-name>"
export R2_ENDPOINT_URL="https://<account_id>.r2.cloudflarestorage.com"
export R2_ACCESS_KEY_ID="<your-access-key>"
export R2_SECRET_ACCESS_KEY="<your-secret-key>"
```

Run the Litestream restore command (this replays the WAL from R2 into the
target file path):
```bash
litestream restore \
  -o /data/db.sqlite \
  -config /app/litestream.yml \
  s3://${R2_BUCKET_NAME}/db.sqlite
```

Wait for the command to complete. It streams all WAL frames from R2 and
reconstructs the SQLite file locally. Restore time depends on the amount of
data and the time since the last snapshot — typically under 5 minutes for a
small database.

---

## Step 4 — Verify data integrity

After the restore completes, run a quick sanity check:
```bash
sqlite3 /data/db.sqlite "SELECT COUNT(*) FROM users;"
sqlite3 /data/db.sqlite "SELECT COUNT(*) FROM clients;"
sqlite3 /data/db.sqlite "SELECT MAX(created_at_ms) FROM activity_log;"
```

Compare the row counts against the last known state (check recent `activity_log`
entries or your mental model of the data volume).

If the counts look wrong (e.g. 0 rows in a table that had data), do NOT restart
the app. Try restoring to an earlier point in time:
```bash
litestream restore \
  -o /data/db.sqlite \
  -config /app/litestream.yml \
  -timestamp "2026-01-01T12:00:00Z" \
  s3://${R2_BUCKET_NAME}/db.sqlite
```

Replace the timestamp with the last known-good state. Litestream can replay to
any point in time within the retention window (24 hours per `litestream.yml`).

---

## Step 5 — Restart the application

In Coolify, **start** the SuperBad Lite service.

Wait for the health check to pass (usually 30–60 seconds).

Visit `https://superbadmedia.com.au/lite` and sign in. Verify the most recent
records are present (check the last client, the last activity log entry, the
last invoice).

---

## Step 6 — Restart Litestream replication

Litestream runs as a sidecar alongside the Next.js container. If the service
started cleanly in Coolify, Litestream is running. Confirm:
```bash
# In the running container:
ps aux | grep litestream
```

Check Litestream's own logs for any replication errors:
```bash
# In Coolify → Logs tab for the Litestream container / process
```

---

## Restore drill (mandatory before Phase 6 launch)

Per `LAUNCH_READY.md` and `FOUNDATIONS.md §5`, a full restore drill must be
completed before any live billing event is processed. The drill:

1. Spin up a scratch environment (a second Coolify service or a local machine
   with the R2 creds).
2. Follow Steps 2–4 above against the production R2 bucket.
3. Verify row counts match production.
4. Confirm the restore completed in under 60 minutes.
5. Document the result (restore time, row counts, issues found) in
   `INCIDENT_PLAYBOOK.md §3` and tick the drill row in `LAUNCH_READY.md`.

Do not launch without completing this drill. Silent backup failures are more
dangerous than no backups.

---

## ATO 7-year retention

Per Australian Tax Office requirements, financial records (invoices, payments,
subscriptions) must be retained for 7 years. Cloudflare R2 object lifecycle
rules for the backup bucket must be configured to **never expire** objects.

To verify (in Cloudflare dashboard):
1. R2 → your bucket → Settings → Object lifecycle.
2. Confirm no "Delete after N days" rule exists.
3. If no lifecycle rule is set, R2 retains objects indefinitely — correct.

This is a one-time configuration step, not a code change. Confirm it is done
before Phase 6 launch.

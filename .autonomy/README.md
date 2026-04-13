# .autonomy/

Control files for the autonomous Phase 5 build loop. See `AUTONOMY_PROTOCOL.md` for the full protocol.

## Files

- **`PAUSED`** — kill switch. If present, the next cron firing exits silently without running a session. Create this (any content) + `git push` to halt the loop. Delete + push to resume. Critical-flow E2E completions also create this file automatically and require human review before resuming.
- **`LOCK`** — in-flight marker. Contains `{session_id, started_at, commit_sha}` JSON. Present = a session is running. Stale locks (>3h old) are auto-claimed by the next firing.

## Contract

Both files are committed and pushed — the loop relies on git as the coordination substrate. Do not add this directory to `.gitignore`.

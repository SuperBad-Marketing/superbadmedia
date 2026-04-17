# `LG-7` — Lead Gen admin UI (runs log + manual trigger) — Session Brief

> **Pre-compiled by LG-6 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `LG-7`
- **Wave:** `13 — Lead Generation` (7 of 10)
- **Type:** `UI`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `large` (UI session with mockup)
- **G0.5 input budget estimate:** ~28k tokens (brief + excerpts + mockup-admin-interior.html excerpt + last 2 handoffs). Under 35k.

> **Scope note from LG-6 brief-writer:** The LG-6 brief §10 listed DNC management and metrics panel as part of LG-7. These are deferred here to keep this session within G0.5 budget and avoid mid-session compaction. LG-7 covers: runs log tab + manual run trigger only. DNC surface → LG-8. Metrics panel → later (likely LG-9).

---

## 2. Spec excerpts

### Excerpt 1 — Runs log tab §14.1

Source: `docs/specs/lead-generation.md` §14.1

```
Table of the last 30 lead_runs rows:
| Date | Trigger | Found | DNC filtered | Qualified | Drafted | Sent | Opened | Clicked | Replied | Approval rate |

Click a row → expands inline to show the list of lead_candidates created by that run,
their viability profiles, their scores, and their eventual outcomes
(sent/rejected/superseded/unsubscribed/bounced).

No filters, no sorts. Closed list.

§12.M — Metrics queries are pure reads. No mutations, no side effects.
```

### Excerpt 2 — Manual run trigger (from spec §3.4 and orchestrator contract)

Source: `docs/specs/lead-generation.md` §3.4 + `app/api/cron/lead-gen-daily/route.ts`

```
The cron endpoint at POST /api/cron/lead-gen-daily accepts trigger = 'run_now' | 'scheduled' | 'manual_brief'.
"Run now" button → POST /api/cron/lead-gen-daily with { trigger: 'run_now' }.
Same warmup cap applies.
Run is logged in lead_runs with the trigger value.
```

### Excerpt 3 — lead_runs schema (from LG-1 output)

Source: `docs/specs/lead-generation.md` §4.5

```
lead_runs: id, trigger, started_at_ms, completed_at_ms, found_count, dedup_filtered_count,
dnc_filtered_count, qualified_count, drafted_count, sent_count, capped_reason,
effective_cap_at_run, error, per_source_errors (json), manual_brief_text
```

### Excerpt 4 — lead_candidates columns needed for the expanded row view

Source: `docs/specs/lead-generation.md` §4.1

```
lead_candidates: id, run_id (fk lead_runs.id), business_name, domain, location, phone,
source (google_maps | meta_ad_library | google_ads_transparency),
qualified_track (saas | retainer | null), saas_score, retainer_score,
scoring_debug_json, viability_profile_json, status
(pending_review | approved | rejected | superseded | sent | opened | clicked | replied | unsubscribed | bounced)
```

---

## 2a. Visual references

- `mockup-admin-interior.html` — binding reference for all `/lite/admin/**` interior surfaces. Follow the table pattern, card chrome, typography, and ambient environment shown there. Read the file at G0.
- `docs/superbad_brand_guidelines.html` — brand palette + typography.

**Intentional divergences:** none — follow the mockup strictly.

---

## 3. Acceptance criteria

```
LG-7 is done when:

1. Route exists: app/lite/admin/lead-gen/page.tsx
   - Page title: "Lead Generation"
   - Two tabs: "Runs" (default) and "Run now" button in the header area

2. Runs tab:
   - Server component fetches last 30 lead_runs rows from db, ordered by started_at_ms DESC
   - Renders as a table with columns: Date, Trigger, Found, DNC filtered, Qualified, Cap reason
   - Each row is clickable to expand inline (client component accordion)
   - Expanded row shows lead_candidates for that run_id: business_name, domain, qualified_track, saas_score, retainer_score, status
   - Empty state when no runs exist: "No runs yet. Click 'Run now' to start."

3. "Run now" button:
   - Client component button in page header
   - On click: POST /api/cron/lead-gen-daily with body { trigger: 'run_now' }
   - Sends x-cron-secret header (read from process.env.CRON_SECRET on the client via a server action — do NOT expose the secret client-side directly)
   - Loading state while request is in-flight
   - On success: toast "Run started — check back in a minute" + router.refresh()
   - On error: toast error message from response

4. Server action: app/lite/admin/lead-gen/actions.ts
   - triggerManualRun(): calls the cron endpoint server-side (server action keeps secret safe)
   - Returns { ok: boolean; error?: string }

5. npx tsc --noEmit → 0 errors
6. npm test → green
7. npm run build → clean
8. npm run lint → clean
9. G10 manual browser check: dev server on :3001, /lite/admin/lead-gen renders, empty state visible
10. G10.5 sub-agent reviewer: PASS or PASS_WITH_NOTES
```

---

## 4. Skill whitelist

- `data-tables-crm` — accordion/expand patterns for the runs table
- `tailwind-v4` — correct v4 syntax for all styling

---

## 5. File whitelist (G2 scope discipline)

- `app/lite/admin/lead-gen/page.tsx` — new — main page (server component)
- `app/lite/admin/lead-gen/actions.ts` — new — server action for manual run trigger
- `app/lite/admin/lead-gen/RunsTable.tsx` — new — client component (accordion rows)
- `app/lite/admin/lead-gen/RunNowButton.tsx` — new — client component (button + toast)

---

## 6. Settings keys touched

- **Reads:** none
- **Seeds:** none

---

## 7. Preconditions (G1)

- [ ] `lib/db/schema/lead-runs.ts` exports `leadRuns` — verify: `grep "export const leadRuns" lib/db/schema/lead-runs.ts`
- [ ] `lib/db/schema/lead-candidates.ts` exports `leadCandidates` — verify: `grep "export const leadCandidates" lib/db/schema/lead-candidates.ts`
- [ ] `app/api/cron/lead-gen-daily/route.ts` exists — verify: `ls app/api/cron/lead-gen-daily/route.ts`
- [ ] `CRON_SECRET` declared in `.env.example` — verify: `grep "CRON_SECRET" .env.example`
- [ ] `app/lite/admin/` directory exists with AdminShell — verify: `ls app/lite/admin/`
- [ ] `npx tsc --noEmit` passes before starting

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — new UI pages only, no migrations. Rollback = `git revert`.

---

## 9. Definition of done

- [ ] `app/lite/admin/lead-gen/page.tsx` exists
- [ ] `app/lite/admin/lead-gen/actions.ts` exists with `triggerManualRun()`
- [ ] `app/lite/admin/lead-gen/RunsTable.tsx` exists
- [ ] `app/lite/admin/lead-gen/RunNowButton.tsx` exists
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10: dev server on :3001, `/lite/admin/lead-gen` renders (empty state acceptable)
- [ ] G10.5 sub-agent reviewer verdict attached to handoff
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-8)

LG-8 is the DNC (Do Not Contact) management surface:
- Location: Settings → Lead Generation → Do Not Contact
- Three tabs: Companies (read-only list), Emails (add/remove), Domains (add/remove)
- Key tables: `dnc_emails`, `dnc_domains`, `companies.do_not_contact`
- `isBlockedFromOutreach()` is the ONLY read path (§12.J — never query dnc tables directly in UI)
- All writes normalise to lowercase + trim before insert (§12.K)
- Bulk-add textarea for emails and domains tabs
- Companies tab unblocking routes through the Company profile (not a direct toggle here)
- Key spec reference: `docs/specs/lead-generation.md` §12.4
- Schema: check `lib/db/schema/dnc-emails.ts` and `lib/db/schema/dnc-domains.ts`

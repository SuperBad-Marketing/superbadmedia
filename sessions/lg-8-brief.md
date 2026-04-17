# `LG-8` — Lead Gen DNC management surface — Session Brief

> **Pre-compiled by LG-7 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `LG-8`
- **Wave:** `13 — Lead Generation` (8 of 10)
- **Type:** `UI`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`
- **G0.5 input budget estimate:** ~22k tokens (brief + excerpts + mockup-admin-interior.html excerpt + last 2 handoffs). Under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — DNC management surface §12.4

Source: `docs/specs/lead-generation.md` §12.4

```
### 12.4 Management surface

**Location:** Settings → Lead Generation → Do Not Contact

Three tabs (Companies / Emails / Domains), each with:
- Entry count at the top
- Search box
- Scrollable list with source + added_at + unblock button
- Single-add input + bulk-paste textarea (emails and domains tabs only)

Companies tab is read-only on the list itself — unblocking routes through
the Company profile for safety (forces a deliberate action).
```

### Excerpt 2 — DNC build-time disciplines §12.5

Source: `docs/specs/lead-generation.md` §12.5

```
- §12.J — isBlockedFromOutreach() is the only read path. No direct queries on
  dnc_emails, dnc_domains, or companies.do_not_contact from anywhere except
  this function and the management surface.
- §12.K — All writes normalise email/domain to lowercased + trimmed before insert.
  Uniqueness enforced at the DB layer.
- §12.L — Unsubscribe tokens are signed server-side. No unsigned unsubscribe URLs.
```

### Excerpt 3 — DNC write sources (from spec §12.3 writer table)

Source: `docs/specs/lead-generation.md` §12.3

```
| Manual DNC management surface | dnc_emails, dnc_domains, companies.do_not_contact |
  Settings → Lead Generation → Do Not Contact
| CSV import | dnc_emails or dnc_domains | Via bulk-add textarea in management surface
```

### Excerpt 4 — DNC schema §4.6

Source: `docs/specs/lead-generation.md` §4.6

```
dnc_emails: id, email (unique), reason, source (unsubscribe_link|manual|csv_import|complaint),
  added_at, added_by (fk user.id)

dnc_domains: id, domain (unique), reason, added_at, added_by (fk user.id)

Company-level DNC lives on companies.do_not_contact (already defined in Pipeline spec §4).
```

**Audit footer:**
- `docs/specs/lead-generation.md` §12 — full DNC enforcement rules

---

## 2a. Visual references

- `mockup-admin-interior.html` — binding reference for all `/lite/admin/**` interior surfaces. Follow table pattern, card chrome, typography, ambient environment.
- `docs/superbad_brand_guidelines.html` — brand palette + typography.

**Intentional divergences:** none — follow mockup strictly.

---

## 3. Acceptance criteria

```
LG-8 is done when:

1. Route exists: app/lite/admin/settings/lead-gen/page.tsx
   - Page title: "Do Not Contact"
   - Three tabs: Companies | Emails | Domains (client component tab switcher)

2. Companies tab (read-only):
   - Server fetches companies WHERE do_not_contact = true, ordered by name
   - List rows: company_name, a note "Unblock via Company profile"
   - Empty state: voiced empty state (no blocked companies)
   - NO add/remove controls (read-only per spec §12.4 safety rule)

3. Emails tab:
   - Server fetches all dnc_emails ordered by added_at DESC
   - List rows: email, source chip, added_at relative time, Remove button
   - Single-add input: email text field + "Add" button (validates email format)
   - Bulk-add textarea: accepts newline-separated emails + "Add all" button
   - All writes: normalise to lowercase + trim (§12.K)
   - Remove: calls removeDncEmail() server action

4. Domains tab:
   - Server fetches all dnc_domains ordered by added_at DESC
   - List rows: domain, added_at relative time, Remove button
   - Single-add input: domain text field + "Add" button
   - Bulk-add textarea: accepts newline-separated domains + "Add all" button
   - All writes: normalise to lowercase + trim (§12.K)
   - Remove: calls removeDncDomain() server action

5. Server actions: app/lite/admin/settings/lead-gen/actions.ts
   - addDncEmails(emails: string[]): normalises, calls addDncEmail() per item, returns { ok, added, skipped, errors }
   - removeDncEmailById(id: string): calls removeDncEmail(), returns { ok }
   - addDncDomains(domains: string[]): normalises, calls addDncDomain() per item, returns { ok, added, skipped, errors }
   - removeDncDomainById(id: string): calls removeDncDomain(), returns { ok }

6. npx tsc --noEmit → 0 errors
7. npm test → green
8. npm run build → clean
9. npm run lint → clean
10. G10 manual browser check: dev server on :3001, /lite/admin/settings/lead-gen renders
11. G10.5 sub-agent reviewer: PASS or PASS_WITH_NOTES
```

---

## 4. Skill whitelist

- `tailwind-v4` — correct v4 syntax for all styling
- `data-tables-crm` — list patterns, add/remove form patterns

---

## 5. File whitelist (G2 scope discipline)

- `app/lite/admin/settings/lead-gen/page.tsx` — new — main page (server component)
- `app/lite/admin/settings/lead-gen/actions.ts` — new — server actions for add/remove
- `app/lite/admin/settings/lead-gen/DncTabs.tsx` — new — client component (tab switcher + all three tab UIs)

---

## 6. Settings keys touched

- **Reads:** none
- **Seeds:** none

---

## 7. Preconditions (G1)

- [ ] `lib/db/schema/dnc.ts` exports `dncEmails`, `dncDomains` — verify: `grep "export const dncEmails\|export const dncDomains" lib/db/schema/dnc.ts`
- [ ] `lib/lead-gen/dnc.ts` exports `addDncEmail`, `addDncDomain`, `removeDncEmail`, `removeDncDomain` — verify: `grep "export async function" lib/lead-gen/dnc.ts`
- [ ] `companies.do_not_contact` column in schema — verify: `grep "do_not_contact" lib/db/schema/companies.ts`
- [ ] `app/lite/admin/settings/` directory exists — verify: `ls app/lite/admin/settings/`
- [ ] `npx tsc --noEmit` passes before starting

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — new UI pages + server actions only, no migrations. Rollback = `git revert`.

---

## 9. Definition of done

- [ ] `app/lite/admin/settings/lead-gen/page.tsx` exists
- [ ] `app/lite/admin/settings/lead-gen/actions.ts` exists with all 4 server actions
- [ ] `app/lite/admin/settings/lead-gen/DncTabs.tsx` exists
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10: dev server on :3001, `/lite/admin/settings/lead-gen` responds
- [ ] G10.5 sub-agent reviewer verdict attached to handoff
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-9)

LG-9 is the outreach drafting + send pipeline (the session that actually wires the Hunter.io email lookup + outreach template render + `pending_review` approval flow). Key context:
- `lib/lead-gen/orchestrator.ts` returns `qualified_count` but does NOT yet insert `lead_candidates` rows (PATCHES_OWED: `lg_4_lead_candidates_not_inserted_by_orchestrator`). LG-9 should clarify whether to back-fill this or insert rows at draft time.
- Outreach template rendering lives in `lib/lead-gen/prompts/` (stubs from LG-3).
- The approval flow writes to `lead_candidates.promoted_to_deal_id` via `createDealFromLead()`.
- Kill-switch: `lead_gen_enabled` in `lib/kill-switches.ts`.
- Key spec reference: `docs/specs/lead-generation.md` §7 (outreach drafting), §8 (approval flow), §9 (send pipeline).
- The candidate status chip in `RunsTable.tsx` (LG-7) will need updating once real status values exist (PATCHES_OWED: `lg_7_candidate_status_surrogate`).

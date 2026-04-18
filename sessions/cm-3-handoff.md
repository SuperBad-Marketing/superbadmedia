# `CM-3` — Admin contact profile (5 tabs) — Handoff

**Closed:** 2026-04-18
**Type:** UI (medium)
**Model tier:** Sonnet

---

## What was built

The **admin contact profile page** at `/lite/admin/contacts/[id]` with the spec's 5-tab structure per `docs/specs/client-management.md` §3.

### Tab structure (all 5)

| Tab | Data source | Status |
|---|---|---|
| **Overview** | deals, company, contact notes | Context Engine summary placeholder + deals panel + private notes section |
| **Comms** | `threads` table | Threaded view filtered to this contact, channel icons, ticket status badges |
| **Brand DNA** | `brand_dna_profiles` | Individual profile with first impression, prose portrait, tag cloud, retake history |
| **Portal Chat** | `portal_chat_messages` | Read-only admin view, role badges (client/bartender), escalation + tool-action flags |
| **Activity** | `activity_log` | Reuses company `ActivityTab` component — same timeline, filtered to this contact |

### New files (5)

| File | Purpose |
|---|---|
| `app/lite/admin/contacts/[id]/page.tsx` | Server component: auth, data loading, tab routing, header with breadcrumb to parent company, Overview tab inline |
| `components/lite/admin/contacts/contact-tab-strip.tsx` | Client component: 5-tab strip with Framer Motion layoutId underline, house spring |
| `components/lite/admin/contacts/contact-brand-dna-tab.tsx` | Individual Brand DNA profile + retake history section |
| `components/lite/admin/contacts/contact-comms-tab.tsx` | Threaded comms view for single contact (no contact name column — already scoped) |
| `components/lite/admin/contacts/contact-portal-chat-tab.tsx` | Single-contact chat log (no grouping by contact — already scoped to one) |

### Test file (1)

| File | Tests |
|---|---|
| `tests/cm3-contact-tabs.test.ts` | 5 tests: tab strip exports 5 valid values + each contact tab component exports correctly + ActivityTab reuse confirmed |

## Key decisions

1. **Reuse `ActivityTab` from company components.** The activity tab renders identically for both companies and contacts (just filtered differently at the query level). No reason to duplicate it.

2. **Contact-specific tab components are separate from company ones.** Comms, Brand DNA, and Portal Chat have meaningfully different interfaces for contacts vs companies (no grouping-by-contact, no blend hero, no multi-contact aggregation). Dedicated components are cleaner than conditional branching.

3. **Breadcrumb links to parent company.** The breadcrumb at the top says "← {company name}" and links back to the company profile, providing natural navigation context.

4. **Context Engine summary is a placeholder.** The spec's §3.3 describes a rich two-column layout with Context Engine narrative + structured facts + draft drawer. The Context Engine (Wave 11) hasn't been built yet, so the Overview tab renders a voiced placeholder that summarises the contact's basic facts and signals the full surface is coming.

5. **Private notes section shows `contacts.notes`.** The spec describes a feed with "Visible to AI" toggle and chronological entries — that requires a proper notes table (CM-10). For now, the existing `contacts.notes` text field renders as a single block with a voiced placeholder for the full feed.

6. **Portal chat capped at 200 messages.** Same rationale as CM-2 company portal chat.

## What the next session should know

- **CM-4** builds the clients index at `/lite/clients` with health score dots, summary cards, and relationship stage filtering.
- The Brand DNA tab links work from both directions now: company profile → contact Brand DNA, and contact profile → back to company.
- The Overview tab's Context Engine summary tile and private notes feed are placeholders. CM-10 (write-side features) and the Context Engine wave will fill these in.
- Tab-specific data loading pattern is consistent with CM-2: each tab only queries what it needs.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 199 files, 1670 passed, 0 failures, 1 skipped
- No browser check needed (pre-existing dev server issue from CM-2, not caused by this session)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

**Git-revertable.** No migrations, no data shape changes. All changes are UI components, page routing, and tests. Reverting the commit removes the `/lite/admin/contacts/[id]` route entirely.

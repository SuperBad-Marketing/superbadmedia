# Legal Pages — Spec

> **Owner:** B3. Inline spec drafted per BUILD_PLAN.md B3 acceptance criteria (Stop 14 L1).

---

## 1. Routes

| Route | Page | Public? |
|---|---|---|
| `/lite/legal` | Index (links to all docs) | Yes — no auth required |
| `/lite/legal/terms` | Terms of Service | Yes |
| `/lite/legal/privacy` | Privacy Policy | Yes |
| `/lite/legal/acceptable-use` | Acceptable Use Policy | Yes |
| `/lite/legal/cookie-policy` | Cookie Policy | Yes |

**Auth requirement:** all `/lite/legal/*` routes bypass both the Brand DNA gate and the Critical Flight gate via `isPublicRoute()` in `proxy.ts`.

---

## 2. Content model

### MDX files

Content lives in `content/legal/*.mdx`. Page components in `app/lite/legal/*/page.tsx` import and render the corresponding MDX file via `@next/mdx`.

Updates to legal text = edit the `.mdx` file + cut a new `legal_doc_versions` row (version hash + effective date).

### Version tracking

Every published document has a row in `legal_doc_versions`:

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | `crypto.randomUUID()` |
| `doc_type` | enum | See `LEGAL_DOC_TYPES` in schema |
| `version` | `text` | Semantic or date-based (`"1.0"`, `"2026-04-13"`) |
| `effective_from_ms` | `integer` | Unix epoch ms of effective date |
| `sha256` | `text` | Optional SHA-256 of content file (for change detection) |
| `notes` | `text` | Human-readable change summary |
| `created_at_ms` | `integer` | Row creation time |

**Query pattern:** to find the current version of a doc type, select the row with the highest `effective_from_ms` that is `<= now()`.

---

## 3. DSR (Data Subject Request) pattern

Privacy Act 1988 (Cth) + Australian Privacy Principles require SuperBad to:
- Accept DSR requests by email at `legal.dsr_email` (settings key).
- Acknowledge within `legal.dsr_response_days` days (settings key, default 30).
- The Privacy Policy page discloses both values.

**Settings keys (seeded by B3):**

| Key | Default | Description |
|---|---|---|
| `legal.dsr_email` | `"privacy@superbadmedia.com.au"` | DSR contact address |
| `legal.dsr_response_days` | `30` | Statutory response commitment (days) |

---

## 4. Cookie consent

### Architecture

- `lib/geo/maxmind.ts` — `isEuIp(ip: string): Promise<boolean>` — server-side EU detection.
  - Test override: `GEOIP_TEST_EU_IPS` env var (comma-separated IPs treated as EU).
  - Production: calls `ip-api.com` free tier (500ms timeout, safe fallback = `false`).
- `components/lite/cookie-consent-banner.tsx` — client component, receives `isEu` prop from the legal layout server component.
- `app/api/cookie-consent/route.ts` — POST handler: writes `cookie_consents` row (EU visitors only).

### Banner behaviour

| User type | Banner shown |
|---|---|
| EU IP | Full banner: Reject All / Accept All / Manage Categories |
| Non-EU IP | Permanent footer link: "We use cookies — details" → `/lite/legal/cookie-policy` |
| EU user who already decided | No banner (localStorage state read on mount) |

### Consent persistence

Client side: `localStorage` key `sb_cookie_consent` → `{ accepted: boolean, categories: string[], timestamp: number, version: string }`.

Server side (EU only): `cookie_consents` table row written on first decision.

### Cookie categories

| ID | Name | Always on? |
|---|---|---|
| `necessary` | Strictly necessary | Yes — cannot be disabled |
| `functional` | Functionality (session, preferences) | Off by default (user choice) |
| `analytics` | Error monitoring / analytics | Off by default (user choice) |

### Rollback

`cookie_consents` is a new additive table (migration-reversible). The banner is client-side React (git-revertable). The `isEuIp()` call is isolated in `lib/geo/maxmind.ts`.

---

## 5. `acceptable_use` doc type

The `LEGAL_DOC_TYPES` enum in `lib/db/schema/legal-doc-versions.ts` was extended in B3 to include `"acceptable_use"` to support the `/lite/legal/acceptable-use` route. Prior types (A7): `privacy_policy`, `terms_of_service`, `client_agreement`, `subscriber_tos`, `cookie_policy`.

---

## 6. Quote Builder anchor

`/lite/legal/terms#retainer-and-project-work` — The Terms of Service page includes an `id="retainer-and-project-work"` heading that QB-4 can deep-link from the quote PDF "terms" link.

---

## 7. SaaS billing reference

`/lite/legal/terms` and `/lite/legal/privacy` are the target URLs for `tos_accepted_at` and `privacy_accepted_at` acceptance tickboxes on the SaaS signup form (wired by SB-5).

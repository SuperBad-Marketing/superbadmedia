# Setup Wizards — Feature Spec

**Phase 3 output. Locked 2026-04-13. 11 questions resolved.**

Setup Wizards is a cross-cutting primitive: every integration, configuration, and multi-step setup task in Lite runs through a shared wizard shell. No raw forms, no self-serve config panels, no "here's a page with 12 fields, good luck." Every setup is hand-held, step-by-step, with save-and-resume, a completion ceremony, and a typed completion contract that enforces what the wizard actually produced.

This spec is foundational infrastructure — same shape as `scheduled_tasks`, `sendEmail()`, or the Observatory registry. It owns the shell, the step-type library, the data model, and the integration contract with the Observatory. Every consuming spec (SaaS product setup, Content Engine onboarding, Unified Inbox Graph API, Onboarding + Segmentation, Brand DNA assessment entry, plus ~7 admin integrations) defines its own wizard *content* but renders through this primitive.

---

## 1. Locked decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Scope of the primitive | Library-as-primitive. This spec owns the shell, step-type library, completion registry, Observatory contract. Consuming specs define wizard content. Retroactive patches owed to 4 specs that described wizards inline. |
| Q1b | How wizards are guaranteed functional | Four-gate discipline: (1) Completion contracts per wizard in §5; (2) Phase 4 breaks each wizard into its own build session; (3) Per-session verification against real vendor + E2E test + contract-shape typecheck; (4) Phase 6 LAUNCH_READY checklist row per wizard. Shell refuses to mark complete without required artefacts. |
| Q2 | Rendering surface | Slideover (C) as default for creating new connections / modifying existing. Dedicated route (A) as exception for flagship (Brand DNA, Onboarding + Segmentation) and for wizards launched from email or cockpit health banners. Centred modals never used. |
| Q3 | Step-type library granularity | Medium (~10 named types) + custom-step escape hatch via `<WizardStep.Custom>`. Types defined in §4. |
| Q4 | Save-and-resume model | Auto-save every step, deep-link resume URLs, 24h email nudge + 7d cockpit health banner (admin only) + 30-day expiry with warning at day 29. Non-resumable steps marked `resumable: false` rewind to last safe step. |
| Q5 | Observatory registry contract | Automatic on completion, visible post-completion summary on celebration step. Vendor manifest at `lib/integrations/vendors/<vendor>.ts` is the source of truth; `registerIntegration()` consumes it; shell refuses completion without it. |
| Q6 | Admin vs client shell | One shell, `audience: 'admin' \| 'client'` prop switches tone — spacing, copy register, ceremony intensity, sprinkle eligibility. |
| Q7 | First-run admin onboarding | Hybrid. Critical flight (~3 mandatory wizards: Stripe, Resend, Graph API) on first sign-in, then cockpit. Rest surface lazily as needed. `/lite/integrations` is a browsable hub. |
| Q8 | Voice & delight | Voice on every step + full completion ceremony + first-run capstone ("SuperBad is open for business."). Sprinkle claim: browser tab titles on wizard surfaces. New motion slot `motion:wizard_completion` (Tier-2) + new sound slot `sound:wizard_complete` (registry 8 → 9). First-run capstone either inherits an existing flagship motion slot or spends one new Tier-1 slot — design-system revisit decides. |
| Q9 | Help escalation | Contextual after two consecutive step failures. Client-facing wizards route to portal bartender chat with wizard context. Admin wizards open a Claude chat (new Opus job `admin-setup-assistant`) with wizard state, error payload, thread persistence. No ambient always-visible help link. |
| Q10 | Completion as signal | Shell emits typed completion events always. Curated subset (5 client-facing wizards: Brand DNA finished, SaaS onboarding finished, Intro Funnel questionnaire, retainer client first portal sign-in, any wizard with a human-reply-owed outcome) also surfaces as Daily Cockpit attention-rail chips. |
| Q11 | Honest gap check | No gaps surfaced. |

---

## 2. Architecture overview

### 2.1 Surface hierarchy

```
Shell (routing, save-resume, progress, cancel, audience tone)
  └── Wizard instance (a specific wizard: Stripe, Pixieset, Brand DNA, etc.)
       └── Step instance (one screen in the wizard, rendered from step-type library)
            └── Step type (form | oauth-consent | api-key-paste | webhook-probe | dns-verify |
                         csv-import | async-check | content-picker | review-and-confirm |
                         celebration | custom)
```

### 2.2 Rendering modes

- **Slideover mode** (default). Parent surface stays behind with backdrop blur. Width: 60% desktop, 100% mobile. Motion: house spring on open/close.
- **Dedicated route mode** (flagship + email/banner-launched). Full-page takeover at `/lite/setup/:wizardKey` or per-wizard canonical URL.
- **Resume behaviour**: slideover and dedicated-route modes both land at `:wizardKey?step=N` URLs. Shell checks `wizard_progress` on mount; if an in-flight row exists, auto-resumes at the last completed step without a prompt. "Start over" link in step header resets.

### 2.3 Audience tone

Single shell, `audience` prop drives:

| Dimension | `admin` | `client` |
|---|---|---|
| Spacing scale | Compact | Generous |
| Copy register | Terse, function-first ("Connect Pixieset.") | Branded, company-for-the-task ("Alright — let's connect your Pixieset so we can pull your galleries automatically.") |
| Celebration step | Quiet check + outro line + sound | Cinematic motion + sound + branded line + capstone if first-run |
| Tab-title sprinkle | Enabled | Enabled |
| Ambient voice surfaces | Minimal (Andy sees them too often) | Full |
| First-run capstone | Fires once per account on critical-flight completion | N/A |

---

## 3. The wizard shell

### 3.1 Shell responsibilities

- Route to the correct wizard by `wizardKey`.
- Hydrate `wizard_progress` state on mount; seed a new row if none.
- Render the progress indicator (slim horizontal segmented bar at top; step labels on hover/tap; no percentage text).
- Render the active step via the step-type library.
- Handle step transitions: `onNext()` commits the current step, writes `wizard_progress.current_step`, advances.
- Handle cancel: confirmation modal with abandon-vs-save-for-later options. Abandon writes `wizard_progress.abandoned_at`. Save-for-later closes the surface without clearing state.
- Call `onComplete(payload)` when the final step (always `celebration`) confirms. `onComplete` runs the completion contract typecheck — rejects if required artefacts are missing — and only then writes `wizard_completions`, fires the typed completion event, and triggers the curated cockpit chip (if applicable).
- Pass `audience` tone down the tree.
- Enforce skill-loading: shell never imports vendor SDKs directly (that lives in `lib/integrations/vendors/<vendor>.ts`).

### 3.2 Shell API (consumer-facing)

```ts
// Every wizard exports a WizardDefinition:
type WizardDefinition<TCompletionPayload> = {
  key: string                               // 'stripe-admin', 'pixieset', 'brand-dna', etc.
  audience: 'admin' | 'client'
  renderMode: 'slideover' | 'dedicated-route'
  steps: WizardStepDefinition[]
  completionContract: CompletionContract<TCompletionPayload>
  vendorManifest?: VendorManifest           // required for integration wizards
  voiceTreatment: {
    introCopy: string | ((ctx) => string)
    outroCopy: string | ((ctx) => string)
    tabTitlePool: TabTitlePool               // claims sprinkle
    capstone?: CapstoneConfig                // only first-run admin critical flight
  }
}
```

Consuming specs reference their `WizardDefinition` by import path. The shell discovers wizards at boot via a manifest in `lib/wizards/registry.ts`.

### 3.3 Completion contract (typechecker-enforced)

```ts
type CompletionContract<T> = {
  required: (keyof T)[]                      // keys that MUST be present in payload
  verify: (payload: T) => Promise<
    { ok: true } | { ok: false, reason: string }
  >                                           // wizard-specific verification (real vendor call)
  artefacts: {
    integrationConnections?: true             // row required in integration_connections
    observatoryBands?: true                   // bands required in registry
    activityLog?: ActivityLogKind             // specific log entry required
  }
}
```

Shell's `onComplete` runs `verify()` against the real vendor **before** marking complete. If `verify()` fails, step rewinds one state and shows the error to the user (not a technical stack trace — a branded "that didn't work, let's try again" with the help-escalation affordance if two consecutive failures).

---

## 4. Step-type library (10 + custom)

Ten named step primitives cover 90% of wizards. Eleventh is a custom escape hatch.

| # | Type | Purpose | Resumable |
|---|---|---|---|
| 1 | `form` | Any set of fields with Zod schema validation. Includes inline errors. | yes |
| 2 | `oauth-consent` | Handles OAuth redirect flows. Renders "Continue to [Vendor]" CTA; on return, completes step with token payload. | **no** (rewinds to prior step on resume) |
| 3 | `api-key-paste` | Single/multi API-key paste with immediate test-call verification. Shows key-prefix after success. | yes |
| 4 | `webhook-probe` | Waits for a webhook event to arrive from the vendor within a timeout. Shows pulse animation. | **no** |
| 5 | `dns-verify` | Checks DNS records against expected values, retries every 10s, times out at 10min. Shows current state + copy-to-clipboard for records to add. | **no** |
| 6 | `csv-import` | Upload + preview + field-map + confirm. Uses shared import utility. | yes (at preview stage; before upload = start over) |
| 7 | `async-check` | Waits for an async backend job (historical import, worker verification) to complete. Polls `scheduled_tasks` by key. | yes |
| 8 | `content-picker` | Specialised for shape-shuffler style choices (Brand DNA, Intro Funnel branches). Renders 3-option card grid. | yes |
| 9 | `review-and-confirm` | Shows a summary of all prior step outputs; single "confirm" CTA. | yes |
| 10 | `celebration` | Always the final step. Renders the completion ceremony: motion + sound + outro copy + post-completion Observatory summary (for integration wizards) + "done" CTA. | N/A |
| 11 | `<WizardStep.Custom>` | Escape hatch. Renders arbitrary JSX inside the shell chrome (progress bar, cancel, help). Used for bespoke moments: Brand DNA's shape shuffler rendering, Intro Funnel's Payment Element reveal, etc. | declared per-use |

Step types are defined in `lib/wizards/steps/<type>.tsx`. Each exports a `<Step>` component + a `StepSchema` type.

---

## 5. Wizard inventory (with completion contracts)

~12 wizards at spec time. Each requires a vendor manifest (integration wizards) + completion contract. Consuming specs patch their existing inline wizard descriptions to point at this inventory.

### 5.1 Admin integration wizards (8)

| Key | Audience | Render | Completion contract |
|---|---|---|---|
| `stripe-admin` | admin | slideover | Row in `integration_connections.stripe`, webhook endpoint registered + test webhook received, bands registered for `stripe.*` jobs, test API call logged. |
| `resend` | admin | slideover | API key stored encrypted, test email sent to Andy, SPF/DKIM/DMARC records displayed, band registered. |
| `graph-api-admin` | admin | slideover | OAuth tokens stored for admin mailbox, historical-import enqueued, webhook subscription active, band registered. |
| `pixieset` | admin | slideover | Credentials stored, test gallery-fetch succeeds, band registered, `connection_verified_at` stamped. |
| `meta-ads` | admin | slideover | OAuth tokens stored, ad account ID confirmed, test campaign fetch, band registered. |
| `google-ads` | admin | slideover | OAuth tokens stored, customer ID confirmed, test campaign fetch, band registered. |
| `twilio` | admin | slideover | API creds stored, SMS sending number provisioned + verified, band registered. |
| `serp-api` / `openai-images` / `anthropic` / `remotion` | admin | slideover | Shared template: API key paste → test call → band registered. Can ship as a single parameterised "generic API-key integration" wizard rather than one file per vendor. |

### 5.2 Admin config wizards (2)

| Key | Audience | Render | Completion contract |
|---|---|---|---|
| `domain-verify` | admin | slideover | DNS records set, TLS cert issued (or queued), domain reachable, row in `domains` table. (Used for client websites if/when they get built — deferred per memory but shell is ready.) |
| `saas-product-setup` | admin | slideover | Product + tiers + pricing + feature flags persisted, Stripe Products/Prices auto-created, feature row in `saas_products`, activity logged. (Defined in SaaS Subscription Billing spec Q18; this spec owns the shell.) |
| `finance-tax-rates` (added 2026-04-13 Phase 3.5) | admin | slideover | Two `numeric_preset` inputs writing `finance.gst_rate` (default 0.10) and `finance.income_tax_rate` (default 0.25) to the `settings` table. Step belongs inside the primary admin-onboarding wizard chain as a step, not a standalone wizard — exposed here for registry completeness. (Required by Finance Dashboard's tax provision tile.) |

### 5.3 Client-facing wizards (5)

| Key | Audience | Render | Completion contract |
|---|---|---|---|
| `brand-dna` | client | dedicated route | Full Brand DNA profile written to `brand_dna_profiles`, signal tags computed, portrait generated, first impression generated, activity logged. (Defined in Brand DNA spec; this spec owns the shell.) |
| `content-engine-onboarding` | client | slideover | Content Engine's three-step output: segment verified, keyword brief initial run, domain-connect stage reached. (Defined in Content Engine spec.) |
| `graph-api-client` | client | slideover | Subscriber's OAuth tokens stored per mailbox, historical import enqueued, routing review deferred to post-import. (Defined in Unified Inbox spec.) |
| `onboarding-segmentation` | client | dedicated route | Segmentation completed, practical setup done, profile marked complete. (Defined in Onboarding + Segmentation spec.) |
| `intro-funnel-questionnaire` | client | dedicated route | Reflection questionnaire completed, Claude synthesis run. (Defined in Intro Funnel spec.) |

### 5.4 Growth-bank wizards (deferred)

Any wizard named in a future spec inherits this shell automatically. No new shell work needed for future integrations — they write their own `WizardDefinition`, vendor manifest (if integration), and inventory row.

---

## 6. Data model

### 6.1 New tables

**`wizard_progress`** — in-flight wizard state.

```
id                text pk
wizard_key        text not null          -- matches WizardDefinition.key
user_id           text not null fk       -- admin or client
audience          text not null          -- 'admin' | 'client'
current_step      integer not null       -- 0-indexed
step_state        json                   -- accumulated output from completed steps
started_at        timestamp not null
last_active_at    timestamp not null
abandoned_at      timestamp nullable
expires_at        timestamp not null     -- started_at + settings.wizards.expiry_days
resumed_count     integer default 0
```

One row per (user, wizard_key) in-flight. Unique constraint on `(user_id, wizard_key)` where `abandoned_at IS NULL` — you can't have two in-flight copies of the same wizard for the same user.

**`wizard_completions`** — ledger of completed wizards.

```
id                text pk
wizard_key        text not null
user_id           text not null fk
audience          text not null
completion_payload json not null         -- the typed completion contract payload
contract_version  text not null          -- hash of the completion contract shape at time of completion
completed_at      timestamp not null
```

Allows repeat completions (e.g. `graph-api-client` run once per mailbox; a subscriber might complete it 3 times with 3 mailboxes). No uniqueness constraint on `(user_id, wizard_key)`.

**`integration_connections`** — shared primitive for all integration wizards.

```
id                    text pk
vendor_key            text not null        -- 'stripe', 'pixieset', 'graph-api', etc.
owner_type            text not null        -- 'admin' | 'client'
owner_id              text not null fk     -- null/admin row for admin integrations
credentials           text not null        -- encrypted blob
metadata              json                 -- vendor-specific (account id, webhook id, etc.)
connection_verified_at timestamp not null
band_registration_hash text not null       -- ties to Observatory registry
status                text not null        -- 'active' | 'revoked' | 'lapsed' | 'disabled-kill-switch'
connected_via_wizard_completion_id text fk
created_at            timestamp not null
updated_at            timestamp not null
```

Every integration wizard writes exactly one row here on completion. Feature code reads this table (not `wizard_completions`) to check whether an integration is available. Kill-switch sets `status = 'disabled-kill-switch'`.

### 6.2 Shared primitives consumed (no ownership)

- `activity_log` — every wizard lifecycle event logged. New `kind` values in §10.
- `scheduled_tasks` — resume-nudge + expiry-warn + expiry jobs. New `task_type` values in §11.
- `settings.get()` — all thresholds, timeouts, expiry windows. Keys in §12.
- `external_call_log` — per-call logging of vendor SDK calls made inside wizards. Actor convention: admin wizards log `actor_type: 'internal'`; client wizards log `actor_type: 'prospect'` if user hasn't converted yet, else `actor_type: 'external'` with `actor_id = user.id`.
- `sendEmail()` — resume-nudge emails use `classification: 'transactional'` (user-initiated flow).

---

## 7. Vendor manifest + Observatory integration contract

### 7.1 Vendor manifest shape

```ts
// lib/integrations/vendors/pixieset.ts
export const pixiesetManifest: VendorManifest = {
  vendorKey: 'pixieset',
  jobs: [
    { name: 'pixieset.gallery_fetch', defaultBand: { p95: 1500, p99: 3000 }, unit: 'ms' },
    { name: 'pixieset.image_download', defaultBand: { p95: 5000, p99: 12000 }, unit: 'ms' },
  ],
  actorConvention: 'internal',           // or 'external' for per-client integrations
  killSwitchKey: 'integrations.pixieset.enabled',
  humanDescription: 'Pixieset gallery API — pulls galleries + images on client trial-shoot delivery.',
}
```

Vendor manifests live alongside the vendor SDK wrapper in the same file. This co-locates the SDK import (which is the single place the vendor's SDK can be imported — ESLint rule enforces this from Observatory §4) with its registry entry. Drift between the two is physically hard.

### 7.2 `registerIntegration()`

```ts
async function registerIntegration(
  wizardCompletionId: string,
  manifest: VendorManifest,
  credentials: EncryptedBlob,
  metadata: object
): Promise<{ connectionId: string; bandsRegistered: BandName[] }>
```

Called by the wizard's `onComplete()` before the typechecker marks the completion contract satisfied. Writes `integration_connections` row, calls Observatory's `registerBands(manifest.jobs)`, returns the registered band names to the celebration step for the post-completion summary.

### 7.3 Celebration-step post-completion summary

Renders:

- Vendor name + dry outro line.
- "We're now watching X jobs for cost anomalies: [job1, job2, job3]."
- "Calls from this integration are tagged as `actor_type: {convention}`."
- "Kill switch: flip `{killSwitchKey}` if this ever needs to be disabled in a hurry."
- "Done" CTA.

Plain English, terse, one screen. Admin tone gets the quiet version (three lines); client tone gets the expanded version (same info, spaced and branded).

---

## 8. First-run admin onboarding (critical flight)

### 8.1 Trigger

First admin sign-in where `wizard_completions` has no row matching any of the critical-flight wizards. Detected by `hasCompletedCriticalFlight(user)` helper.

**Sequencing lock (2026-04-13, mirror of Brand DNA Assessment §11.1 post-completion handoff).** Critical flight detection runs in the same Next.js middleware layer as the First-Login Brand DNA Gate. Order: Brand DNA gate clears first (SuperBad-self profile complete), then `hasCompletedCriticalFlight(user)` is checked. If false, admin routes 302-redirect to `/lite/setup/critical-flight/[nextWizardKey]` instead of falling through to cockpit. Brand DNA reveal transitions directly into `stripe-admin` with no cockpit detour between the two gates — they run as one continuous first-run admin onboarding arc ending at the capstone (§8.3). The middleware check self-terminates per user once all three critical-flight `wizard_completions` rows exist. Lazy-surfacing of non-critical wizards (§8.4) only begins after the flight completes.

### 8.2 Critical flight sequence

Three wizards, in fixed order:

1. **`stripe-admin`** — nothing else works without payment.
2. **`resend`** — nothing else works without transactional email.
3. **`graph-api-admin`** — unified inbox needs at least one mailbox connected before it's useful.

Each runs in sequence; finishing one auto-launches the next. No skip. No reorder. If one fails, it pauses the flight at that wizard and admin can return to cockpit — the flight resumes on next sign-in until all three are complete.

### 8.3 Capstone

On completion of the third wizard, the celebration step dials up into the capstone moment:

- Motion: `motion:critical_flight_capstone` (Tier-1, one-time-per-account, spent once ever).
- Sound: `sound:wizard_complete` at its ceremonial variant (same sound, longer tail, slight reverb).
- Copy: "SuperBad is open for business." (content mini-session calibrates; placeholder for now.)
- Lands on cockpit with a subtle welcome treatment (coordinated with Daily Cockpit spec's first-render empty-state).

### 8.4 Lazy-surfacing non-critical wizards

After the critical flight, the remaining admin wizards surface only when Andy tries to use a feature that needs them:

- Click "Send quote" with `meta-ads` not connected → no interception; quote still sends.
- Click "Run ad campaign" with `meta-ads` not connected → interception: "This needs Meta Ads connected. Takes 2 minutes." → opens slideover.
- `/lite/integrations` hub page shows all wizards with status chips; Andy can browse and connect pre-emptively if he wants.

---

## 9. Help escalation (mid-wizard friction)

### 9.1 Trigger

Two consecutive failures on the same step. "Failure" = `verify()` returns `{ ok: false }` or step's `onSubmit` throws.

### 9.2 Affordance

After second failure, a contextual "Stuck? Let's figure this out" line appears beside the retry button. Not before. Voice tone matches audience.

### 9.3 Admin escalation — Claude setup chat

Opens a dedicated Claude conversation:

- **New Opus job:** `admin-setup-assistant`. Prompt file: `lib/ai/prompts/admin-setup-assistant.ts`.
- **Context seeded:** wizard key, step index, step schema, accumulated `step_state`, last error payload, relevant vendor manifest, relevant recent `external_call_log` rows, last N `activity_log` entries for this wizard.
- **Thread persists** in a new `admin_support_threads` table (keyed by wizard_progress.id). Andy can return to the thread later.
- **Observatory:** new band registered for `admin-setup-assistant`, `actor_type: 'internal'`.
- **Tone:** dry, factual, no company-for-the-task flourishes. Andy's the audience; he wants answers.
- **Capabilities in v1:** read-only — explain what's happening, suggest fixes, link to vendor docs. Does NOT take actions on Andy's behalf. v1.1 could add action-taking (e.g. "I'll rotate your key for you") but v1 stays safe.

### 9.4 Client escalation — portal bartender chat

Opens the existing portal bartender chat (primitive defined in Client Management + Unified Inbox specs):

- Pre-seeded with wizard context: "Client X is stuck on step 2 of the Pixieset wizard, last error: invalid_credentials."
- Bartender handles triage. If it can't resolve, escalates to Andy via the inbox — appears as a waiting-item on Daily Cockpit.
- Does NOT persist in a new table — uses the existing bartender thread schema.

### 9.5 Kill-switch integration

Shell checks `job_disabled_until` on wizard-open via the vendor manifest's `killSwitchKey`. If the vendor's integration is kill-switched, the wizard shows a maintenance message instead of opening:

> "Pixieset connection is temporarily disabled while we look into a problem. We'll let you know when it's back. No action needed from you."

Admin wizards show the admin variant of this message (terser, references the kill-switch key so Andy can flip it back when resolved).

If a kill-switch fires *during* an in-flight wizard (rare — Observatory's detectors catch anomalies across users), in-flight wizards on the affected vendor pause at their current step and display the maintenance message. `wizard_progress` is preserved. When the kill-switch releases, the next user interaction resumes the wizard.

---

## 10. `activity_log.kind` additions

Six new values:

- `wizard_started` — new row in `wizard_progress`.
- `wizard_step_completed` — step advanced.
- `wizard_completed` — `onComplete` succeeded, `wizard_completions` row written.
- `wizard_abandoned` — `wizard_progress.abandoned_at` stamped.
- `wizard_resumed` — user returned to an in-flight wizard (from nudge email, cockpit banner, or direct URL).
- `integration_registered` — row written to `integration_connections`, bands registered in Observatory.

(`wizard_expired` is captured as `wizard_abandoned` with a `reason: 'expired'` payload, to avoid enum bloat.)

---

## 11. Scheduled tasks

Three new `task_type` values on the shared `scheduled_tasks` table (owned by Quote Builder spec):

| Task type | Fires | Handler |
|---|---|---|
| `wizard_resume_nudge` | 24h after `last_active_at` on unabandoned in-flight `wizard_progress` rows | Sends transactional email to user with deep-link resume URL. Uses content from mini-session. |
| `wizard_expiry_warn` | `expires_at - 1 day` | Sends transactional email: "your in-progress setup will be discarded tomorrow." |
| `wizard_expire` | `expires_at` | Marks `wizard_progress.abandoned_at = now()` with `reason: 'expired'`; logs `wizard_abandoned`. |

Admin wizards get the additional **cockpit banner at 7d idle**: handled by Daily Cockpit's `getHealthBanners()` contract, not a scheduled task — Cockpit polls `wizard_progress` on each brief generation. Setup Wizards spec patches Cockpit's `getHealthBanners()` to include the `in_flight_admin_wizard` banner kind (`kind: 'in_flight_admin_wizard'` with payload `{ wizardKey, lastActiveAt, resumeUrl }`).

---

## 12. Settings keys (registered in `docs/settings-registry.md`)

| Key | Default | Type | Description |
|---|---|---|---|
| `wizards.expiry_days` | `30` | int | Days from last activity before an in-flight wizard expires. |
| `wizards.resume_nudge_hours` | `24` | int | Hours of inactivity before a resume email sends. |
| `wizards.admin_cockpit_banner_days` | `7` | int | Days before an in-flight admin wizard shows a cockpit health banner. |
| `wizards.help_escalation_failure_count` | `2` | int | Consecutive step failures before the help affordance appears. |
| `wizards.step_retry_max` | `3` | int | Hard cap on retries per step before shell surfaces a permanent error state. |
| `wizards.critical_flight_wizards` | `['stripe-admin','resend','graph-api-admin']` | string[] | Ordered list of critical-flight wizard keys. |

All thresholds read via `settings.get()`. No literals in wizard shell code.

---

## 13. Voice & delight treatment

Per cross-cutting constraint introduced mid-Phase-3, every user-facing spec declares this.

### 13.1 Sprinkle claim

**Browser tab titles on wizard surfaces.** Dynamic, stratified by wizard phase (setting up / connecting / confirming / connected / stuck). Different pools for admin vs client tone. Marked `[CLAIMED by setup-wizards]` in `docs/candidates/sprinkle-bank.md`.

### 13.2 Ambient voice surfaces used (no new additions)

Setup Wizards uses the existing ambient slots defined by `surprise-and-delight.md`:

- Empty states on `/lite/integrations` hub.
- Loading copy during `async-check` and `webhook-probe` steps.
- Success toasts on wizard completion.
- Morning brief narrative (Daily Cockpit may reference wizards in progress).

### 13.3 Hidden eggs

**None claimed.** Admin-egg expansion brainstorm is already queued; if that session wants to place an egg on a wizard surface, it adds the claim through that session, not here.

### 13.4 New registry additions (design-system-baseline revisit owed)

- **Motion slot:** `motion:wizard_completion` — Tier-2. Payload: house spring + brief scale pulse on celebration step. Fires once per wizard completion.
- **Sound slot:** `sound:wizard_complete` — registry 8 → 9. Fires on celebration step for both admin and client audiences; respects system audio prefs; idempotent per completion event.
- **Motion slot:** `motion:critical_flight_capstone` — Tier-1, one-time-per-account. Either inherits an existing flagship motion slot (design-system revisit decides) or spends one new slot.

### 13.5 Completion-ceremony copy

Content mini-session produces:

- ~30 dry outro-line variants (client tone), stratified by wizard type.
- ~15 terse outro-line variants (admin tone).
- The critical-flight capstone line ("SuperBad is open for business." — or the approved variant).
- Tab-title rotation pools per wizard phase per audience.
- Resume-nudge email template + subject pool.
- Expiry-warning email template.
- Kill-switch-active maintenance message variants (per vendor).

---

## 14. Client portal + admin cockpit surfaces

### 14.1 `/lite/integrations` (admin hub)

- Card grid of every admin integration.
- Each card: vendor name, status chip (Not connected / In progress / Connected / Kill-switched / Lapsed), "Connect" or "Manage" button.
- Empty state uses the ambient voice ("Nothing connected yet. Start with the critical flight.").

### 14.2 Daily Cockpit integration

- **Attention rail chips** (curated completions only — 5 wizards from Q10).
- **Health banners** for in-flight admin wizards past 7d idle (see §11).
- **Critical-flight banner** if critical flight is incomplete ("X of 3 setup steps left.").

### 14.3 Client portal

- No dedicated "wizards" page for clients. Client wizards surface through their parent flows (onboarding, SaaS checkout, Brand DNA entry).
- Resume URLs land clients directly at the relevant wizard. If the client is not authenticated, Auth.js intercepts with magic-link; resume URL preserved through auth.

---

## 15. Cross-spec contracts

Specs that currently describe their wizards inline must patch to reference this primitive. Patches added to `PATCHES_OWED.md`.

### 15.1 Patches owed to existing specs

- **`saas-subscription-billing.md` Q18** — replace the inline "Product admin setup wizard" description with a `WizardDefinition` for `saas-product-setup` + completion contract. Content (step labels, validation) stays in SaaS spec.
- **`content-engine.md` (three-step onboarding)** — same pattern: `WizardDefinition` for `content-engine-onboarding`.
- **`unified-inbox.md` (Graph API consent)** — split into `graph-api-admin` (admin) and `graph-api-client` (subscriber); both reference this primitive.
- **`onboarding-and-segmentation.md`** — `WizardDefinition` for `onboarding-segmentation`, dedicated-route render.
- **`brand-dna-assessment.md`** — `WizardDefinition` for `brand-dna`, dedicated-route render, flagship capstone.
- **`intro-funnel.md` reflection questionnaire** — `WizardDefinition` for `intro-funnel-questionnaire`, dedicated-route render.

### 15.2 Patches owed to `daily-cockpit.md`

- `getHealthBanners()` contract gains a new banner kind: `in_flight_admin_wizard` with `{ wizardKey, lastActiveAt, resumeUrl }`.
- Attention rail chip kinds gain `wizard_completion` with `{ wizardKey, completedBy, subjectName }`.

### 15.3 Patches owed to `cost-usage-observatory.md`

- Add the `admin-setup-assistant` Opus job to the model registry.
- Add setup-wizard-specific actor conventions to the §7 registry documentation.

### 15.4 New `deals.activity_log` tie-ins

Intro Funnel + SaaS onboarding wizard completions feed deals' `activity_log`. No schema change; already supported.

---

## 16. Content mini-session owed

Small-medium creative session with `superbad-brand-voice` + `superbad-visual-identity` skills loaded. Produces:

- ~30 client-tone outro lines (stratified by wizard type: integration / config / assessment).
- ~15 admin-tone outro lines (terse).
- Critical-flight capstone line (candidate pool + final selection).
- Tab-title rotation pools (client + admin, stratified by phase).
- Resume-nudge email subject + body (sprinkle-eligible).
- Expiry-warning email subject + body.
- Kill-switch maintenance message variants (~6 vendors × 2 audiences).
- Claude admin-setup-assistant prompt (`lib/ai/prompts/admin-setup-assistant.ts`) calibrated against 6-8 synthetic failure scenarios (OAuth denied, API key invalid, webhook timeout, DNS propagation stalled, vendor outage, invalid permissions, token expired).
- Empty-state copy for `/lite/integrations`.
- Post-completion Observatory summary copy template (fills `{vendor}`, `{jobs}`, `{actorConvention}`, `{killSwitchKey}`).

Output committed to `docs/content/setup-wizards.md` (per Phase 3.5 step 3a convention).

Must run before Phase 5 Setup Wizards Session B (the shell build session — celebration step copy needed).

---

## 17. Phase 3.5 audit points

- Every integration wizard has a vendor manifest at `lib/integrations/vendors/<vendor>.ts` with all four required fields.
- Observatory's `§7 registry` boots from vendor manifests — verify on Phase 4 foundation session.
- ESLint rule forbidding direct vendor SDK imports in feature code is shared between Observatory and Setup Wizards; one rule, enforced everywhere.
- Every consuming spec patches its inline wizard description to reference this primitive.
- `wizard_progress` uniqueness constraint (`user_id + wizard_key` where `abandoned_at IS NULL`) verified in schema.
- `settings-registry.md` seeded with all 6 keys from §12.
- `scheduled_tasks.task_type` enum includes all 3 new values.
- `activity_log.kind` enum includes all 6 new values.
- Every wizard in §5 has a completion contract.
- All retroactive spec patches from §15.1 are actually applied before Phase 4.

---

## 18. Phase 5 build sessions (sizing)

Three sessions. Foundation session establishes shell + step library; wizards built session-per-wizard after.

- **Session A — Shell + step library + data model.** `wizard_progress`, `wizard_completions`, `integration_connections` tables. `WizardShell` component. All 10 step types + custom hatch. Progress indicator, save-resume, cancel, help affordance. Audience prop. `registerIntegration()`. No actual wizards built — just the infrastructure. Observatory spec has registered the vendor-manifest convention already (this session verifies it). Medium-large.
- **Session B — First-run admin onboarding + critical flight + capstone.** Wires up the three critical wizards (`stripe-admin`, `resend`, `graph-api-admin`), first-run detection, capstone ceremony, motion + sound slots. Requires content mini-session output. Medium.
- **Session C — `/lite/integrations` hub + remaining admin wizards.** Hub page with card grid + status chips. Remaining admin wizards (Pixieset, Meta Ads, Google Ads, Twilio, SerpAPI/OpenAI/Anthropic/Remotion generic template, domain-verify). Medium.

Client-facing wizards (`brand-dna`, `content-engine-onboarding`, `graph-api-client`, `onboarding-segmentation`, `intro-funnel-questionnaire`) are built as part of their respective feature's build sessions — they consume this shell but their wizard logic belongs to their parent spec's build sessions, not here. This spec's Phase 5 scope ends at admin.

**Admin-setup-assistant Claude chat** is a Session B sub-surface — needs the prompt file from the content mini-session and the `admin_support_threads` table.

---

## 19. Rollback strategy (per session)

- **Session A:** Migration reversible (down-migration included for all three tables). Shell is feature-flag-gated (`WIZARD_SHELL_ENABLED`); if it breaks, flip off and fall back to the legacy inline setup pages in parent specs (which will have been patched to import the shell by Phase 5 but still have their original inline form code behind the flag for the first release cycle).
- **Session B:** Critical flight is feature-flag-gated (`CRITICAL_FLIGHT_ENABLED`); if broken, admin sign-in routes to cockpit with a "complete your setup" banner linking to `/lite/integrations` instead.
- **Session C:** Per-wizard feature flags (`WIZARD_<KEY>_ENABLED`). Any broken wizard flips off, and `/lite/integrations` shows "Coming soon" for that card.

---

## 20. Settings / autonomy gates (AUTONOMY_PROTOCOL.md wiring)

All wizard behaviour reads from `settings.get()`. Every session's end-of-session literal-grep must flag and convert any hardcoded timeout, retry count, or threshold.

Motion-review gate: every new motion slot in §13.4 passes design-system-baseline review before Session B ships.

---

## 21. Success criteria

Phase 6 success metrics for this spec:

1. **Critical-flight completion rate ≥ 90%** on first admin sign-in — if fewer than 9 of 10 admins complete the 3-wizard flight, the flight is too long or a wizard is broken.
2. **Integration wizard completion rate ≥ 70%** per attempt — most attempts should succeed; anything below 70% signals either vendor breakage or bad step UX.
3. **Help-escalation rate < 15%** of wizard attempts — if more than 1 in 7 attempts escalates, the wizard copy or step flow needs rework.
4. **Resume-after-nudge rate ≥ 40%** — of wizards abandoned and nudged at 24h, at least 40% should resume. Below that and the nudge isn't working.

These metrics read from `activity_log` + `wizard_progress` + `wizard_completions` — no additional instrumentation needed.

---

## 22. Out of scope

- **No action-taking admin assistant in v1.** The Claude setup chat explains and suggests; it does not execute changes on Andy's behalf. v1.1 can add action-taking with confirmation gates.
- **No wizard version migrations in v1.** If a wizard's step sequence changes mid-flight for an in-flight user, that user's in-flight session expires via the 30-day window and they restart. Version-aware migrations are v1.1+.
- **No multi-user wizard collaboration.** Wizards are solo flows. No "Andy pairs with client on Brand DNA over a shared session."
- **No wizard analytics dashboard in v1.** The 4 success metrics are derived from existing tables; a dedicated wizard-funnel dashboard is v1.1+.
- **No test-mode / sandbox toggle per wizard.** Wizards hit real vendors. Dev/staging get real vendor test-mode credentials during Phase 5; production hits production.
- **No wizard scheduling / pre-booking.** "Schedule this wizard for tomorrow" is not a concept. Wizards run when invoked.
- **Growth-bank auto-generation of wizards.** Future integrations must write their own `WizardDefinition` file. No metaprogramming / config-driven wizard generation in v1.

---

## 23. Open questions / honest reality check

- **Biggest risk: completion-contract drift.** A wizard can pass its `verify()` call against a real vendor but have a completion contract that doesn't match what consumers actually need. Mitigation: contract shape is a TypeScript type; every consumer reads from `integration_connections` (not from completion payload directly), so the integration table is the actual source of truth, and the completion contract just ensures that row got written. Contract-shape hash stored in `wizard_completions.contract_version` catches drift post-hoc.
- **Second risk: step-type library drift.** With 10 step types and 12 wizards, small tone differences compound. Mitigation: content mini-session produces a canonical copy library; wizard definitions reference keys from that library rather than hardcoding strings. If the library grows fragmented, Phase 3.5 audit catches it.
- **Third risk: critical-flight UX grind on first sign-in.** Three back-to-back setup wizards before Andy sees any of the product he's been building for months. Capstone moment has to earn it. Content mini-session calibration is the load-bearing work here.
- **Fourth risk: kill-switch race conditions.** If a kill-switch fires mid-wizard, the in-flight user sees maintenance message — good. But what if the wizard just completed `registerIntegration()` seconds before the kill-switch? Solution: kill-switch flips `integration_connections.status` to `'disabled-kill-switch'`, not deleting the row — wizards that completed right before remain recorded; feature code checking `status = 'active'` respects the switch correctly.
- **The admin-setup-assistant is a new Claude surface we haven't specced at the prompt level.** Calibration is in the content mini-session. If the prompt is unreliable (hallucinates vendor behaviour), the assistant degrades to "here are the last 10 error log lines, good luck" — still useful, less magical. Same degradation pattern as Observatory's diagnosis card.
- **This spec is large for a Phase 3 output.** It has to be — it's foundational infrastructure consumed by 6+ other specs. Phase 5 sizing is three sessions only because each consuming spec builds its own wizard content in its own session. Session A is medium-large but not huge because the 10 step types share a lot of plumbing.

---

**End of spec.**

# LAUNCH_READY.md

**Status:** locked 2026-04-13 (Phase 4)
**Gate owner:** Phase 6 cannot start until every row below is ticked.
**Paired with:** `BUILD_PLAN.md` (what gets built), `AUTONOMY_PROTOCOL.md` (how Phase 5 runs).

---

## What this document is

The explicit checklist that separates "Phase 5 finished" from "Lite goes live". Phase 5 ending means every session in `BUILD_PLAN.md` passed its gates and committed. That is **not** the same as launch-ready. This file is the gap.

Every row is a hard gate. No row ships unticked. If a row can't be ticked, fix first — do not skip.

---

## §1 — Infrastructure

- [ ] **DNS routing — `lite.superbadmedia.com.au` live**, path-forwarded or reverse-proxied to `superbadmedia.com.au/lite` per FOUNDATIONS §7 cutover plan.
- [ ] **SSL / TLS cert valid** for both the staging subdomain and the final `/lite` path. Auto-renewal verified (Coolify / Let's Encrypt).
- [ ] **Coolify production environment green** — all services healthy, logs clean, resource ceilings set.
- [ ] **`.env.production` complete and loud-fail-validated** — every variable declared in `.env.example` present in production, boot fails loudly on any missing.
- [ ] **Node / Next.js versions pinned** — production runs the same versions as dev. No silent upgrades.
- [ ] **Port 3001 → 443 routing verified** — reverse proxy hits the Next.js dev/prod server correctly.
- [ ] **First automated SQLite + Litestream → Cloudflare R2 backup confirmed** — not just that a backup ran, but that a **restore** from R2 to a scratch environment produced a byte-identical DB. Per B2 / FOUNDATIONS reality-check — mandatory, not skippable.
- [ ] **Backup cadence + retention policy live** — continuous replication (Litestream), 7-year retention per ATO compliance.
- [ ] **Restore procedure documented** — step-by-step in `INCIDENT_PLAYBOOK.md` (owed Phase 6 step 8).

## §2 — Email infrastructure

- [ ] **Resend sender warmed up** — production sending domain has been ramping for ≥2 weeks, volumes within Resend best-practice curve.
- [ ] **SPF record verified** — `TXT @ v=spf1 include:_spf.resend.com ~all` resolves live.
- [ ] **DKIM record verified** — Resend-provided CNAME resolves; DKIM signature passes on a test send.
- [ ] **DMARC record verified** — at minimum `p=none` with `rua` reporting mailbox live; `p=quarantine` preferred once warmup stable.
- [ ] **Resend sender reputation clean** — no bounces / complaints / suppressions on current domain; dashboard confirms healthy send metrics.
- [ ] **Transactional templates rendering correctly** — magic link, quote share, invoice notification, deliverables-ready — all previewed in Resend dashboard end-to-end.
- [ ] **Quiet window enforcement verified** — `isWithinQuietWindow()` returns correctly for Australia/Melbourne Mon–Fri 08:00–18:00 excluding holidays from `/data/au-holidays.json`.
- [ ] **`canSendTo()` suppression gate verified** — a manually-suppressed test recipient actually blocks send; bounce handler writes back to suppression list.

## §3 — Payments

- [ ] **Stripe live keys rotated in** — Andy performs this manually; keys never live in the repo. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are the live values, not test.
- [ ] **Stripe webhook endpoint live** — `https://lite.superbadmedia.com.au/api/stripe/webhook` receiving events; webhook signing verified.
- [ ] **Stripe Customer Portal branded** — logo + colours + accent set in Stripe dashboard to match Lite brand.
- [ ] **Subscription products created in live mode** — Small / Medium / Large tiers with commitment-length terms per `project_saas_popcorn_pricing`.
- [ ] **Test invoice → pay → receipt cycle confirmed in live mode** with a real card, refunded immediately. Email delivery + activity_log write + receipt PDF all verified.
- [ ] **Cancel flow verified in live mode** — test subscription cancel → buyout mechanics → invoice adjusted → confirmation email — all correct.

## §4 — Authentication

- [ ] **Magic-link auth live** — production send + accept + session cookie set + redirect home.
- [ ] **Session cookie security flags correct** — `Secure`, `HttpOnly`, `SameSite=Lax`, TTL = `settings.get('portal.session_cookie_ttl_days')`.
- [ ] **Portal-guard + Brand DNA Gate middleware verified in production** — unauthenticated hit redirects to magic-link recovery; authenticated-but-no-Brand-DNA hit redirects to `/lite/onboarding`.
- [ ] **`BRAND_DNA_GATE_BYPASS=false` in production** — the dev escape hatch is off.

## §5 — Compliance & legal

- [ ] **Privacy policy published** at `/lite/legal/privacy` (per legal-pages mini-spec).
- [ ] **Terms of service published** at `/lite/legal/terms`.
- [ ] **Acceptable use / content policy** (if applicable) published.
- [ ] **Cookie consent banner live** — EU geo-gated per Stop 14 resolution L3; universal footer link to cookie settings.
- [ ] **Signup acceptance mechanic live** — single tickbox + inline links + two timestamps (acceptance + active version) per Stop 14 resolution L4.
- [ ] **DSR (data subject request) contact email live** — `privacy@superbadmedia.com.au` or equivalent, monitored by Andy, per Stop 14 resolution L2 (email-only at v1.0).
- [ ] **Spam Act compliance verified** — outreach unsubscribe link present and working on every outreach email; newsletter auto-enrolment on reply has opt-out in first send.
- [ ] **ATO-compliant invoice format verified** — ABN, GST line, invoice number, date, description, totals all present on a live rendered invoice.
- [ ] **7-year invoice retention policy documented** in FOUNDATIONS §5.

## §6 — Observability

- [ ] **Sentry live and capturing** — client / server / edge runtimes all reporting; test error flows through and appears in dashboard.
- [ ] **`reportIssue()` footer button works on every client-facing surface** — creates a `support_tickets` row, links to Sentry issue, session replay URL attached.
- [ ] **`/lite/admin/errors` triage dashboard functional** — renders open tickets, filters, actions.
- [ ] **Cost alerts firing in dev** — verify `alerts.anthropic_daily_cap_aud`, `alerts.stripe_fee_anomaly_multiplier`, `alerts.resend_bounce_rate_threshold` all email Andy when breached (use deliberately-low test thresholds).
- [ ] **Observatory dashboard populated** — `external_call_log` writing, cost aggregation live, per-feature breakdowns rendering.
- [ ] **`settings.get()` read-path hot** — no feature code reads literals; Wave 23 Settings Audit Pass clean.

## §7 — Kill-switches

- [ ] **Every kill-switch in `lib/kill-switches.ts` wired and tested** — flipping the flag actually stops the subsystem. Test each one in dev:
  - [ ] `outreach_send_enabled`
  - [ ] `scheduled_tasks_enabled`
  - [ ] `llm_calls_enabled`
  - [ ] `drift_check_enabled`
  - [ ] All per-feature flags added by Wave 3–22 sessions.
- [ ] **Default production state of risky kill-switches** — outreach send and scheduled tasks **start disabled**; Andy enables deliberately during shadow period.

## §8 — Critical flows (E2E against production)

Every suite from `BUILD_PLAN.md` §E must pass against a production-equivalent build, not just dev:

- [ ] `e2e/intro-funnel-booking.spec.ts` — trial shoot booking.
- [ ] `e2e/quote-accept.spec.ts` — quote accept.
- [ ] `e2e/invoice-pay.spec.ts` — invoice pay.
- [ ] `e2e/saas-signup.spec.ts` — subscription signup.
- [ ] `e2e/portal-auth.spec.ts` — portal auth.

## §9 — Dry-run / synthetic client

Phase 6 step 1 (START_HERE.md) requires a full synthetic client arc before DNS cutover:

- [ ] **Fake prospect created** via Lead Generation (no real outreach sent — kill-switch on).
- [ ] **Simulated outreach reply** → ICP scoring → Intro Funnel routed.
- [ ] **Trial shoot booked** end-to-end via Intro Funnel (fake 60-min slot).
- [ ] **Brand DNA questionnaire completed** with a synthetic brand.
- [ ] **Six-Week Plan generated and delivered** (real Opus call; log cost).
- [ ] **Retainer quote drafted + accepted** — Quote Builder happy path.
- [ ] **First invoice generated + paid** — Branded Invoicing happy path (live Stripe mode, refunded).
- [ ] **Client portal active** — magic link sent, received, accepted, dashboard renders.
- [ ] **Content Engine producing drafts** — one draft made it through the pipeline.
- [ ] **Cockpit brief reflects all of the above** — waiting items, health banners, activity feed all current.
- [ ] **Cancel flow walked** on a test subscription — full round-trip confirmed.

Any handoff that fails = fix before launch. The dry-run is the last-line integration test that unit/E2E can't catch.

## §10 — Shadow period readiness

- [ ] **Andy's own admin account provisioned** with first-login Brand DNA (superbad_self) complete — the gating path per A8 is walked end-to-end by Andy, not just tested.
- [ ] **Andy's own calendar + availability configured** on the native Lite calendar (per `project_client_shoot_bookings`).
- [ ] **Initial outreach list seeded** (production-safe; kill-switch remains off until Andy is ready).
- [ ] **Shadow period operating manual** in `INCIDENT_PLAYBOOK.md` — Andy knows which kill-switch to flip if any feature misbehaves.

## §11 — Documentation

- [ ] **`INCIDENT_PLAYBOOK.md` written** (per START_HERE.md Phase 6 step 8) — common failure modes + triage steps + rollback decision tree + Stripe/Resend/Coolify contacts + client-communication templates.
- [ ] **`/lite/admin/docs` internal reference route live** — links to Brand DNA, settings registry, access matrix, state machine, shared-primitive registry. Andy's own in-platform reference.
- [ ] **GHL shutdown plan confirmed** — `superbadmedia.com.au/` homepage either cutover to Lite-served or deliberately left on GHL through shadow; documented either way.

## §12 — Brand polish assets

- [ ] **Sound registry populated** — all 7 sounds in `lib/sounds.ts` have approved files in `/public/sounds/approved/`. Sourcing session: Sonnet-assisted Freesound API (+ optional ElevenLabs SFX) pulls 3 on-brand candidates per key; Andy listens and picks one per sound in a single sitting. Curated presets per `feedback_curated_customisation` — no sliders, no open picker.
- [ ] **`docs/sound-attributions.md` complete** — licence + source URL + author credit logged for every approved file (Freesound CC-BY attribution requirement).
- [ ] **`SoundProvider` `onloaderror` flipped from silent no-op to `console.warn`** — per A4 handoff deferred TODO. Missing-file = real warning, not expected state.
- [ ] **Sounds-off variant re-verified** on a real device after files land — `users.sounds_enabled = false` actually mutes every Tier 2 choreography.

## §13 — Final sign-off

- [ ] **Every row above ticked.**
- [ ] **Andy walks the admin surface** and signs off on visceral feel (motion, sound, density, voice, dry-voice eggs) before DNS cutover.
- [ ] **Date + git SHA of launch recorded** in `sessions/phase-6-handoff.md`.

Unticked rows block launch. This file is the gate.

---

## §14 — Deferred plumbing (land during Phase 6, before or at launch)

Items tracked in `PATCHES_OWED.md` that are gated on Phase 6 but aren't covered by the sections above. Each token links back to its full description in PATCHES_OWED.

- [ ] **`middleware.ts` → `proxy.ts` rename** — Next.js 16 deprecation. Token: `a8_middleware_rename_proxy`. Gate: next middleware-touch session or Phase 6 sweep.
- [ ] **`next-themes` dep removal audit** — pulled transitively by shadcn sonner; unused (dark-only app). Token: `a3_next_themes_audit`. Gate: Phase 6 dep audit.
- [ ] **Webhook `clientState` verification** — Graph webhook handler doesn't verify `clientState` against stored value. Low risk (idempotent) but should harden. Token: `ui_1_webhook_client_state_verification`. Gate: Phase 6 launch prep.
- [ ] **Sentry enablement** — SDK installed and kill-switched off. Flip `sentry_enabled` in production. Token: `b1_sentry_dep`. Gate: Phase 6 enablement.
- [ ] **Sentry session replay URL population** — `session_replay_url` column always null; needs replay SDK project config. Token: `b1_replay_url_unpopulated`. Gate: Phase 6 or dedicated Sentry replay session.
- [ ] **CI wiring for e2e tests** — `.github/workflows/` is empty; wire `npm run test:e2e` with Stripe test keys as CI secrets. Token: `sbe2e_ci_wire`. Gate: CI infra setup.
- [ ] **`SoundProvider` `onloaderror` → `console.warn`** — already listed in §12 above; included here for completeness. Token: `a4_soundprovider_onloaderror`.
- [ ] **Swap Outfit → General Sans** (Dispatch body font) — only if Dispatch preset gets real usage and the visual gap matters. Token: `a2_dispatch_general_sans`. Gate: post-launch / first user complaint.
- [ ] **Incident playbook entries** — Brand DNA gate bypass (`BRAND_DNA_GATE_BYPASS=true`), critical-flight middleware bypass, A8 rollback path. Tokens: `a8_incident_playbook_rollback`, plus Phase 6 step 8 scope.

## §15 — Post-launch polish sessions (not launch-blocking, but tracked)

These aren't gates — they're the first post-launch work sessions, collected here so nothing falls through the cracks. Each will need its own brief.

### Compose polish session
- [ ] **Autosave for compose drafts** — debounced write on keystroke pause; currently explicit Save only. Token: `ui_6_autosave_for_compose_drafts`.
- [ ] **Rich-text compose** — Markdown paste, inline links, attachments, signature insertion. Currently plain-text → `<br>` only. Token: `ui_6_text_to_html_richness_deferred`.
- [ ] **Create calendar invites from scratch** — date/time picker + attendee list + Graph POST. Currently RSVP-only. Token: `ui_10_compose_invite_creation_owed`.

### Inbox / email polish
- [ ] **On-demand per-thread email backfill** — fetch full thread history beyond the 12-month import window. Token: `ui_12_on_demand_per_thread_backfill`.

### Lead generation polish
- [ ] **Hunter.io name-based pattern inference** — pass team names from website scrape through to contact discovery. Token: `lg_5_hunter_name_pattern_inference`.
- [ ] **Draft generation parallelisation** — sequential is fine at 5–30 daily caps; parallelise if caps increase. Token: `lg_5_draft_generation_parallel`.
- [ ] **Blog post context in outreach drafts** — wire `recentBlogPosts` from Content Engine into draft generator. Token: `lg_5_recent_blog_posts_wiring`.

### Other
- [ ] **Companies list index page** — `/lite/admin/companies/page.tsx`. Deferred from admin-polish-4; reachability covered by pipeline drill-through for now.
- [ ] **Quote builder redraft retry on drift failure** — `fail_observed` slug logged but no retry loop. Token: `qb6_drift_fail_redraft_unacted` (closed as renamed; retry remains a v1.1 option).

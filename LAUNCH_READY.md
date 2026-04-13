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

## §12 — Final sign-off

- [ ] **Every row above ticked.**
- [ ] **Andy walks the admin surface** and signs off on visceral feel (motion, sound, density, voice, dry-voice eggs) before DNS cutover.
- [ ] **Date + git SHA of launch recorded** in `sessions/phase-6-handoff.md`.

Unticked rows block launch. This file is the gate.

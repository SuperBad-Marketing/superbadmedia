# `DRY-INT` — Integration-Level Dry-Run — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0 + §G0.5.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session (amended 2026-04-17).
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.
>
> **Note authored (2026-04-21):** This brief was written by the autonomy loop under the G11.b mop-up rule — DRY's closing handoff did not pre-generate it. Root cause noted in PATCHES_OWED.md.

---

## 1. Identity

- **Session id:** `DRY-INT`
- **Wave:** 23 — Final gates (integration sub-session of DRY)
- **Type:** `E2E`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`
- **G0.5 input budget estimate:** ~12k tokens (this brief + DRY handoff + SAP handoff + no spec files needed)

## 2. Spec excerpts (amended 2026-04-17)

### Excerpt 1 — DRY dry-run integration items

Source: `sessions/dry-handoff.md` §"What's still needed before LAUNCH_READY §9 can be fully ticked"

```
1. Stripe payment round-trip — create a real Stripe Payment Intent for the test invoice,
   complete payment with a test card, verify webhook fires + invoice status updates to `paid`.
   Then refund.
2. Portal magic-link auth flow — send a real magic link email via Resend, click it,
   verify portal renders with client data.
3. Six-Week Plan generation — trigger the scheduled task that calls Opus to generate a plan
   for the test client. Verify the plan renders in the portal.
4. Cockpit brief generation — trigger the daily brief cron. Verify it reflects the test
   client's activity.
5. Content Engine draft — trigger content generation scheduled task. Verify a draft appears
   in the Content Engine.
6. Cancel flow — create a real Stripe subscription for the test client, then walk the
   cancel/buyout flow.
```

**Audit footer:** `sessions/dry-handoff.md` §"What's still needed" — authoritative source for integration items.

## 2a. Visual references

None — Type is `E2E`, not `UI`.

## 3. Acceptance criteria (verbatim)

```
From DRY session dry-run checklist:
- Six-Week Plan generated and delivered (Anthropic API call via scheduled task)
- First invoice generated + paid (Stripe Payment Intent + real webhook round-trip)
- Client portal active (Resend magic-link email delivery + click-through)
- Content Engine producing drafts (LLM call via scheduled task)
- Cockpit brief reflects all of above (daily cron triggered + brief populated)
- Cancel flow walked (active Stripe subscription → cancel → buyout mechanics)

All LAUNCH_READY.md §3 Payments + §2 Email rows ticked.
```

## 4. Skill whitelist

- `stripe` — Stripe SDK for payment round-trip testing
- `drizzle-orm` — DB verification after integration events

## 5. File whitelist (G2 scope discipline)

No code changes expected — this is a verification/testing session.
- `LAUNCH_READY.md` — update ticked rows after successful verification
- `sessions/DRY-INT-handoff.md` — new (handoff note)

## 6. Settings keys touched

- **Reads:** none (testing existing functionality)
- **Seeds (new keys):** none

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

### Hard preconditions (must be present to proceed)

- [ ] `STRIPE_SECRET_KEY` configured in environment — verify: `printenv STRIPE_SECRET_KEY | head -c5`
- [ ] `RESEND_API_KEY` configured in environment — verify: `printenv RESEND_API_KEY | head -c5`
- [ ] `ANTHROPIC_API_KEY` configured in environment — verify: `printenv ANTHROPIC_API_KEY | head -c5`
- [ ] Test data company `co-dry-run-01` exists in dev.db — verify: `grep -r "co-dry-run-01" .`
- [ ] Stripe webhook handler route exists — verify: `ls app/api/stripe/webhook/route.ts`
- [ ] Scheduled task handler for six-week plan exists — verify: `ls lib/scheduled-tasks/handlers/`
- [ ] Cockpit brief generation handler exists — verify: `grep -r "cockpit_brief" lib/scheduled-tasks/`

**⚠️ G1 failure note (written 2026-04-21):** This brief was written in an environment where STRIPE_SECRET_KEY, RESEND_API_KEY, and ANTHROPIC_API_KEY are NOT configured. The session cannot proceed until these credentials are available. DRY-INT is designed to run locally or in a staging environment with live credentials — not in an isolated CCR clone. This is a Phase 6 shadow-period task per the DRY handoff's own recommendation.

## 8. Rollback strategy (G6 — exactly one)

- [x] `git-revertable, no data shape change` — This session makes no code changes; rollback is n/a.

## 9. Definition of done

- [ ] Stripe payment round-trip: test invoice paid via test card, webhook received, `invoices` row updated to `paid` status.
- [ ] Stripe refund: payment refunded via Stripe dashboard or API, `invoices` row reflects refund.
- [ ] Magic-link email: Resend API call succeeds, email received in test inbox, link clicked, portal renders with Coastal Brew Co data.
- [ ] Six-Week Plan: scheduled task triggered, Anthropic API call logged in `external_call_log`, plan content visible in portal.
- [ ] Cockpit brief: daily cron triggered, `cockpit_briefs` row created, brief renders in admin cockpit.
- [ ] Content Engine draft: scheduled task triggered, LLM call logged, draft visible in Content Engine admin page.
- [ ] Cancel flow: test subscription created, cancel flow walked, buyout invoice generated, confirmation email sent.
- [ ] LAUNCH_READY.md §3 Payments rows ticked.
- [ ] LAUNCH_READY.md §2 Email rows partially ticked (transactional templates verified).
- [ ] `npx tsc --noEmit` → zero errors (pre-existing errors excepted).
- [ ] `npm test` → green (pre-existing failure excepted).

## 10. Notes for the next-session brief writer (G11 extension)

DRY-INT is a Phase 6 shadow-period task. After DRY-INT passes, Next Action should be updated to Phase 6 transition. Phase 6 protocol is in START_HERE.md §Phase 6.

**Session requires:**
- Live Stripe test keys + Stripe CLI running with `--forward-to localhost:3001/api/stripe/webhook`
- Live Resend API key + access to test email inbox
- Live Anthropic API key (not via Claude Code proxy — app-level key)
- Coastal Brew Co test data still in dev.db (from DRY session)
- Dev server running on :3001

**Andy must be present** to verify email delivery, click magic link, and observe live integration events.

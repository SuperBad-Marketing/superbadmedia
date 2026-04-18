# `cms-4` — SaaS Subscription Billing content mini-session — Handoff

**Closed:** 2026-04-18
**Type:** Content mini-session (Batch B, item 2 of 2)
**Model tier:** Opus (creative — client-facing voice treatment)

---

## What was built

The **remaining creative content layer** for SaaS Subscription Billing. 5 new content docs. Two files already existed from prior sessions: `checkout.md` (SB-5) and `pricing-page.md` (SB-3).

### New content docs (5 files)

| File | Purpose |
|---|---|
| `docs/content/saas-subscription-billing/usage-bar.md` | Personality progression across 5 usage levels (low/mid/near-cap/at-cap/hit-cap). Dimension-specific variants. Styling spec. |
| `docs/content/saas-subscription-billing/cap-and-lockout.md` | Usage cap hit screen (highest-tier and upgrade-available variants). Payment failed lockout screen (initial, post-recovery, escalation state). |
| `docs/content/saas-subscription-billing/cancel-flow.md` | Motivational reality check (the defining brand moment). Product switch. Pre-term branch (4 options: pay remainder, 50% buyout, pause, talk to us). Post-term branch (upgrade/downgrade/cancel with "here's what you'd be losing"). Card-not-on-file edge. Pause status page. |
| `docs/content/saas-subscription-billing/emails.md` | 9 email templates: payment confirmation, payment failed, card expiring, annual renewal reminder, cancelled (dying-fall), pause, upgrade/downgrade, product switch, data-loss warning. Subject lines and full bodies. Voice conventions locked (sign-off "SuperBad" not "Andy"). |
| `docs/content/saas-subscription-billing/copy.md` | Upgrade confirmation moment, first-login bartender lines (3 commitment variants), product admin empty states (4 surfaces), browser tab titles (6 pages), demo landing page generic frame copy, cockpit integration headlines, account management labels. |

### Pre-existing content (2 files, not touched)

| File | Origin |
|---|---|
| `docs/content/saas-subscription-billing/checkout.md` | SB-5 (2026-04-15) |
| `docs/content/saas-subscription-billing/pricing-page.md` | SB-3 (2026-04-15) |

## Key decisions

1. **Motivational reality check is Playfair italic, not heading font.** The body IS the heading. No Righteous, no Black Han Sans. The quiet register is the power.

2. **"Maybe give it until Thursday."** The key line of the cancel flow. Doesn't argue, doesn't bargain. Suggests a pause that has nothing to do with business logic. Human, not strategic.

3. **Pre-term options presented without steering.** No "recommended" badge, no colour coding, no default selection. Four cards, same visual weight. The subscriber picks.

4. **"Actually, I'll stay." / "Good call."** Two words as the stay-confirmation. Not "We're glad you decided to stay!" The brevity is the voice.

5. **Data-loss warning: "A person reads it."** The human moment in an automated chain. Differs from all other emails — acknowledges someone might reply, and that someone will read it.

6. **No SaaS prompts to calibrate.** Spec is prompt-free (confirmed in INDEX.md). All voice copy rendered via `generateInVoice()` at runtime, calibrated by the content docs.

## What the next session should know

- **CMS Batch B is now complete.** Both CMS-3 (Content Engine) and CMS-4 (SaaS Subscription Billing) are closed.
- **Full SaaS content set:** 7 files total (2 pre-existing + 5 new). Every surface from spec §14 is covered.
- **Next in execution order:** Wave 10 catchup (CM-1 → CLD-1 → CLD-2 → CM-7 → ... → CM-E2E).

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — 193 files, 1637 passed, 0 failures, 1 skipped
- No build-breaking changes (content docs only)

## PATCHES_OWED (raised this session)

None.

## Rollback strategy

`git-revertable`. No migration, no schema change. Reverting removes all 5 new content docs. Pre-existing `checkout.md` and `pricing-page.md` unaffected.

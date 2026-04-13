# BDA-1 — Brand DNA data model + invite token — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §"Pre-compiled session briefs" + §G0.**
> Read this file at the start of the session. Do **not** read all 21 specs.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.

---

## 1. Identity

- **Session id:** BDA-1
- **Wave:** 3 — Brand DNA Assessment (opens Wave 3)
- **Type:** FEATURE
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** yes (prescribed tier)
- **Estimated context:** medium

## 2. Spec references

- `docs/specs/brand-dna-assessment.md` §§2–3, §§5–7 (data model + invite flow) — primary
- `BUILD_PLAN.md` Wave 3 §BDA-1 — session inventory
- `docs/settings-registry.md` — no new keys in BDA-1 (all BDA settings land in BDA-2 or later)
- `lib/ai/prompts/INDEX.md` — confirm brand-dna Opus prompt slugs exist (BDA-1 does not implement prompts; BDA-2/BDA-3 wire them)

## 3. Acceptance criteria (verbatim from BUILD_PLAN.md BDA-1)

```
BDA-1 — Brand DNA data model + invite token
- Builds: `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites` tables
  (brand_dna_profiles stub already exists from A8 — extend it in-place to add
  the remaining columns: subject_display_name, track, section_scores JSON,
  signal_tags JSON, prose_portrait text, first_impression text, reflection text,
  version, completed_at_ms, is_superbad_self boolean); invite-token flow
  (`lib/brand-dna/issue-invite.ts` wraps `issueMagicLink()` from A7 with
  context='brand_dna_invite'); `lib/brand-dna/redeem-invite.ts` validates invite
  + creates/attaches BrandDnaProfile row; logActivity() calls for
  brand_dna_invite_sent + brand_dna_invite_redeemed.
- Owns: `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites` tables;
  extended `brand_dna_profiles` schema; `lib/brand-dna/` module.
- Consumes: A5 (db), A6 (logActivity, enqueueTask), A7 (issueMagicLink,
  redeemMagicLink, LegalDocTypes for invite context).
- Migration: `0007_bda1_brand_dna.sql` (Drizzle journal idx 7).
- Rollback: migration reversible — new tables + brand_dna_profiles column additions.
  `brand_dna_profiles` stub (A8) is extended, not replaced.
```

## 4. Skill whitelist

- `superbad-brand-voice` — for any UI copy in the invite token redirect page.

## 5. File whitelist (G2 scope discipline)

- `docs/specs/brand-dna-assessment.md` §data-model — read-only reference (do NOT edit spec)
- `lib/db/schema/brand-dna-profiles.ts` — extend in-place (add remaining columns) (`edit`)
- `lib/db/schema/brand-dna-answers.ts` — new schema (`new`)
- `lib/db/schema/brand-dna-blends.ts` — new schema (`new`)
- `lib/db/schema/brand-dna-invites.ts` — new schema (`new`)
- `lib/db/schema/index.ts` — add barrel exports for new tables (`edit`)
- `lib/db/schema/activity-log.ts` — add `brand_dna_invite_sent` + `brand_dna_invite_redeemed` to `ACTIVITY_LOG_KINDS` (`edit`)
- `lib/db/migrations/0007_bda1_brand_dna.sql` — migration: new tables + brand_dna_profiles ALTER (`new`)
- `lib/db/migrations/meta/_journal.json` — add idx 7 entry (`edit`)
- `lib/brand-dna/issue-invite.ts` — `issueBrandDnaInvite(contactId, issuedByUserId, db?)` wrapper (`new`)
- `lib/brand-dna/redeem-invite.ts` — `redeemBrandDnaInvite(token, db?)` validates + creates profile (`new`)
- `lib/brand-dna/index.ts` — barrel export (`new`)
- `tests/brand-dna-invite.test.ts` — unit tests for issue + redeem flow (`new`)

Anything outside this list = stop and patch the brief.

## 6. Settings keys touched

- **Reads:** none (BDA-1 is pure data model + invite infra; no settings consumed)
- **Seeds:** none

## 7. Preconditions (G1 — must be grep-verifiable against the repo)

- [ ] B3 closed cleanly — verify: `ls sessions/b3-handoff.md`
- [ ] `brand_dna_profiles` stub exists (A8) — verify: `grep "brand_dna_profiles" lib/db/schema/brand-dna-profiles.ts`
- [ ] `portal_magic_links` table exists (A8) — verify: `grep "portal_magic_links" lib/db/schema/portal-magic-links.ts`
- [ ] `issueMagicLink` exported from `lib/portal/issue-magic-link.ts` — verify: `grep "export.*issueMagicLink" lib/portal/issue-magic-link.ts`
- [ ] `redeemMagicLink` exported from `lib/portal/redeem-magic-link.ts` — verify: `grep "export.*redeemMagicLink" lib/portal/redeem-magic-link.ts`
- [ ] `logActivity` exported from `lib/db/schema/activity-log.ts` or `lib/activity-log.ts` — verify: `grep -r "export.*logActivity" lib/`
- [ ] Migration journal last idx is 6 (`0006_b3_legal`) — verify: `grep '"idx": 6' lib/db/migrations/meta/_journal.json`
- [ ] `BRAND_DNA_GATE_BYPASS` in `.env.example` — verify: `grep "BRAND_DNA_GATE_BYPASS" .env.example`
- [ ] `legal_doc_versions` has seeded rows for terms/privacy/aup/cookie-policy — verify: `grep "ldv_terms_v1" lib/db/migrations/0006_b3_legal.sql`
- [ ] `docs/specs/brand-dna-assessment.md` exists — verify: `ls docs/specs/brand-dna-assessment.md`

If any row fails: stop, do not build.

## 8. Rollback strategy (G6)

**migration reversible** — `0007_bda1_brand_dna.sql` adds 3 new tables + `brand_dna_profiles` columns. Rollback = drop the new tables + remove the new columns via a down-migration. The A8 `brand_dna_profiles` stub shape (id, subject_type, subject_id, status, created_at_ms, updated_at_ms) is preserved.

## 9. Definition of done

- [ ] `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites` tables exist in schema — verify: `grep -r "sqliteTable" lib/db/schema/brand-dna-*.ts`
- [ ] `brand_dna_profiles` extended in-place — verify: `grep "prose_portrait\|signal_tags\|is_superbad_self" lib/db/schema/brand-dna-profiles.ts`
- [ ] `lib/brand-dna/issue-invite.ts` exports `issueBrandDnaInvite` — verify: `grep "export.*issueBrandDnaInvite" lib/brand-dna/issue-invite.ts`
- [ ] `lib/brand-dna/redeem-invite.ts` exports `redeemBrandDnaInvite` — verify: `grep "export.*redeemBrandDnaInvite" lib/brand-dna/redeem-invite.ts`
- [ ] `brand_dna_invite_sent` + `brand_dna_invite_redeemed` in `ACTIVITY_LOG_KINDS` — verify: `grep "brand_dna_invite" lib/db/schema/activity-log.ts`
- [ ] Migration `0007_bda1_brand_dna.sql` in journal at idx 7 — verify: `grep '"idx": 7' lib/db/migrations/meta/_journal.json`
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run lint` → clean.
- [ ] `npm run build` → clean (pre-existing Google Fonts 403 in sandbox = acceptable as per A7/A8/B1/B2/B3 precedent).

## 10. Notes for the next-session brief writer (BDA-2)

BDA-2 builds the card UI. It needs from BDA-1:
- All 4 `brand_dna_*` tables with their exact column shapes.
- `issueBrandDnaInvite` / `redeemBrandDnaInvite` API surface.
- The `BRAND_DNA_GATE_BYPASS=true` pattern during development (gate clears only at BDA-4).
- BDA-1 does NOT build any UI — BDA-2 starts from the `/lite/brand-dna` route.
- Keep using `BRAND_DNA_GATE_BYPASS=true` — the gate will loop back to `/lite/onboarding` until BDA-3 sets `status = 'complete'` on the SuperBad-self profile.
- `logActivity` call pattern: `logActivity(db, kind, userId, payload)` — see `lib/db/schema/activity-log.ts` for function sig.
- The spec's alignment gate (3-answer routing → 3 tracks) is a BDA-2 concern, not BDA-1.
- Foundation-B exit checklist confirmed clean (B3 handoff).
- `/lite/legal/*` is public (no auth gate) — BDA-2 does not need to worry about legal routes.

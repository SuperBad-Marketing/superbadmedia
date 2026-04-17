# `LG-9` — Lead Gen draft pipeline (discovery + generation + orchestrator wiring) — Session Brief

> **Pre-compiled by LG-8 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made that the repo doesn't back up.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references.

---

## 1. Identity

- **Session id:** `LG-9`
- **Wave:** `13 — Lead Generation` (9 of 10)
- **Type:** `FEATURE`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `large`
- **G0.5 input budget estimate:** ~28k tokens (brief + spec excerpts + last 2 handoffs + claude-api skill). Under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — Hunter.io email discovery §7

Source: `docs/specs/lead-generation.md` §7

```
## 7. Contact email discovery

### 7.1 Hunter.io as primary

Once a candidate clears scoring + qualification, the pipeline resolves a contact email:

1. Hunter.io Domain Search API — pass the candidate domain, receive ranked contacts
   (name, role, email, confidence).
2. Prefer contacts with role matching: founder, ceo, owner, marketing-manager,
   marketing-director, growth-lead.
3. If Hunter returns a high-confidence match, store email_confidence = 'verified'.
4. If Hunter returns only low-confidence or no match, fall back to pattern inference:
   try firstname@domain, firstname.lastname@domain, first-initial-lastname@domain.
   Store best guess with email_confidence = 'inferred'.
5. If both fail, candidate is skipped with skipped_reason = 'no_contact_email'.

### 7.2 Inferred emails get a softer send posture

- Draft is still generated.
- Send is still allowed.
- Bounce on an inferred-email first touch is treated as normal (not a reputation incident).
  Candidate is marked skipped, not escalated.
```

### Excerpt 2 — Draft generation §8

Source: `docs/specs/lead-generation.md` §8

```
## 8. Draft generation

### 8.1 The draft generator function

One entry point:
// lib/lead-gen/draft-generator.ts
export async function generateDraft(args: {
  track: 'saas' | 'retainer'
  touchKind: 'first_touch' | 'follow_up' | 'stale_nudge'
  touchIndex: number
  viabilityProfile: ViabilityProfile
  standingBrief: string
  manualBriefOverride?: string
  priorTouches: OutreachSend[]
  recentBlogPosts: BlogPost[]   // always [] in v1
  contactInfo: { name?: string; email: string; role?: string; company: string }
  nudgeFeedback?: string
}): Promise<{
  subject: string
  bodyMarkdown: string
  modelUsed: string
  promptVersion: string
  generationMs: number
}>

### 8.2 Prompt inputs (composed, not baked)

- System prompt loads from a version-controlled file at lib/lead-gen/prompts/outreach-system.md.
  No inlined prompt strings.
- SuperBad's own Brand DNA profile is read into the system prompt — cold outreach sounds
  like Andy, not a generic bot. (superbad-brand-voice skill content.)
- SuperBad business context loaded from superbad-business-context skill.
- viabilityProfile fed in as structured JSON.
- Prior touches supply thread context for follow-ups and nudges.

### 8.3 Required output discipline

- Every draft has subject AND body (no placeholder variants).
- Body includes Spam Act footer: unsubscribe link, sender identity (Andy Robinson,
  SuperBad Media, Melbourne address), reason for sending.
- Body must never invent facts not in viabilityProfile.

### 8.4 Drift check (Foundations §11.5)

Every generated draft passes through checkBrandVoiceDrift(draft, superbadBrandDnaProfile)
before the draft is shown in the queue. One automatic regeneration on drift failure,
second failure surfaces a visible "voice drift flagged" warning — does not block send.

### 8.5 Nudge regeneration

Reuses the Content Engine's rejection-chat primitive. When Andy types a nudge:
1. Existing draft + Andy's feedback posted to generateDraft() with nudgeFeedback populated.
2. New draft replaces old one, outreach_drafts row updated, feedback appended to
   nudge_thread_json.
3. Approval after nudge classified as approval_kind: 'nudged_manual'.
```

### Excerpt 3 — Orchestrator insertion gap (PATCHES_OWED)

Source: `PATCHES_OWED.md` `lg_4_lead_candidates_not_inserted_by_orchestrator`

```
lib/lead-gen/orchestrator.ts returns qualified_count but does NOT insert lead_candidates rows.
LG-9 resolves this: insert lead_candidates rows at qualification time (after scoring).
Then call discovery + generateDraft for each.
```

**Audit footer:**
- `docs/specs/lead-generation.md` §7 — Hunter.io discovery full spec
- `docs/specs/lead-generation.md` §8 — Draft generation full spec (including nudge + drift)

---

## 2a. Visual references

*FEATURE type — no mockup required.*

---

## 3. Acceptance criteria

```
LG-9 is done when:

1. lib/lead-gen/discovery.ts (new):
   - Exports discoverContact(domain: string): Promise<DiscoveredContact | null>
   - Calls Hunter.io Domain Search API (HUNTER_API_KEY env var)
   - Prefers roles: founder, ceo, owner, marketing-manager, marketing-director, growth-lead
   - Falls back to pattern inference (firstname@domain, firstname.lastname@domain,
     first-initial-lastname@domain) if Hunter returns no high-confidence match
   - Returns null if both fail (skipped_reason = 'no_contact_email')
   - Gated behind lead_gen_enabled kill-switch (no API calls when false)
   - HUNTER_API_KEY added to .env.example

2. lib/lead-gen/draft-generator.ts (new):
   - Exports generateDraft(args: ...) matching spec §8.1 signature exactly
   - Loads system prompt from lib/lead-gen/prompts/outreach-system.md (file must exist)
   - Calls ANTHROPIC_API_KEY via @anthropic-ai/sdk (haiku-4-5 model, not opus)
   - Includes Spam Act footer in system prompt instructions
   - Runs checkBrandVoiceDrift after generation (one auto-regen on fail, second fail flags)
   - Returns { subject, bodyMarkdown, modelUsed, promptVersion, generationMs }
   - Gated behind lead_gen_enabled AND llm_calls_enabled kill-switches

3. lib/lead-gen/prompts/outreach-system.md (new):
   - Version-controlled system prompt for cold outreach drafts
   - Includes: track-aware instructions (saas vs retainer), viabilityProfile JSON
     interpolation instruction, Spam Act footer template, "do not hallucinate" guard
   - prompt_version: "v1"

4. lib/lead-gen/orchestrator.ts (edit):
   - After scoring, inserts lead_candidates rows for qualified candidates
     (resolves PATCHES_OWED lg_4_lead_candidates_not_inserted_by_orchestrator)
   - Calls discoverContact(domain) for each qualified candidate
   - If no contact found: marks candidate skipped_reason = 'no_contact_email'
   - If contact found: calls generateDraft(), inserts outreach_drafts row with
     status = 'pending_approval', sets lead_candidates.pending_draft_id
   - All external calls gated behind lead_gen_enabled kill-switch
   - Returns updated orchestration result with lead_candidates_inserted count

5. HUNTER_API_KEY in .env.example

6. tests/lead-gen/lg9-draft.test.ts (new):
   - discoverContact: mock Hunter API, verify role preference, verify pattern fallback,
     verify null on both fail
   - generateDraft: mock @anthropic-ai/sdk, verify signature match, verify Spam Act
     footer present, verify drift-check calls checkBrandVoiceDrift
   - orchestrator integration: mock discovery + generateDraft, verify lead_candidates
     rows inserted after scoring

7. npx tsc --noEmit → 0 errors
8. npm test → green
9. npm run build → clean
10. npm run lint → clean
11. G10.5 non-UI fidelity grep: all AC keywords in diff, no whitelist violations
```

---

## 4. Skill whitelist

- `claude-api` — generateDraft() calls @anthropic-ai/sdk; includes prompt caching
- `drizzle-orm` — lead_candidates + outreach_drafts row insertion patterns

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/discovery.ts` — new — Hunter.io email discovery
- `lib/lead-gen/draft-generator.ts` — new — generateDraft() implementation
- `lib/lead-gen/prompts/outreach-system.md` — new — version-controlled system prompt
- `lib/lead-gen/orchestrator.ts` — edit — insert lead_candidates + call discovery + draft
- `.env.example` — edit — add HUNTER_API_KEY
- `tests/lead-gen/lg9-draft.test.ts` — new — unit tests

---

## 6. Settings keys touched

- **Reads:** `lead_generation.standing_brief` (passed as standingBrief to generateDraft), `lead_generation.daily_max_per_day`
- **Seeds:** none (keys already exist from LG-1)

---

## 7. Preconditions (G1)

- [ ] `lib/db/schema/lead-candidates.ts` exports `leadCandidates` — verify: `grep "export const leadCandidates" lib/db/schema/lead-candidates.ts`
- [ ] `lib/db/schema/outreach-drafts.ts` exports `outreachDrafts` — verify: `grep "export const outreachDrafts" lib/db/schema/outreach-drafts.ts`
- [ ] `lib/lead-gen/orchestrator.ts` exists — verify: `ls lib/lead-gen/orchestrator.ts`
- [ ] `lib/lead-gen/scoring.ts` exports `scoreCandidate` — verify: `grep "export.*scoreCandidate\|export.*function score" lib/lead-gen/scoring.ts`
- [ ] `lib/kill-switches.ts` exports `lead_gen_enabled` and `llm_calls_enabled` — verify: `grep "lead_gen_enabled\|llm_calls_enabled" lib/kill-switches.ts`
- [ ] `ANTHROPIC_API_KEY` in `.env.example` — verify: `grep "ANTHROPIC_API_KEY" .env.example`
- [ ] `checkBrandVoiceDrift` is importable — verify: `grep "export.*checkBrandVoiceDrift" lib/email/brand-voice-drift.ts 2>/dev/null || grep -r "checkBrandVoiceDrift" lib/ | head -3`
- [ ] `npx tsc --noEmit` passes before starting

---

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — new lib files + orchestrator edit; no migrations (lead_candidates and outreach_drafts tables already exist from LG-1). Rollback = `git revert`.

---

## 9. Definition of done

- [ ] `lib/lead-gen/discovery.ts` exists with `discoverContact()` export
- [ ] `lib/lead-gen/draft-generator.ts` exists with `generateDraft()` export
- [ ] `lib/lead-gen/prompts/outreach-system.md` exists
- [ ] `lib/lead-gen/orchestrator.ts` updated — inserts lead_candidates rows
- [ ] `HUNTER_API_KEY` in `.env.example`
- [ ] `tests/lead-gen/lg9-draft.test.ts` green
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10.5 non-UI fidelity grep: PASS (all AC keywords in diff, no whitelist violations)
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-10)

LG-10 is the approval queue UI + send pipeline — the last session in Wave 13. Key context:
- `outreach_drafts` table will have rows with `status = 'pending_approval'` after LG-9
- `lead_candidates.pending_draft_id` set by LG-9 orchestrator
- Approval UI lives at `/lite/admin/lead-gen/drafts/` (new admin route)
- Send pipeline: on approval, call `sendEmail()` (A7), insert `outreach_sends` row,
  update `outreach_drafts.status = 'approved_queued'` then `'sent'`
- Kill-switch: `outreach_send_enabled` gates actual send; `lead_gen_enabled` gates UI fetch
- Key spec reference: `docs/specs/lead-generation.md` §9 (approval queue + earned autonomy)
- LG-10 is the Wave 13 closing session — write Wave 14 (IF-1..IF-E2E) briefs per G11.b
  wave-handoff rule. IF sessions depend on BDA-4 (brand DNA gate), SW-2 (step-types),
  Stripe Payment Element (A7/B-series).
- After LG-10 commits, write .autonomy/PAUSED for wave-boundary checkpoint (G12.5).

# `LG-9` — Lead Gen contact discovery + draft generator — Session Brief

> **Pre-compiled by LG-8 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

---

## 1. Identity

- **Session id:** `LG-9`
- **Wave:** `13 — Lead Generation` (9 of 10)
- **Type:** `FEATURE`
- **Model tier:** `/normal` (Sonnet)
- **Sonnet-safe:** `yes`
- **Estimated context:** `medium`
- **G0.5 input budget estimate:** ~18k tokens (brief + excerpts + last 2 handoffs). Under 35k.

---

## 2. Spec excerpts

### Excerpt 1 — Contact email discovery §7

Source: `docs/specs/lead-generation.md` §7

```
## 7. Contact email discovery

### 7.1 Hunter.io as primary

Once a candidate clears scoring + qualification, the pipeline resolves a contact email:

1. Hunter.io Domain Search API — pass the candidate domain, receive ranked contacts
   (name, role, email, confidence).
2. Prefer contacts with `role` matching a closed list:
   founder, ceo, owner, marketing-manager, marketing-director, growth-lead.
3. If Hunter returns a high-confidence match, store email_confidence = 'verified'.
4. If Hunter returns only low-confidence or no match, fall back to pattern inference:
   try firstname@domain, firstname.lastname@domain, first-initial-lastname@domain.
   Store the best guess with email_confidence = 'inferred'.
5. If both fail, candidate is skipped with skipped_reason = 'no_contact_email'.

### 7.2 Inferred emails get a softer send posture

- Draft is still generated.
- Send is still allowed (no way to verify without trying).
- Bounce on an inferred-email first touch is treated as normal, not as a reputation
  incident. The candidate is marked skipped, not escalated.
```

### Excerpt 2 — Draft generation §8.1–§8.4

Source: `docs/specs/lead-generation.md` §8

```
### 8.1 The draft generator function

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
}): Promise<{ subject: string; bodyMarkdown: string; modelUsed: string;
              promptVersion: string; generationMs: number }>

### 8.2 Prompt inputs (composed, not baked)

- System prompt from lib/lead-gen/prompts/outreach-system.md (no inlined prompt
  strings in route handlers — §12.E).
- SuperBad Brand DNA profile read into system prompt (the client's is not available;
  SuperBad's own is used per Foundations §11.5).
- SuperBad business context from superbad-business-context skill.
- viabilityProfile fed in as structured JSON.
- Prior touches supply thread context for follow-ups and nudges.

### 8.3 Required output discipline

- Every draft has a subject AND a body.
- Body includes Spam Act footer block: unsubscribe link (unsigned token for v1 stub),
  sender identity (Andy Robinson, SuperBad Media, Melbourne address), reason for sending.
- Body must never invent facts not in viabilityProfile.

### 8.4 Drift check (Foundations §11.5)

Every generated draft passes through checkBrandVoiceDrift(draft, superbadBrandDnaProfile)
before the draft is shown in the queue. One automatic regen on drift failure; second
failure surfaces a visible "voice drift flagged" warning without blocking.
```

### Excerpt 3 — lead_candidates schema §4.1 (needed for row insertion)

Source: `docs/specs/lead-generation.md` §4.1

```
lead_candidates: id, lead_run_id, company_name, domain, contact_email,
  contact_name, contact_role, email_confidence ('verified'|'inferred'|null),
  viability_profile_json (full ViabilityProfile snapshot),
  qualified_track ('saas'|'retainer'), saas_score, retainer_score,
  status (10-value enum — store 'pending_review' on insert),
  skipped_at, skipped_reason, promoted_to_deal_id (FK deals.id),
  pending_draft_id (FK outreach_drafts.id), created_at.
```

### Excerpt 4 — outreach_drafts schema §4.2 (needed for draft row insertion)

Source: `docs/specs/lead-generation.md` §4.2

```
outreach_drafts: id, candidate_id (FK lead_candidates.id), deal_id (FK deals.id nullable),
  sequence_id (FK outreach_sequences.id nullable), touch_kind
  ('first_touch'|'follow_up'|'stale_nudge'), touch_index (int),
  subject, body_markdown, model_used, prompt_version,
  drift_check_flagged (bool default false), drift_check_score (real nullable),
  approval_kind ('manual'|'auto_send'|'nudged_manual' nullable),
  approved_at, approved_by, generation_ms, nudge_thread_json, created_at.
```

**Audit footer:**
- `docs/specs/lead-generation.md` §7 — full Hunter.io discovery rules
- `docs/specs/lead-generation.md` §8 — full draft generation rules
- `docs/specs/lead-generation.md` §4.1–§4.2 — table schemas

---

## 3. Acceptance criteria

```
LG-9 is done when:

1. HUNTER_IO_API_KEY added to .env.example

2. lib/lead-gen/email-discovery.ts exports discoverContactEmail(domain, dbInstance?):
   - Calls Hunter.io Domain Search API (external_call_log entry per call)
   - Prefers contacts matching role closed list (founder/ceo/owner/marketing-*)
   - Falls back to pattern inference if no high-confidence Hunter result
   - Returns { email, name?, role?, email_confidence: 'verified'|'inferred' } | null
   - Returns null if both Hunter + inference fail (skipped_reason = 'no_contact_email')
   - Gated behind lead_gen_enabled kill-switch

3. lib/lead-gen/prompts/outreach-system.md exists — v1 prompt stub
   (system role: tone, constraints, Spam Act footer requirements, no-hallucination guard)

4. lib/lead-gen/draft-generator.ts exports generateDraft(args):
   - Haiku-tier (cost discipline for first_touch bulk drafts; spec allows Haiku for drafts)
   - Reads prompt from lib/lead-gen/prompts/outreach-system.md
   - Passes viabilityProfile as structured JSON in user message
   - Returns { subject, bodyMarkdown, modelUsed, promptVersion, generationMs }
   - Logs to external_call_log (actor: 'internal', service: 'anthropic')
   - Gated behind lead_gen_enabled + llm_calls_enabled kill-switches

5. lib/lead-gen/orchestrator.ts updated — steps 8–10 wired after step 7:
   Step 8: insert lead_candidates rows for each qualified candidate
     (domain, company_name, qualified_track, saas_score, retainer_score,
      viability_profile_json, status='pending_review', lead_run_id)
   Step 9: for each candidate, call discoverContactEmail(domain)
     — update lead_candidates row with contact_email / contact_name / contact_role / email_confidence
     — if null: set skipped_at + skipped_reason='no_contact_email', skip to next
   Step 10: for each non-skipped candidate, call generateDraft(...)
     — insert outreach_drafts row
     — update lead_candidates.pending_draft_id to new draft id

6. Tests:
   - lib/lead-gen/email-discovery.ts — at minimum: verified hit, low-confidence fallback
     to inference, no-match returns null (mock Hunter API via vi.mock)
   - lib/lead-gen/draft-generator.ts — subject+body returned, external_call_log entry
     created (mock Anthropic SDK)
   - Orchestrator integration: steps 8–10 produce expected lead_candidates + outreach_drafts
     counts (mock discoverContactEmail + generateDraft)

7. npx tsc --noEmit → 0 errors
8. npm test → green
9. npm run build → clean
10. npm run lint → clean
11. G10.5 (non-UI): fidelity grep — all AC keywords present in diff. PASS.
```

---

## 4. Skill whitelist

- `drizzle-orm` — insert lead_candidates + outreach_drafts rows

---

## 5. File whitelist (G2 scope discipline)

- `lib/lead-gen/email-discovery.ts` — new — Hunter.io lookup + pattern inference
- `lib/lead-gen/draft-generator.ts` — new — generateDraft() function
- `lib/lead-gen/prompts/outreach-system.md` — new — system prompt stub
- `lib/lead-gen/orchestrator.ts` — edit — add steps 8–10
- `tests/lead-gen/lg9-email-discovery.test.ts` — new
- `tests/lead-gen/lg9-draft-generator.test.ts` — new
- `.env.example` — edit — add HUNTER_IO_API_KEY

---

## 6. Settings keys touched

- **Reads:** `lead_gen_enabled` (kill-switch), `llm_calls_enabled` (kill-switch)
- **Seeds:** none (both keys already seeded by LG-1 / A5)

---

## 7. Preconditions (G1)

- [ ] `lib/lead-gen/orchestrator.ts` exports `runLeadGenDaily` — verify: `grep "export async function runLeadGenDaily" lib/lead-gen/orchestrator.ts`
- [ ] `lib/db/schema/lead-candidates.ts` exports `leadCandidates` — verify: `grep "export const leadCandidates" lib/db/schema/lead-candidates.ts`
- [ ] `lib/db/schema/outreach-drafts.ts` exports `outreachDrafts` — verify: `grep "export const outreachDrafts" lib/db/schema/outreach-drafts.ts`
- [ ] `lib/lead-gen/dnc.ts` exports `isBlockedFromOutreach` — verify: `grep "export async function isBlockedFromOutreach" lib/lead-gen/dnc.ts`
- [ ] `lib/kill-switches.ts` exports `lead_gen_enabled` — verify: `grep "lead_gen_enabled" lib/kill-switches.ts`
- [ ] `lib/lead-gen/types.ts` exports `ViabilityProfile` — verify: `grep "ViabilityProfile" lib/lead-gen/types.ts`
- [ ] `npx tsc --noEmit` passes before starting

---

## 8. Rollback strategy (G6)

- [x] `feature-flag-gated` — all new code gated behind `lead_gen_enabled` kill-switch (already in `lib/kill-switches.ts`). Rollback = flip flag off.

---

## 9. Definition of done

- [ ] `lib/lead-gen/email-discovery.ts` exports `discoverContactEmail` — verify: `grep "export async function discoverContactEmail" lib/lead-gen/email-discovery.ts`
- [ ] `lib/lead-gen/draft-generator.ts` exports `generateDraft` — verify: `grep "export async function generateDraft" lib/lead-gen/draft-generator.ts`
- [ ] `lib/lead-gen/prompts/outreach-system.md` exists — verify: `ls lib/lead-gen/prompts/outreach-system.md`
- [ ] `HUNTER_IO_API_KEY` in `.env.example` — verify: `grep "HUNTER_IO_API_KEY" .env.example`
- [ ] Orchestrator steps 8–10 exist — verify: `grep "Step 8\|Step 9\|Step 10" lib/lead-gen/orchestrator.ts`
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10.5 fidelity grep: all AC keywords present — `PASS`
- [ ] Memory-alignment declaration in handoff
- [ ] G-gates G0–G12 complete

---

## 10. Notes for the next-session brief writer (LG-10)

LG-10 is the approval queue UI + autonomy state machine. Key context:
- Approval queue spec: `docs/specs/lead-generation.md` §9 (9.1 queue surface, 9.2 autonomy graduation, 9.3 circuit breakers, 9.4 queue header)
- The queue lives at the existing `/lite/admin/lead-gen` page as a new tab or section (spec §9.1 says "one scrollable list")
- `transitionAutonomyState(track, event)` is the single function for state transitions (§12.F)
- Every transition writes to `activity_log` (§12.G)
- The 15-minute auto-send delay is enforced in the sequence runner, not the UI (§12.H)
- `autonomy_state` table from LG-1 holds per-track state
- LG-10 does NOT include the actual email send (Resend API call) — that's LG-10 or a follow-on
- Model tier: Sonnet (/normal) — UI + state machine work, no Opus needed

# START HERE

You are a fresh Claude Code session in the SuperBad Lite project directory. If Andy has just said **"let's go"** (or any variant), this file is your first read after `CLAUDE.md`.

## Your job in the first turn

1. Read `CLAUDE.md` in full (the full rules of engagement are there).
2. Read `SESSION_TRACKER.md` and find the **🧭 Next Action** block. It tells you which phase to run.
3. Match the phase to the protocol below.
4. Begin the phase. In your first message to Andy, say (in plain English) which phase you're in, what it's going to produce, and ask the first brainstorm question.

Do not dump this file's contents at Andy. Do not ask him which phase to run. The tracker decides, you execute.

---

## Phase 1 — Scope Brainstorm

**Goal:** decide what SuperBad Lite actually does. Ruthlessly limited.

**Output:** `SCOPE.md` — a short document listing the features Lite will include, in plain English, with explicit non-goals.

**Protocol:**

1. Start by reminding Andy of the goal of Lite: operations platform to take load off him (lead gen, sales, client management, daily planning, SaaS billing), beautifully designed, satisfying to use, built in weeks not months.
2. Brainstorm the scope **one multiple-choice question at a time**, following the brainstorm rules in `CLAUDE.md`:
   - Start broad (which operational areas matter most right now) and narrow down (what does "lead gen" look like in Lite — a CRM? an inbox? a scheduler?).
   - Every question has 3–5 options, a recommendation, and a rationale in plain English.
   - Self-check each option for cascading consequences before asking.
3. Cover at minimum:
   - Which of the five core areas (lead gen, sales, client mgmt, daily planning, SaaS billing) are **in** for v1 and which are deferred.
   - What the "daily planning" surface looks like (what Andy sees when he opens the app in the morning).
   - How SaaS subscriptions are handled (customer self-serve? Andy creates subs manually? Stripe Checkout?).
   - What the absolute minimum feature set is to make Lite useful on day one (MVP cut).
4. End the brainstorm with an **honest build/success reality check**: what's the hardest part, what could go wrong, is this actually doable in the time Andy has.
5. Write `SCOPE.md` and update `SESSION_TRACKER.md` to point at Phase 2.
6. Write `sessions/phase-1-handoff.md` — what was decided, what was deferred, open questions for Phase 2.

---

## Phase 2 — Foundations Brainstorm

**Goal:** lock in the tech stack, hosting, domain setup, auth, data model approach, and resolve the marketing-site access question.

**Output:** `FOUNDATIONS.md` — plain-English summary of the stack decisions, plus a one-paragraph justification for each.

**Protocol:**

1. Read `SCOPE.md` first. The stack has to serve the scope, not the other way round.
2. Brainstorm foundations one question at a time. Each question needs a recommendation with rationale in plain English. Andy cannot evaluate tech tradeoffs himself — make the call, explain the impact.
3. Cover:
   - **Framework:** Next.js App Router is almost certainly the answer (matches HQ, well-documented, lots of existing skills) but confirm explicitly.
   - **Database:** SQLite + Drizzle (simple, file-based, zero-ops) vs Postgres. Recommend SQLite for Lite.
   - **Auth:** NextAuth v5 / Auth.js with magic link email. Simplest thing that works.
   - **Payments:** Stripe Checkout + Billing Portal (hands off most of the work to Stripe).
   - **Email:** Resend (transactional) + one template for magic links.
   - **Hosting:** Vercel (simplest, zero-config) vs reusing HQ's Coolify+DigitalOcean setup. Recommend Vercel.
   - **Domain:** how `superbadmedia.com.au/lite` actually resolves (DNS, Cloudflare, path-based routing to a separate Vercel project or a subfolder in a monorepo).
   - **Marketing site access:** where does `superbadmedia.com.au/` currently live, and how do we edit it from this working directory? **This is the "Marketing site" question from CLAUDE.md — surface it early in Phase 2.** If the answer is "separate repo", decide whether to clone it into `/Users/Andy/Desktop/SuperBad Lite/marketing-site/` or reference it via symlink.
   - **Design system baseline:** one set of colours, one type scale, motion tokens, sound effect approach (for the "Apple-satisfying" feel Andy wants).
4. After decisions are locked, copy the relevant project skills from `/Users/Andy/superbad-hq/.claude/skills/` into `./.claude/skills/`. Likely set: `nextauth`, `stripe`, `drizzle-orm`, `tailwind-v4`, `nextjs16-breaking-changes`, `email-nodejs`, `react-19`, `framer-motion`, `nextjs-seo`, `webapp-testing`, `typescript-validation`. Copy, don't symlink — Lite needs to be independently maintainable.
5. Write `FOUNDATIONS.md`, update `SESSION_TRACKER.md` to point at Phase 3, write `sessions/phase-2-handoff.md`.

---

## Phase 3 — Feature Specs

**Goal:** turn each scoped feature into a concrete spec that a build session can implement without needing to re-decide anything.

**Output:** `docs/specs/<feature>.md` — one file per feature from SCOPE.md.

**Protocol:**

1. Read `SCOPE.md` and `FOUNDATIONS.md`.
2. **One feature per conversation.** Do not try to spec multiple features in a single session — context will burn out and quality will drop. If SCOPE.md has 5 features, Phase 3 is 5 sessions.
3. Each spec must cover:
   - **User story** — one paragraph in plain English: what Andy (or a customer) does, and what they get.
   - **UI description** — screen by screen, described in words. Reference the design system baseline from FOUNDATIONS.md.
   - **Data model** — what tables/fields are needed (Drizzle schema described in plain English, not code).
   - **Integrations** — any external APIs involved (Stripe, email, etc.).
   - **Success criteria** — how we'll know it works.
   - **Out of scope** — explicit non-goals to prevent scope creep.
4. For each spec session, brainstorm the open questions one multiple-choice question at a time (same rules).
5. After each spec, update `SESSION_TRACKER.md` and write a handoff note.
6. Phase 3 is done when every feature in SCOPE.md has a spec **and the Phase 3.5 review session has passed**.

---

## Phase 3.5 — Spec Review (exit gate)

**Goal:** before moving to the build plan, verify that nothing fell through the cracks across 17+ specs. One session, not a brainstorm — checklist-driven reconciliation.

**Output:** no new document. Patches to existing specs, SCOPE.md, FOUNDATIONS.md, and SESSION_TRACKER.md as needed. Write `sessions/phase-3.5-review-handoff.md` summarising what was caught and fixed.

**Protocol:**

1. **Backward reconciliation pass (SCOPE.md + FOUNDATIONS.md + locked specs).** Phase 3 brainstorms routinely surface principles, constraints, and facts that retroactively invalidate or extend earlier work. Before any forward reconciliation, sweep backward:
   - Re-read SCOPE.md and FOUNDATIONS.md in full.
   - Read `PATCHES_OWED.md` (see step 1a) as the consolidated list of crumbs.
   - Read every `sessions/phase-3-*-handoff.md` note and every memory entry in `~/.claude/projects/-Users-Andy-Desktop-SuperBad-Lite/memory/`.
   - **Lock-date filtering for specs.** For each locked spec, identify its lock date (in its handoff or in SESSION_TRACKER.md) and diff it against *only* the memories + principles added **after** that lock date. Diffing every locked spec against the entire memory pile is too much to hold in one session and produces false negatives. The set of "memories added after spec X locked" is the correct patch-candidate universe for spec X.
   - For each brainstorm insight, ask: does this change anything in SCOPE.md, FOUNDATIONS.md, or a locked spec? Examples: new cross-cutting principles (felt-experience-wins, motion-is-universal, passive-vs-active channels), new foundation primitives (LLM model registry, send-gate classification parameter), new scope items spawned mid-brainstorm that never made it back into SCOPE.md, scope items now obsolete because a later spec absorbed them, post-lock principles that invalidate a locked spec's assumption.
   - Produce a patch list and apply the patches in this same session. If the patch list is too large to apply in one session, split — but Phase 4 cannot start until it's cleared.
   - This step runs **first** because its output (a coherent SCOPE + FOUNDATIONS + locked-spec set) is the baseline for the remaining reconciliation steps.

   **1a. `PATCHES_OWED.md` ingestion.** One consolidated file at repo root (created and maintained from this point forward). Every spec session, every content mini-session, every brainstorm that identifies a patch owed on another spec/doc adds a row here — not just a mention in its handoff. Columns: target file, what to patch, why, who raised it, raised when. Phase 3.5 reads this as the authoritative list alongside handoffs. If a handoff names a patch that isn't also in `PATCHES_OWED.md`, that's a bug — treat the handoff as canonical for now but add the row so future phases don't lose it.
2. **Cross-spec flag reconciliation.** Every spec that raised a cross-spec flag (pipeline column additions, activity_log enum growth, new table columns on other specs, etc.) — verify that the receiving spec acknowledges the flag. If it doesn't, patch the receiving spec.

   **2a. Spec self-containment pass.** Rich cross-spec contract detail currently lives in `sessions/phase-3-*-handoff.md` notes — e.g. "Branded Invoicing refines Quote Builder's handler integration: first cycle enqueues `manual_invoice_generate` instead of `manual_invoice_send`." Handoffs are not loaded into Phase 5 build sessions by default. If a spec consumes or refines another spec's contract, inline that contract detail into the spec itself (usually in a "Cross-spec contracts" or "Integration points" section near the top). After this pass, each spec is complete reading it alone — a Phase 5 build session reading only its target spec should never need to reach into another spec's handoff to discover a contract. Explicit rule: handoff notes are ephemeral; specs are authoritative.
3. **Deferred task inventory.** Content mini-sessions, design-system-baseline revisit, admin-egg brainstorm, memory promotions, Foundations patches — compile a complete list. Verify every item is tracked in SESSION_TRACKER.md with clear sequencing. Flag anything that's been quietly dropped.

   **3a. Content-authoring output home + spec references.** Every content mini-session (Intro Funnel copy, Quote Builder emails, Brand DNA prompts, Cockpit brief templates, etc.) must commit its output to a structured file at `docs/content/<spec-name>.md` (or a subfolder if large — e.g. `docs/content/brand-dna/*.md`). Output does **not** live in the mini-session's handoff note. The consuming spec must be patched to reference `docs/content/<spec-name>.md` by path under a "Content source" heading. Phase 5 build sessions read the spec + the referenced content file; handoffs are supplementary, not authoritative. If any mini-session has already landed with output only in its handoff, re-home the output during this step.

   **3b. Prompt files as canonical source.** LLM prompts currently described in spec prose (e.g. "Opus prompt for draft-quote-from-context") must exist as their own files at `lib/ai/prompts/<prompt-name>.ts` (or `.md` for prose-only prompts until the foundation session lands TypeScript scaffolding). Spec references the file by path; spec prose describes the *intent* only, not the prompt text itself. Prevents drift where a content mini-session refines the prompt but the spec prose stays stale (or vice versa). If a spec currently contains full prompt text inline, extract it to a stub file and reference it; the foundation session populates the real file later.
4. **SCOPE.md vs specs alignment.** Every feature in SCOPE.md has a spec. Every spec traces back to a scoped feature. No orphans in either direction.
5. **Foundations patch list.** Every §11 addition owed (e.g. `sendEmail()` classification parameter), compiled into one consolidated list in the review handoff note so Phase 5 knows exactly what infrastructure patches to make before feature builds begin.
6. **Data model sanity check.** All table additions, enum extensions, and column flags from every spec reconciled into one coherent picture. Look for conflicts (two specs defining the same column differently), gaps (a spec references a table no spec defines), and bloat (columns that ended up unnecessary after later specs changed the approach).
7. **Shared-primitive registry pass.** Compile a single list of every shared primitive referenced across specs — tables (e.g. `scheduled_tasks`, `activity_log`, `external_call_log`, `settings`), functions (e.g. `sendEmail()`, `logActivity()`, `formatTimestamp()`, `settings.get()`, `getWaitingItems()`, `maybeRegenerateBrief()`, `getHealthBanners()`), background workers, URL paths (`/lite/...` routes both admin and client-facing), LLM job names in the model registry, email templates, PDF renderers, Claude prompts, **settings keys** (see step 7a). For each primitive, name the **canonical owner spec** (the one that defines it) and every **consumer spec** (the ones that call it). Any primitive with **no owner** (orphan) or **two owners** (collision) is a conflict — resolve in this same session: pick one canonical owner, patch the other spec to become a consumer, reconcile any contract differences. This step is specifically how we catch crossed wiring before it reaches Phase 4.

   **7a. Settings Key Registry sub-pass.** Walk every locked spec and extract every autonomy threshold / timeout / toggle / review window / auto-approval confidence cutoff / default value. Each becomes a row in `docs/settings-registry.md`: `{ key name (e.g. invoice.review_window_days), default value, type, consumer specs, human description }`. Key name convention: `<feature>.<rule>`, dot-delimited. Specs that currently express these as numeric or string literals (e.g. "3-day review window", "4-week warmup ramp", "reply auto-send if confidence ≥ 0.8") must be patched in this session to reference the key instead of the literal. Output is a single `docs/settings-registry.md` that Phase 4's foundation session uses to seed the `settings` table. **Why it lives in step 7 and not somewhere else:** settings keys ARE shared primitives — they cross every feature boundary — so the same owner/consumer discipline that catches crossed wiring catches missing settings conversion too. Every consumer named here inherits "use `settings.get()`, not a literal" as a precondition on its Phase 5 build session.
8. **Glossary / naming consistency pass.** 18+ specs have drifted terminology — e.g. Prospect vs Lead vs Candidate vs Contact, Quote vs Proposal, Client vs Customer vs Account, Subscriber vs Client (SaaS vs retainer). Pin one canonical term per concept in a glossary block inside `FOUNDATIONS.md` (or a new `GLOSSARY.md` if it grows past ~30 terms); patch every spec that uses a non-canonical variant. Without this, cross-spec contracts silently disagree and types end up with three names for the same thing.
9. **Permission / access matrix.** One table mapping every URL path and every API action (including background job triggers) to the roles that can invoke it: `admin` / `client` / `prospect` / `anonymous` / `system`. Catches holes (e.g. a `/lite/portal/*` page that forgot to gate on auth, or a scheduled task that executes with ambient admin privileges it shouldn't have). Every spec with a surface or an action gets checked against this matrix; the matrix itself lives in `FOUNDATIONS.md` or a companion file. This is also the source document for Phase 4's foundation-session permissions module.
10. **Subscription state machine reconciliation.** Quote Builder, SaaS Subscription Billing, Branded Invoicing, and Client Management all touch subscription state. Produce one canonical state machine diagram (states + transitions + side effects) in `FOUNDATIONS.md`; patch every spec that touches subscriptions to reference it rather than re-describing it. Any spec whose described transitions conflict with the canonical machine = fix the spec.
11. **End-to-end flow walkthrough.** Trace a real customer arc through the full stack of locked specs: outreach touch → reply → trial shoot booked → Brand DNA → retainer quote sent → quote accepted → first invoice → client portal active → content engine producing → cancel flow. For each handoff, verify the producing spec's output matches the consuming spec's input contract. Also walk the operator arc: cockpit brief references a waiting item → click through to its source surface → action taken → activity logged → next brief reflects it. This is specifically the check that specs-in-isolation reviews miss — a seam only shows up when you walk the whole product.
12. **GHL cutover acknowledgement (light).** GHL is current production but per memory `project_ghl_current_stack.md` Andy has no data in GHL he'd mourn losing (no clients, handful of leads already imported into HQ, basic web pages). So this step is a quick check: confirm no spec has quietly assumed a GHL data migration exists, and confirm the `superbadmedia.com.au` DNS/homepage cutover plan is named in Foundations. **Not** a full per-spec migration exercise — GHL just gets switched off whenever Lite is ready. If a spec does assume GHL data migrates, patch it to reflect "fresh-start" instead.
13. **Legal / compliance sweep.** Spam Act (outreach, newsletter auto-enrolment), Privacy Act (client data, Brand DNA, Client Context Engine), ATO (invoices — already covered), Stripe ToS (subscriptions with commitment-length terms, cancel-flow buyout mechanics), terms of service, privacy policy, cookie consent banner for public surfaces. Produce a single checklist of compliance requirements and the spec that owns each; flag any that have no owner (e.g. if no spec owns the privacy policy page, that's the gap).
14. **Marketing site status.** `CLAUDE.md` flags the marketing site as an open Foundations question — where it lives, how it's accessed, how it coexists with `/lite`. This is the last place to force it closed before Phase 4. If Phase 2 hasn't resolved it, spawn a mop-up to settle it now.
15. **Success metrics per spec.** Each feature names 1–3 metrics that define "working" (e.g. Outreach: reply rate ≥ X%; Brand DNA: assessment completion rate ≥ Y%; Quote Builder: quote→accept time median). Specs missing metrics = patch the spec. Phase 6 iteration is toothless otherwise; without metrics there's no way to tell what to tune.
16. **Honest gap check.** Ask Andy: anything you expected to see that isn't in a spec? One question, not a brainstorm — just a final safety net.

**Mop-up brainstorms (authorised, bounded).** If any of the reconciliation steps above surface a genuine unresolved gap — contradictory cross-spec contracts, a missing decision that BUILD_PLAN.md will depend on, a principle that needs ratifying across multiple specs — spawn a scoped mini-brainstorm to close it rather than deferring fuzz into Phase 4. Guardrails, non-negotiable:
- **One topic per mop-up, narrow.** If scope balloons, split into a second mop-up rather than letting the first sprawl.
- **No self-perpetuation.** A mop-up brainstorm must not spawn another mop-up as its primary output. If it needs to, the original scope was wrong — fold back in, don't chain.
- **Two chained mop-ups = hard stop.** Resolve the third gap with a best-call recommendation in the handoff; do not run a third session.
- **Track them.** Log each mop-up in SESSION_TRACKER.md with a one-line rationale (what gap, why it couldn't be deferred). If the list grows past ~3–4 in Phase 3.5, pause and reality-check with Andy before adding more.
- Mop-ups follow standard brainstorm rules (one multiple-choice question at a time, recommendation + rationale, plain English, self-check).

**Note on build code:** if Phase 5 has already begun when 3.5 runs (shouldn't happen under normal sequencing, but possible if a build session was pulled forward), the backward reconciliation pass must also diff patched SCOPE/FOUNDATIONS against any built code and flag rework. Until then, 3.5 is a docs-only gate.

Phase 3 is not complete until this session passes. Update SESSION_TRACKER.md to point at Phase 4 only after the review handoff is written.

---

## Phase 4 — Build Plan

**Goal:** order the feature specs into build sessions, each sized to finish in one conversation with headroom. Produce a dependency-ordered build plan.

**Output:** `BUILD_PLAN.md` — the ordered list of build sessions, with a one-line summary of each and its dependencies.

**Protocol:**

1. Read all of `docs/specs/*.md`.
2. For each spec, break it into atomic build sessions. A build session is: one feature surface, small enough to finish in a single Claude Code conversation with room for debugging.
3. Order by dependency — you can't build a feature that consumes auth before auth itself works.
4. **First build session must always be the foundation session.** Nothing visible to end users, but everything else depends on it. The foundation session builds: auth (NextAuth), database + initial Drizzle schema, base layout + design system tokens (colours, typography, motion constants, spacing scale), sound effect primitives, **env/secrets scaffolding** (all third-party integration keys declared, validated at boot, `.env.example` shipped), **permissions module** (derived from the Phase 3.5 access matrix — single source of truth for role checks), **glossary-derived TypeScript types** (from the Phase 3.5 glossary — `Prospect`, `Client`, `Subscriber`, etc.), **kill-switch layer** (central feature flags so outreach, scheduled tasks, LLM calls, and anything else risky can be disabled without a deploy), **`settings` table + `settings.get(key)` helper + seed migration** (seeded from `docs/settings-registry.md` produced in Phase 3.5 step 7a — every autonomy threshold the platform reads lives here from day one; v1.1 editor UI builds on this without backfill), **observability plumbing** (structured error logging, request/job tracing, `external_call_log` wiring, a single errors dashboard, **plus active cost alerts** — configurable thresholds that email Andy when Anthropic spend exceeds a daily cap, Stripe fee anomalies spike, or Resend sender hits a suspension-risk signal), **backup / DR** (automated SQLite backup cadence + documented restore procedure — single-server solo-founder means this cannot be deferred), **design system reference route at `/lite/_design`** (internal admin-only page showing every primitive — button variants, inputs, cards, modals, motion examples, sound triggers — with live tokens; stops visual drift across 50+ build sessions; ~30 min extra in foundation but saves hours of inconsistency downstream). If this list looks too big for one session, split into foundation-A and foundation-B; do not skip any item.
5. Tag each session with: type (FEATURE / INFRA / UI / FIX), estimated context budget (small / medium / large), and any preconditions.
6. **Build-session de-dup pass.** Using the shared-primitive registry produced in Phase 3.5 step 7, verify each primitive appears in the build output of **exactly one** session — the canonical owner's. Every other session that uses it is a **consumer** and must reference it, not rebuild it. Cross-check the full session list for overlaps on: URL paths (no two sessions building the same route), tables (no two sessions creating the same table), functions/helpers (no two sessions defining the same named function), workers (no two sessions spinning up the same background job type), LLM job names in the model registry, email templates, PDF renderers. Any overlap = collapse into one owner session + mark the others as consumers. This is the Phase 4 gate against crossed wiring making it into code.
7. **Consolidated cron / scheduled-task view.** One table in `BUILD_PLAN.md` listing every recurring or scheduled job across the platform — daily brief generation, monthly invoice chain, weekly inbox hygiene, warmup ramp ticks, quarterly model review, overdue-invoice reminders, pause-end notifications, card-expiry warnings, SaaS data-loss warnings, etc. Columns: job name, cadence, owner spec, handler, what it touches, kill-switch name. Catches accidental stampedes (two jobs firing at the same minute), missing monitors, and orphaned handlers. Every row must map to a scheduled-tasks entry or a cron trigger in code.
8. **Rollback strategy per session.** Phase 5 is designed to run hands-off, so every build session must declare its rollback before it ships: migration reversible (down-migration included), feature-flag-gated (the kill-switch exists to flip), or git-revertable with no data shape change. No session enters the build plan without one. AUTONOMY_PROTOCOL.md references this as a non-skippable verification gate.
9. **Settings-key wiring per session.** Every build session that touches an autonomy-sensitive rule lists (in its preconditions) the `settings` keys it consumes, pulled from `docs/settings-registry.md`. Its code uses `settings.get(key)` — never a literal. AUTONOMY_PROTOCOL.md adds this as a non-skippable verification gate: at end of each session, grep the session's diff for numeric and string literals in autonomy-sensitive locations (review windows, timeouts, thresholds, confidence cutoffs, ramp durations, retry counts, expiry periods, cadences). Any literal found = convert to `settings.get()` before the session ships.
10. **Final audit session — Settings Audit Pass.** Append one dedicated session at the end of the Phase 5 plan: grep across the full codebase for numeric/string literals in autonomy-sensitive paths, convert any stragglers, verify every key in `docs/settings-registry.md` maps to a real row in the `settings` table with the registered default, and verify every consumer spec actually reads what the registry says it reads. This is the net under the whole settings discipline — even if every per-session gate held, this session confirms it.
11. **AUTONOMY_PROTOCOL.md content — context-safety gates.** When Phase 4 writes AUTONOMY_PROTOCOL.md, it must include these non-skippable per-session gates (in addition to the motion-review, rollback, and settings gates already specified above):
    - **Preflight precondition verification.** Before touching any code, the session lists every precondition named in its handoff-of-record (files that should exist, tables that should exist, helpers that should be in place, settings keys that should be seeded) and verifies each exists in the repo via `ls`/grep/reading. If a precondition is missing, stop and either patch the missing piece or reroute — never build on a claim from a prior handoff that the repo doesn't back up. This catches the "prior session crashed before commit" failure mode.
    - **Mid-session context budget checkpoint.** At approximately 70% of context-window usage, the session writes an interim handoff summarising current progress + remaining work + mental state, then ends cleanly and schedules a fresh session to continue. The goal is to never debug hairy problems deep into a compressed context where the original spec has been pushed out. Better to end a session half-done with a clean handoff than to ship drift.
    - **Minimum-necessary skill loading.** Session loads only the skills its target work actually needs (e.g. `drizzle-orm` + `nextauth` for an auth-on-database session — not every project skill). Skill-loading eats context that should go to the spec. The session's precondition list names required skills explicitly.
    - **End-of-session artefact verification.** Before the session declares itself done, it lists every artefact it claims to have produced (files, tables, migrations, settings rows, etc.) and `ls`/greps to confirm each is actually in the repo and committed. Handoff is only written after verification passes.
    - **Typecheck + test gates, always.** Every session ends with `npx tsc --noEmit` zero-errors and `npm test` green before the handoff is written. Sessions that touch any of the 3–5 critical flows (trial shoot booking, quote accept, invoice pay, subscription signup, portal auth) must also run Playwright E2E smoke tests against their flow. E2E is optional elsewhere, mandatory on those flows.
12. **Write `LAUNCH_READY.md` alongside `BUILD_PLAN.md`.** Explicit gate file for Phase 6: the checklist of what must be true before v1.0 goes live. Seed list: DNS configured for `superbadmedia.com.au/lite`, email sender warmed up with SPF/DKIM/DMARC verified, Resend sender reputation clean, Stripe live keys rotated in, first automated backup confirmed restorable, kill switches wired + tested, cost alerts firing in dev, every critical-flow E2E smoke test passing against production, privacy policy + terms of service published, first dry-run synthetic client completed end-to-end (see Phase 6 step 1). Phase 6 cannot start until every row checks.
13. Update `SESSION_TRACKER.md` to point at the first build session in Phase 5.
14. Write `sessions/phase-4-handoff.md`.

**Mop-up brainstorms (authorised, bounded).** If BUILD_PLAN.md cannot be written without a decision that was never made — a dependency order that hinges on an unresolved contract, a sequencing question that can't be answered from the specs alone, a missing AUTONOMY_PROTOCOL rule — stop and brainstorm that decision, then resume. Same guardrails as Phase 3.5: one narrow topic per mop-up, no mop-up spawns another mop-up as its primary output, two chained = hard stop (best-call recommendation, no third), log each in SESSION_TRACKER.md with a one-line rationale. Reality-check with Andy if the list grows past ~3–4.

---

## Phase 5 — Build Execution

**Goal:** build the platform, session by session, without drift.

**Protocol (for every build session):**

1. Read the last 2 handoff notes from `sessions/`.
2. Read the spec for the feature being built.
3. Implement. Touch only what the spec says.
4. **Verification before marking done:**
   - Typecheck: `npx tsc --noEmit` — zero errors.
   - Tests: `npm test` — green.
   - Manual browser check — feature works end to end.
5. Write `sessions/<session-id>-handoff.md`.
6. Update `SESSION_TRACKER.md` Next Action pointer.

If verification fails: stop, diagnose root cause, fix. Do not bulldoze. Do not bypass checks.

---

## Phase 6 — Launch

**Protocol:**

1. **Dry-run / fire drill.** Before pointing DNS, run a full synthetic client through the entire stack on the staging URL or a routed preview: fake prospect → outreach touch → simulated reply → trial shoot booking → Brand DNA → retainer quote → invoice → portal. Every handoff between features verified manually. Catches integration failures that unit/E2E tests miss.
2. **`LAUNCH_READY.md` checklist verification.** Walk the checklist produced in Phase 4 step 12. Every row must be ticked before proceeding. Anything unticked = fix and re-check; do not skip.
3. Configure `superbadmedia.com.au/lite` DNS + path routing (decided in Phase 2).
4. Deploy to production.
5. Configure Stripe live keys (Andy must do this manually — the keys never live in the repo).
6. Smoke test every feature on production.
7. **Shadow period — Andy uses Lite on himself for two weeks before any external client touches it.** Run your own real work (admin tasks, any inbound lead, your own outreach, your own internal content) through Lite while stakes are zero. Surfaces the visceral day-in-life friction we already named (mobile, calendar split, dry-voice saturation, decision fatigue) when it's cheap to fix.
8. **Write `INCIDENT_PLAYBOOK.md`** — one short doc covering: common failure modes + triage steps + when to flip a kill switch vs roll back vs patch + communication template for affected clients + key support contacts (Stripe, Resend, Coolify, etc.). Andy is solo; the playbook is the colleague.
9. Write `sessions/phase-6-handoff.md` documenting the live URLs, env vars needed, monitoring setup, dry-run results, shadow-period observations, and any patches applied during shadow.

---

## Meta rules that apply to every phase

- Brainstorm format: **one multiple-choice question at a time, recommendation with rationale, plain English**. Violating this is the single most common failure mode — do not.
- When in doubt, split. New scope inside a brainstorm = new session.
- Compact context between sessions. A fresh conversation is cheaper than a confused one.
- If you finish a phase and the tracker isn't updated, the phase isn't done.

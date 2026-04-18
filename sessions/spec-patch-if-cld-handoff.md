# `SPEC-PATCH-IF-CLD` — Intro Funnel Pixieset→Cloudinary spec patch — Handoff

**Closed:** 2026-04-18
**Type:** Spec patch (no code changes)
**Model tier:** Sonnet

---

## What was patched

Rewrote every active Pixieset reference in `docs/specs/intro-funnel.md` to reflect the Cloudinary delivery model (decided during Wave 10 planning, memory `project_media_delivery_cloudinary`). This unblocks Wave 14 (IF-1 onward) to build against the correct integration.

### Key changes

1. **§15 full rewrite** — "Deliverables spec (Pixieset integration)" → "Deliverables spec (Cloudinary integration)". Added REWRITTEN banner with provenance.

2. **§15.1 flow** — Bundle gate trigger changes from "Andy pastes Pixieset URL" to "Andy uploads to Cloudinary via admin UI → clicks Publish gallery". Endpoint: `POST /api/deals/[id]/gallery-ready` (was `POST /api/deals/[id]/pixieset-gallery`). Server stores `cloudinary_gallery_folder` on deals + `intro_funnel_submissions`.

3. **§15.2** — was "Portal gallery launch card" (link-out CTA to Pixieset). Now "Portal gallery page" — native in-portal page at `/portal/[token]/gallery` owned by CLD-2. `deliverables_viewed` fires on page mount (not CTA click). Tier-2 reveal moved to bundled hub (CM-7).

4. **§15.3** — was "Pixieset integration posture (Path B)". Now "Cloudinary integration posture" — references CLD-1/CLD-2, Cloudinary SDK, signed upload presets.

5. **§15.4** — was "30+ days is Pixieset's responsibility". Now retention is Andy-controlled via Cloudinary account. No fallback "contact Andy" screen needed.

6. **Data model (§4.2)** — `deals.pixieset_gallery_id` + `deals.pixieset_gallery_url` → `deals.cloudinary_gallery_folder` (single column).

7. **State machine (§5.1)** — annotation updated: "both Cloudinary upload confirmed AND Six-Week Plan approved".

8. **Routes (§6.2)** — `/lite/intro/[token]/deliverables` now redirects to `/portal/[token]/gallery` (CLD-2).

9. **Admin routes (§6.5)** — `POST /api/deals/[id]/pixieset-gallery` → `POST /api/deals/[id]/gallery-ready`.

10. **UI surfaces (§7.1)** — `deliverables_ready` state description updated for bundled hub + native gallery.

11. **Pipeline panel (§7.3)** — "Pixieset gallery URL input" → "Gallery upload" (Cloudinary upload zone + Publish button).

12. **Settings (§7.6)** — "Pixieset / Twilio" → "Cloudinary / Twilio". Cloudinary wizard handled by CLD-1.

13. **Journey narration (§3 steps 6+8)** — "pastes Pixieset URL" → "publishes Cloudinary gallery". Full step 8 rewritten.

14. **Reflection timing (§13.1)** — "Pixieset gallery URL is pasted" → "Cloudinary gallery is published".

15. **Notifications (§17.3)** — "Pixieset gallery URL pasted" → "Cloudinary gallery published".

16. **Cross-spec flags (§19.1)** — `pixieset_gallery_id, pixieset_gallery_url` → `cloudinary_gallery_folder`.

17. **Cross-spec flags (§19.2)** — "native Pixieset gallery" → "native Cloudinary gallery".

18. **Cross-spec flags (§19.3)** — Pixieset not-a-dependency note replaced with Cloudinary dependency note referencing CLD-1.

19. **Cross-spec flags (§19.4)** — Setup wizards reference updated to Cloudinary.

20. **Build-time disciplines (§20.6)** — `parsePixiesetUrl()` dropped. Gallery folder validation delegated to CLD-1's `lib/cloudinary/` module.

21. **Open questions (§21 #6)** — Pixieset API capability marked RESOLVED.

22. **Risks (§22 #2)** — "Pixieset API capability risk" → "Cloudinary upload reliability" (chunked uploads, retry, per-file progress).

23. **Risks (§22 #9)** — "Deliverables retention dependency on Pixieset" → "Cloudinary storage cost at scale".

24. **Sequencing (§23 session 10)** — "Pixieset integration + native gallery component" → "Gallery upload UI (Cloudinary, consumes CLD-1)".

25. **Reality check (§25)** — Removed Pixieset from unknowns.

### Other files patched

- **SCOPE.md** — "Pixieset gallery delivery" → "Cloudinary gallery delivery" (§18 Intro Funnel shape). "SerpAPI, Pixieset, Graph API" → "SerpAPI, Cloudinary, Graph API" (§16 Observatory).

- **PATCHES_OWED.md** — All F2.c Pixieset entries closed or marked SUPERSEDED/RESOLVED/MOOT with 2026-04-18 dates. Specific closures:
  - `BUILD_PLAN.md` Pixieset spike → **SUPERSEDED**
  - `intro-funnel.md` §15.1 `pixieset_gallery_id` dead column review → **RESOLVED** (columns replaced by `cloudinary_gallery_folder`)
  - `setup-wizards.md` SW-5 Pixieset wizard confirmation → **RESOLVED** (CLD-1 replaces)
  - `intro-funnel.md` §15.2 launch card content → **SUPERSEDED** (native gallery, not launch card)

### Remaining Pixieset references (intentional)

5 historical/provenance references retained in `intro-funnel.md`:
- §15 REWRITTEN banner (provenance)
- §15.3 heading + body (historical reference to P0 spike findings)
- §20.6 strikethrough (audit trail)
- §21 #6 strikethrough (audit trail)

These are read-only historical markers, not active spec language. No build session should treat them as actionable.

### Cross-spec Pixieset references NOT patched (out of scope)

Other specs still contain Pixieset references that will be resolved by their own build sessions:
- `docs/specs/client-management.md` — fallback chain, portal menu, gallery embed, external link categories, migration job. Patched by CLD-1/CLD-2/CM sessions.
- `docs/specs/setup-wizards.md` — vendor manifest example, wizard inventory, help escalation example, kill-switch message. Patched by CLD-1 session.
- `docs/specs/cost-usage-observatory.md` — vendor list, actor-attribution table. Patched by CLD-1 session (vendor manifest replacement).
- `docs/specs/six-week-plan-generator.md` — journey narration, non-converter lifecycle. Patched by SWP build sessions.
- `docs/specs/task-manager.md` — "uploaded to Pixieset" follow-up step. Patched by TM build sessions.
- Session handoff notes, CLOSURE_LOG, BUILD_PLAN — historical records, not patched.

## What the next session (BDA-5) inherits

BDA-5 is unrelated to Cloudinary. It's a Wave 3 catchup building client-facing Brand DNA portal paths, multi-stakeholder blends, and retake comparison flow. Required before CM-8 (portal retainer-mode kickoff).

Execution order after BDA-5: CMS-3 + CMS-4 (Batch B content) → Wave 10 catchup (CM-1 → CLD-1 → CLD-2 → CM-7 → ... → CM-E2E) → Wave 14 (IF-1 → IF-E2E).

# `PM-6` — Visual Remediation Discipline Patch — Handoff

**Closed:** 2026-04-19
**Type:** DISCIPLINE (doc-only)
**Model tier:** Haiku (zero code)

---

## What was done

Extended AUTONOMY_PROTOCOL.md §G0 with a new bullet requiring portal, intro funnel, and cockpit UI sessions to cite their matching `mockup-*.html` in brief §2a before proceeding. Mirrors the existing admin-interior discipline bullet.

### Files edited (2)

- `AUTONOMY_PROTOCOL.md` — new §G0 bullet: "Portal / Intro Funnel / Cockpit surfaces (added 2026-04-19, PM-6)"
- `PATCHES_OWED.md` — `bdapolish1_visual_remediation_backlog` marked CLOSED

### Mockup → route mapping established

| Surface | Mockup | Downstream sessions |
|---|---|---|
| Portal (`/lite/portal/**`) | `mockup-client-portal.html` | CM-5+ |
| Intro Funnel (`/get-started/**`) | `mockup-intro-funnel.html` | IF-1+ |
| Cockpit (`/lite/admin/cockpit/**`) | `mockup-cockpit-interactive.html` | DC-1+ |

## What the next session should know

- All three surfaces are still unbuilt — the discipline patch lands preventatively, not retroactively.
- Brief writers for CM-5, IF-1, and DC-1 must include the mockup path in §2a or the session will hard-stop at G0.
- No code changes, no verification gates needed.

## Rollback strategy

**Doc-only.** Git-revertable.

# Setup Wizards — Nudge Emails (canonical content)

> Canonical source for the copy used by `wizard_resume_nudge`,
> `wizard_expiry_warn`, and `wizard_expire` handlers. Mirrored into
> `lib/wizards/nudge/content.ts` as typed constants. If you change copy
> here, update the mirror in the same session.
>
> Voice: dry, observational, self-deprecating, slow burn. No synergy,
> leverage, solutions. Short sentences. Follows `superbad-brand-voice`.

All three emails use `classification: "transactional"` — they are
user-initiated flow continuations, not outreach. Quiet window + outreach
kill-switch do not apply.

---

## 1. `wizard_resume_nudge` — 24h idle

Sent 24h after `last_active_at_ms` on an in-flight `wizard_progress` row
(gated by `wizards.resume_nudge_hours`).

### Subject pool (one picked at send)

- `Your setup is still there. Exactly where you left it.`
- `The setup tab is waiting. Patiently. Ish.`
- `You paused halfway through. No judgement. Just a nudge.`
- `Half a wizard, still alive.`

### Body

> Hey — you started **{wizardName}** yesterday and then life happened.
>
> It's still there. Same spot. No need to start again.
>
> {resumeLink}
>
> — SuperBad

---

## 2. `wizard_expiry_warn` — 1 day before expiry

Sent on `expires_at_ms − 1 day`. Gives a last chance before the row gets
marked abandoned.

### Subject pool

- `Your half-finished setup expires tomorrow.`
- `One day left on that paused wizard.`
- `Tomorrow this setup disappears. Last call.`

### Body

> One day left on your **{wizardName}** setup. After tomorrow the
> in-progress state gets cleared and you'd start from step one.
>
> Takes about two minutes to finish.
>
> {resumeLink}
>
> — SuperBad

---

## 3. `wizard_expire` — at expiry

Marks the `wizard_progress` row abandoned (`reason: "expired"`) and logs
a `wizard_abandoned` activity event. No email sent at this stage — the
warn email already gave the heads-up, and a "you ran out of time" email
would read as scold. Handler is data-only.

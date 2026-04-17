# Morning Digest Email — Voice Copy

> Canonical voice reference for `lib/graph/digest.ts`.
> Tone: admin-roommate. Dry, observational, never pitches.

---

## Subject lines

- **Zero silenced:** `Inbox digest — nothing silenced overnight. Suspicious.`
- **One silenced:** `Inbox digest — 1 thing you didn't need to see.`
- **All noise:** `Inbox digest — {N} things you didn't need to see.`
- **Mixed (some non-noise):** `Inbox digest — {N} silenced, {M} might be worth a look.`

## Body opener

- **Zero:** `Nothing silenced in the last 24 hours. Either the inbox is quiet, or the classifier is asleep. Either way, you're clear.`
- **Non-zero:** `{N} messages handled without you. Here's the summary.`

## Section headers

- **Noise group:** `NOISE` (uppercase micro-label, muted)
- **Non-noise group:** `WORTH A LOOK` (uppercase micro-label, muted)

## Import completion note

When a history import finishes within the digest window:

`History import finished — {N} messages sorted.`

## Footer

`Sent by Lite because you weren't looking. If this keeps arriving and you don't want it, something has gone wrong on my end.`

---

## Voice notes

- Never excited. Never sells.
- Digest arrives at 08:00 Melbourne — it's the first thing Andy sees. Keep it short.
- Zero-silenced days still send (configurable) — the line acknowledges the absence without making it seem like a failure.
- "Things you didn't need to see" is better than "filtered messages" — own the decision, don't describe the mechanism.
- The footer is self-deprecating without being needy. It's not asking to be kept; it's acknowledging that if it's annoying, the system has a bug.

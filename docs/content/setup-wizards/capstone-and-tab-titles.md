# Setup Wizards — Capstone Line + Tab-Title Pools

> Canonical source for the critical-flight capstone ceremony copy and
> the browser tab-title rotation pools. Phase 5 build session reads
> this file.

---

## 1. Critical-flight capstone

Fires once, ever, per admin account — after the third critical wizard
(Graph API) completes. The ceremony is: motion + sound + this line +
cockpit landing.

### The line

> SuperBad is open for business.

No alternatives. No rotation. This is it. Black Han Sans, large, centred.
Warm Cream on Dark Charcoal. Holds for 3 seconds before the "done" CTA
fades in.

### Capstone "done" CTA

> Take me to the cockpit.

---

## 2. Browser tab-title pools

Sprinkle claim: `docs/candidates/sprinkle-bank.md` §2 browser tab
titles, claimed by setup-wizards.

### Admin tone (uses "SuperBad Lite")

**Setting up:**
- SuperBad Lite — connecting {vendor}
- SuperBad Lite — setup in progress
- SuperBad Lite — wiring up {vendor}

**Connecting (waiting on vendor response):**
- SuperBad Lite — waiting on {vendor}
- SuperBad Lite — verifying connection
- SuperBad Lite — checking {vendor}

**Confirming (review-and-confirm step):**
- SuperBad Lite — almost there
- SuperBad Lite — one more step
- SuperBad Lite — confirm and done

**Connected (celebration step):**
- SuperBad Lite — {vendor} connected
- SuperBad Lite — done
- SuperBad Lite — sorted

**Stuck (help escalation active):**
- SuperBad Lite — {vendor} needs attention
- SuperBad Lite — stuck on step {n}
- SuperBad Lite — let's fix this

### Client tone (uses "SuperBad", never "Lite")

**Setting up:**
- SuperBad — setting you up
- SuperBad — getting started
- SuperBad — connecting your account

**Connecting:**
- SuperBad — working on it
- SuperBad — hang on a moment
- SuperBad — almost connected

**Confirming:**
- SuperBad — almost there
- SuperBad — just confirming
- SuperBad — one more thing

**Connected:**
- SuperBad — all set
- SuperBad — you're in
- SuperBad — done

**Stuck:**
- SuperBad — let's try that again
- SuperBad — need a hand?
- SuperBad — we'll sort this out

---

## Selection rules

- One title per wizard state, picked from the matching phase pool.
- `{vendor}` resolves to the human-readable vendor name from the
  `VendorManifest` (e.g. "Pixieset", "Stripe", "Meta Ads").
- `{n}` resolves to the current step number (1-indexed).
- Tab title updates on every step transition.
- Audience determined by `WizardDefinition.audience`.

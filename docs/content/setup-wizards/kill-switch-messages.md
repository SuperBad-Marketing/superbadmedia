# Setup Wizards — Kill-Switch Maintenance Messages

> Canonical source for the maintenance messages shown when a vendor's
> integration is kill-switched during or before a wizard attempt.
> Phase 5 build session reads this file.
>
> Two audiences. Client: branded, gentle, no technical detail, no action
> required. Admin: terse, references the kill-switch key, actionable.

---

## 1. Generic templates

### Client-facing

> {Vendor} connection is temporarily on hold while we sort something
> out. No action needed from you — we'll let you know when it's back.

### Admin-facing

> {Vendor} disabled. Kill switch: `{killSwitchKey}`. Check
> `external_call_log` for recent errors. Flip it back when resolved.

---

## 2. Vendor-specific client variations

Where the generic message doesn't convey the right thing, use these
instead. Only needed where the client's understanding of impact differs
from a generic "on hold" framing.

### Graph API (email sync)

> Email sync is paused while we sort out a connection issue. Your
> messages are safe — nothing's lost. We'll let you know when it's back.

### Stripe (payments)

> Payment processing is temporarily paused. No charges will be
> attempted until we've resolved this. If you have a payment due,
> we'll handle the timing.

### Pixieset (gallery sync)

> Gallery sync is on hold. Your photos are safe on Pixieset — we just
> can't pull them right now. Should be back shortly.

### Meta Ads (ad management)

> Ad management tools are temporarily offline. Your campaigns are still
> running on Meta — we just can't make changes from here right now.

### Google Ads

> Google Ads tools are temporarily offline. Your campaigns are still
> running — we can't make changes from here right now.

### Twilio (SMS)

> SMS is temporarily unavailable. If you're expecting a message from
> us, it'll come through once this is resolved.

---

## 3. Vendor-specific admin variations

Only where the generic admin message needs more context.

### Stripe

> Stripe disabled. Kill switch: `integrations.stripe.enabled`.
> **Payment-affecting.** Check webhook delivery + API errors in
> external_call_log before re-enabling. Verify with a test charge.

### Graph API

> Graph API disabled. Kill switch: `integrations.graph_api.enabled`.
> OAuth tokens may need refresh if this was triggered by a 401 burst.
> Check token expiry before re-enabling.

### Twilio

> Twilio disabled. Kill switch: `integrations.twilio.enabled`.
> Check sender reputation and delivery logs. Re-enable only after
> confirming the sending number isn't flagged.

---

## 4. Mid-wizard kill-switch message

If a kill-switch fires *during* an in-flight wizard (rare):

### Client-facing

> We've hit a temporary issue with {vendor}. Your progress is saved —
> come back anytime and pick up where you left off. We'll let you know
> when it's resolved.

### Admin-facing

> {Vendor} kill-switch fired mid-wizard. Progress preserved in
> `wizard_progress`. Kill switch: `{killSwitchKey}`. Investigate before
> resuming.

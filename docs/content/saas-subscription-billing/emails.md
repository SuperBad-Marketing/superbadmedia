# SaaS Subscription Billing — Email Templates

**Surface:** 9 billing lifecycle emails. **Spec:** `docs/specs/saas-subscription-billing.md` §9, §12.2, §14. **Author:** Claude (CMS-4). All route through `sendEmail()` gate, `classification: 'transactional'`. Bypass quiet window (§11.4).

Voice: clear, dry, honest. No corporate billing language. SaaS emails sign off "SuperBad" not "Andy" (per CMS-2 convention).

---

## Conventions

- **From name:** `SuperBad`
- **From address:** `billing@superbadmedia.com.au`
- **Sign-off:** `SuperBad` (Playfair italic)
- **Footer:** `SuperBad Marketing · Melbourne` + manage billing link
- **Threading:** `In-Reply-To` / `References` for follow-up emails in the same billing event chain

---

## 1. Payment confirmation

Triggered on each successful `invoice.paid` webhook.

**Subject:** `Payment received — ${amount}`

**Body:**

```
Payment confirmed.

${amount} inc. GST charged to {cardBrand} ending {last4}
{productName} — {tierName} ({billingCadence})
Next charge: {nextChargeDate}

[View invoice →]

SuperBad
```

---

## 2. Payment failed

Triggered on `invoice.payment_failed` webhook (first failure).

**Subject:** `Payment didn't go through`

**Body:**

```
Your payment of ${amount} didn't go through.

Card: {cardBrand} ending {last4}
Reason: {declineReason}

This happens. Update your card and we'll retry immediately.
Your data's safe — nothing's been deleted or locked yet.

[Update card →]

SuperBad
```

**Note:** "nothing's been deleted or locked yet" — the lockout happens after this email, on subsequent page load. The email arrives first as a chance to fix before they see the lockout.

---

## 3. Card expiring soon

Triggered 30 days before card expiry via `saas_card_expiry_warning` scheduled task.

**Subject:** `Your card expires next month`

**Body:**

```
The card on file ({cardBrand} ending {last4}) expires {expiryMonth}/{expiryYear}.

If it's not updated before your next payment on {nextChargeDate},
the charge will fail and your account will be locked.

Takes 30 seconds.

[Update card →]

SuperBad
```

---

## 4. Annual renewal reminder

Triggered 7 days before annual renewal via `saas_annual_renewal_reminder` scheduled task.

**Subject:** `Annual renewal in 7 days — ${amount}`

**Body:**

```
Your {productName} subscription renews on {renewalDate}.

{tierName} — ${amount} inc. GST
Card: {cardBrand} ending {last4}

If everything looks right, you don't need to do anything.
If you want to change your plan or cancel, do it before {renewalDate}.

[Manage subscription →]

SuperBad
```

---

## 5. Subscription cancelled confirmation

Triggered on cancellation (any path — post-term cancel, buyout, paid remainder). The dying-fall voice.

**Subject:** `Cancelled.`

**Body:**

```
Your {productName} subscription is cancelled.

{accessEndDescription}
Your data stays for 30 days after that. Download anything you need.

We're not going to pretend this email is easy to write.
The door's open if you come back.

SuperBad
```

**`accessEndDescription` variants:**
- Post-term cancel: `Access continues until {endOfPeriodDate}.`
- Paid remainder: `Access continues until {committedUntilDate}. Your ${remainderAmount} payment covers the rest.`
- Buyout: `Access ended today.`

---

## 6. Pause confirmation

Triggered when subscriber pauses their subscription.

**Subject:** `Paused for 30 days`

**Body:**

```
Your {productName} subscription is paused.

No charges until {resumeDate}.
Your data and settings stay exactly as they are.
We'll email you 3 days before it resumes.

Take the time.

SuperBad
```

---

## 7. Upgrade/downgrade confirmation

Triggered on tier change.

**Subject (upgrade):** `Upgraded to {newTierName}`
**Subject (downgrade):** `Switching to {newTierName}`

**Body (upgrade):**

```
Done. You're on {newTierName} now.

{dimensionChangeSummary}
Pro-rated charge of ${proratedAmount} on your next invoice.

[View your plan →]

SuperBad
```

**Body (downgrade):**

```
Your plan switches to {newTierName} on {effectiveDate}
(the end of your current billing period).

{dimensionChangeSummary}
Nothing changes until then.

[View your plan →]

SuperBad
```

**`dimensionChangeSummary` example:**
```
Posts per month: 4 → 10
Newsletter subscribers: 500 → 2,500
```

---

## 8. Product switch confirmation

Triggered when subscriber switches from one product to another.

**Subject:** `Switched to {newProductName}`

**Body:**

```
You're now on {newProductName} ({newTierName}).

Your commitment carries over — no new setup fee.
Usage counters have reset for the new product's dimensions.

{newDimensionSummary}

[Go to {newProductName} →]

SuperBad
```

---

## 9. Data-loss warning (escalation)

Triggered 7 days after first payment failure if unresolved. Via `saas_data_loss_warning` scheduled task. The most urgent email in the system — honest but still has character.

**Subject:** `Your data's at risk — {productName}`

**Body:**

```
We've tried to charge your card three times and it's not going through.

{productName} — {tierName}
Amount due: ${amount} inc. GST
First failure: {firstFailureDate}

Your account is locked. Your data is still here — for now.
If this isn't resolved in the next few days, we'll need to start
talking about what happens next.

We don't delete anything without telling you first.
But we can't hold it indefinitely.

[Update card now →]

If something's wrong beyond the card, reply to this email.
A person reads it.

SuperBad
```

---

## Voice register notes

- "Payment didn't go through" throughout (not "failed", not "declined", not "billing error"). Conversational framing.
- "Your data's safe" appears in payment-failed and lockout contexts. Repeating it is intentional — it's the first concern.
- The cancelled email ("We're not going to pretend this email is easy to write") is the dying-fall moment. It should feel like the end of something, not a retention attempt. The "door's open" line is the earned CTA.
- The data-loss warning is the only email with real urgency. "A person reads it" is the human moment in an otherwise automated chain.
- No exclamation marks anywhere. No "Congratulations!" on upgrade. No "Sorry to see you go!" on cancel.
- All amounts GST-inclusive per `feedback_felt_experience_wins`. The subscriber sees what they pay.

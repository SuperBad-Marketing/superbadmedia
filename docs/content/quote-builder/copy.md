# Quote Builder — Client-Facing Copy

> Canonical source for all non-email, non-terms copy on the Quote Builder
> surfaces. Phase 5 build sessions read this file for exact copy strings.
>
> Voice: dry, observational, self-deprecating, slow burn. Never explain
> the joke. Ban "synergy", "leverage", "solutions". Short sentences.
> Client surfaces use "SuperBad", never "SuperBad Lite".

---

## 1. Section headings (5 scroll-snap sections)

| Section | Heading | Notes |
|---|---|---|
| §1 | What you told us | Personal. Specific. Sets the frame. |
| §2 | What we'll do | Direct. No "proposed deliverables." |
| §3 | The price | Adding "the" makes it conversational, not transactional. |
| §4 | The terms | Plain. Not "terms and conditions." |
| §5 | Say yes | More human than "Accept." An invitation, not a command. |

---

## 2. Accept section copy

**Tickbox label:**
> I've read and agree to the terms.

**Accept button (pre-tick):**
> Accept quote

**Accept button (post-tick, Payment Element about to mount):**
> Accept & pay

**Step-back link (under Payment Element):**
> Changed your mind? Go back.

**Fine-print above Payment Element (Stripe-billed):**
> Your card is charged once today. After that, {retainer_monthly_formatted}/month on the {billing_day_ordinal} until the commitment ends — or until you say stop.

**Fine-print above Payment Element (project-only):**
> One-time payment. No recurring charges.

**Fine-print above Payment Element (mixed):**
> Your card is charged {total_formatted} today. After that, {retainer_monthly_formatted}/month on the {billing_day_ordinal} until the commitment ends.

---

## 3. Confirmation screen (Q16)

### Stripe-billed

**Headline:** Payment received.

**Dry line (Playfair italic):**
> The boring part's over. The good part's next.

**Fact block:**
- Receipt ref: {stripe_receipt_ref}
- [Download receipt →]
- [Manage billing →]

**Closer:**
> Andy's got it from here.

### Manual-billed

**Headline:** Accepted.

**Dry line (Playfair italic):**
> Paperwork done. Work starts.

**Fact block:**
- First invoice lands {first_invoice_date}
- [View your invoices →]

**Closer:**
> Andy's got it from here.

---

## 4. URL state cards (superseded / withdrawn / expired)

### Superseded

**Heading:** This quote has been updated.

**Body:**
> A newer version replaced this one on {superseded_date}. Everything you
> need is in the new version.

**CTA:** [Read the updated quote →]

### Withdrawn

**Heading:** This quote is no longer active.

**Body:**
> Andy pulled this one on {withdrawn_date}. If the conversation's still
> alive, reach out — no need to start over.

**Contact:** andy@superbadmedia.com.au

### Expired

**Heading:** This quote expired.

**Body:**
> It hit the expiry date on {expired_date}. These things happen — timing
> is everything.
>
> If you're still interested, reply to the original email or get in touch
> below. Andy can put a fresh one together.

**Contact:** andy@superbadmedia.com.au

---

## 5. Loading states (draft generation, 2–4s)

Rotation pool, one shown per generation:

1. "Reading the thread…"
2. "Pulling what you told us…"
3. "Building the scope…"
4. "Assembling the quote…"
5. "Almost there…"

---

## 6. Empty states

### No catalogue items yet (Settings → Catalogue)
> No items in the catalogue yet. Add your first service and it'll show up
> in every quote from here.

### No context for intro paragraph (draft editor)
> Not enough context yet — write one line, or pull a thread from the
> discovery call.

### No templates saved (Settings → Templates)
> No templates yet. Save a quote structure you use often and load it next
> time in two clicks.

### No quotes on a deal (deal drawer)
> No quotes on this deal yet.

### No upgrade options (post-term retention, already on highest tier)
> You're already on the biggest retainer we offer. If you need more,
> Andy will build something custom.

### No downgrade options (post-term retention, already on lowest tier)
> You're already on the smallest retainer.

---

## 7. Low-confidence warning

Appears on the intro paragraph when Claude drafted from rank-4 sources
only (LLM inference, no client docs or direct notes).

**Badge text:** Low confidence

**Tooltip:**
> This was drafted without any direct notes or client-supplied docs.
> It's a starting point — review it closely before sending.

---

## 8. Provenance hints

Appears below the intro paragraph in the draft editor, showing which
source ranks Claude drew from.

**Format:** "Drafted from: {source_description}"

| Ranks used | Display text |
|---|---|
| 1 only | Drafted from: client-supplied docs |
| 1 + 3 | Drafted from: client docs + activity log |
| 2 + 3 | Drafted from: direct notes + activity log |
| 3 only | Drafted from: activity log |
| 4 only | Drafted from: general context *(low confidence)* |
| 1 + 2 + 3 | Drafted from: client docs + notes + activity log |
| Mixed with 4 | Drafted from: {higher ranks} + general context |

---

## 9. Draft editor — catalogue affordances

**Catalogue price updated since draft:**
> Price updated since this was added. Refresh to ${new_price}?

**Catalogue item deleted since draft:**
> This item was removed from the catalogue. It's still in this quote —
> remove it or keep it as a one-off.

---

## 10. Send modal copy

**Quiet-window status (inside window):**
> Sends now.

**Quiet-window status (outside window):**
> Outside send window. Queued for {next_window_time}.

**Quiet-window override toggle:**
> Send anyway

**Drift indicator — green:**
> Voice check passed.

**Drift indicator — amber:**
> Voice check flagged borderline. Review the copy.

---

## 11. Browser tab titles

**Draft editor:** SuperBad Lite — editing quote for {company_name}

**Send modal:** SuperBad Lite — sending quote

**Client quote page:** SuperBad — your quote from Andy

**Client confirmation:** SuperBad — confirmed

**Superseded/withdrawn/expired:** SuperBad — quote unavailable

---
spec: docs/specs/branded-invoicing.md
status: stub
populated-by: Branded Invoicing content mini-session (can fold into Quote Builder's)
---

# Branded Invoicing prompts

## `invoice-draft-send-email`

**Tier:** Opus. **Intent:** draft the email when an invoice is dispatched. **Input:** Brand DNA + Client Context + invoice details + company/contact names + payment history. **Output:** subject_line + body_paragraphs + sign_off. Drift-checked; warm but professional. **Current inline location:** spec §6.1.

## `invoice-draft-reminder`

**Tier:** Opus. **Intent:** overdue reminder (automated + manual follow-ups). Tone scales with context — first reminder warm/good-faith; subsequent progressively direct. **Hard rule:** never use "overdue" in first-reminder subject line. **Current inline location:** spec §6.2.

## `invoice-draft-supersede-notification`

**Tier:** Haiku. **Intent:** short notification when a sent invoice is superseded. Functional, no drift-check, one paragraph max. **Current inline location:** spec §6.3.

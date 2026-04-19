# Free Audit Tool — LLM Prompts

## audit-category-explanation (Haiku)

**Job:** Generate a 2–3 sentence plain-English explanation of a business's performance in one audit category.

**Intent:** Honest read of what the signals say. Not a recommendation. Dry, observational voice. No jargon. No exclamation marks.

**Input context:**
- Business name
- Category name + grade + score
- Raw signal data for that category

**Output:** 2–3 sentences. Plain English. Direct.

---

## audit-followup-draft (Opus)

**Job:** Draft a follow-up email from Andy to the audit recipient, referencing their weakest category.

**Intent:** One sharp observation about their weakest area. Suggest a conversation, not a pitch. Short (3–5 sentences). Dry, direct voice. Sign off as Andy.

**Input context:**
- Contact name + email
- Company name + domain
- All category scores with grades
- Weakest category highlighted
- Viability profile signals

**Output:** Email body only (no subject). Voice-checked via `checkBrandVoiceDrift()` by the caller.

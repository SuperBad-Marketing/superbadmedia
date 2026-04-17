# Brand DNA — Alignment Gate

**Locked:** CMS-1 content mini-session, 2026-04-17.
**Spec ref:** `docs/specs/brand-dna-assessment.md` §3.2.

---

## Gate question

> **How much of your business is you?**

Shown once before the assessment begins. Answer stored as `alignment_gate` enum on the profile record. Routes to one of three assessment tracks.

---

## Options

**a) "It's me. The business is an extension of who I am."**
→ Routes to **Founder mode** (`founder`). All questions framed as "you."

**b) "It starts from me, but the brand has its own thing going."**
→ Routes to **Founder + Supplement mode** (`founder_supplement`). Full Founder assessment, then ~15 supplement questions capturing where the brand intentionally diverges.

**c) "We're separate. The brand has its own identity."**
→ Routes to **Business mode** (`business`). All questions framed as "the brand" / "the business" / "we."

---

## Design notes

- Three options, not four. This is a routing gate, not an assessment question. No tags awarded.
- The question is intentionally casual. Not "To what extent does your personal brand align with your business brand?" — just a straight question in plain English.
- The middle option ("starts from me, but...") captures the most common real answer for founder-led businesses with teams. It's the heaviest track (full assessment + supplement) but also the richest profile output.
- No "I'm not sure" option. The gate forces a lean. If they're genuinely unsure, "starts from me" is the safe default — the supplement captures the nuance.

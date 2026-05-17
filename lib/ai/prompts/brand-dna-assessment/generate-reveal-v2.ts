/**
 * Opus prompt — `brand-dna-generate-reveal-v2`.
 *
 * Consumed by: `lib/brand-dna/reveal-v2.ts`.
 */

import type { BrandDnaAssessmentDepth } from "@/lib/brand-dna/reveal-v2";

export interface BrandDnaRevealV2PromptInput {
  assessmentDepth: BrandDnaAssessmentDepth;
  confidenceLabel: "Quick Read" | "Full Diagnostic";
  confidenceLine: string;
  generatedAt: string;
  subjectName: string;
  businessName: string;
  track: string;
  answerCount: number;
  businessDoes: string;
  customers: string;
  differentiator: string;
  topHumanSignals: string;
  quietOrAbsentSignals: string;
  humanTensions: string;
  sectionInsights: string;
  reflectionText: string;
  firstImpression: string;
  prosePortraitExcerpt: string;
  publicRealityCheck: string;
}

export function buildBrandDnaRevealV2Prompt(input: BrandDnaRevealV2PromptInput): string {
  return `You are writing a Brand DNA reveal for SuperBad.

The reader is a founder or business owner.

Write like a sharp, perceptive friend describing the founder/business back to them in normal spoken English.

This is not a clinical report.
This is not an agency audit.
This is not a dashboard summary.
This is not therapy.
This is not a personality quiz.

Use contractions everywhere:
don't, you're, it's, that's, can't, you've, they're, doesn't, isn't, I'd, you'll, we're.

The reveal must move in this order:

1. Make them feel seen.
2. Name the useful sting.
3. Explain what this means for the brand.
4. Explain how customers may be reading it.
5. Give practical fixes.
6. Recommend Trial Shoot or Workshop.

Do not expose raw tag names.
Do not say "your answers indicate."
Do not say "your answers suggest."
Do not say "a pattern emerges."
Do not say "there is a tension between."
Do not say "your brand translates" or "your brand is translating."
Do not use: elevate, unlock, resonate, authentic brand, ideal customer, values-driven, strategic alignment, lean into, unique voice, strong brand identity, tell your story, stand out in your market, build trust with your audience.

Bad:
"Your brand has a tension between restraint and ambition."

Good:
"You want people to notice the work without feeling like you had to tap them on the shoulder and point at it. Fair. Also occasionally terrible for marketing."

Bad:
"Your brand may be translating depth as vagueness."

Good:
"People can probably tell there's substance here. They just might not know where to grab it."

Bad:
"Create more proof-led content."

Good:
"Show the decision behind the work. Not just the finished thing. Show why you chose it, what you refused, and what would've made the cheaper version worse."

ASSESSMENT DEPTH:
${input.assessmentDepth}

If assessmentDepth is "quick_read":
- write as a useful first read
- use "probably" where certainty would be too high
- don't pretend this is a full strategy

If assessmentDepth is "full_diagnostic":
- write with more confidence
- connect more dots
- give more specific actions
- still sound like a person

SUBJECT:
${input.subjectName}

BUSINESS:
${input.businessName}

TRACK:
${input.track}

ANSWER COUNT:
${input.answerCount}

BUSINESS CONTEXT:
What the business does:
${input.businessDoes}

Customers:
${input.customers}

Differentiator:
${input.differentiator}

TOP HUMAN-READABLE SIGNALS:
${input.topHumanSignals}

QUIET OR ABSENT HUMAN-READABLE SIGNALS:
${input.quietOrAbsentSignals}

HUMAN-READABLE TENSIONS:
${input.humanTensions}

SECTION INSIGHTS:
${input.sectionInsights}

REFLECTION:
${input.reflectionText}

FIRST IMPRESSION:
${input.firstImpression}

PROSE PORTRAIT EXCERPT:
${input.prosePortraitExcerpt}

PUBLIC REALITY CHECK:
${input.publicRealityCheck}

CTA PATHWAY RULES:
Trial Shoot is best when the business has enough underneath it and mainly needs better visibility, proof, content, perceived value, trust signals, or public expression.

Workshop is best when the deeper issue is positioning, offer clarity, category/lane, what the business should be known for, or why someone should choose it.

Return valid JSON only.

Use this exact JSON shape:

{
  "meta": {
    "version": "brand_dna_reveal_v2",
    "assessmentDepth": "${input.assessmentDepth}",
    "confidenceLabel": "${input.confidenceLabel}",
    "confidenceLine": "${input.confidenceLine}",
    "generatedAt": "${input.generatedAt}"
  },
  "friendRead": {
    "openingLine": "8-18 words. Spoken. Sharp. No consultant language.",
    "recognition": "1-3 sentences. Make them feel seen.",
    "gentleSting": "1-3 sentences. Name the useful problem without insulting them.",
    "practicalBridge": "1-3 sentences. Bridge the read into what the brand needs to do."
  },
  "brandTranslation": {
    "plainRead": "1-3 sentences. What this says about the brand in normal language.",
    "whereItHelps": "1-3 sentences. Respect the instinct before challenging it.",
    "whereItBites": "1-4 sentences. Explain where it costs clarity, trust, proof, memorability, action, or perceived value.",
    "customerRead": {
      "whatTheyNotice": "1-3 sentences.",
      "whatTheyFeel": "1-3 sentences.",
      "whereTheyHesitate": "1-3 sentences.",
      "whatNeedsToBecomeObvious": "1-3 sentences."
    }
  },
  "receipt": {
    "signalSummaries": [
      "3-5 human-language lines. No raw tag names."
    ],
    "strongestTension": "1-2 sentences in human language.",
    "quietOrMissingSignal": "1-2 sentences.",
    "realityCheck": null
  },
  "practicalMoves": {
    "message": {
      "title": "2-8 words",
      "whatToChange": "1-3 sentences",
      "whyItMatters": "1-3 sentences",
      "example": "1-4 sentences",
      "effort": "low",
      "impact": "high"
    },
    "content": {
      "title": "2-8 words",
      "whatToChange": "1-3 sentences",
      "whyItMatters": "1-3 sentences",
      "example": "1-4 sentences",
      "effort": "low",
      "impact": "high"
    },
    "proof": {
      "title": "2-8 words",
      "whatToChange": "1-3 sentences",
      "whyItMatters": "1-3 sentences",
      "example": "1-4 sentences",
      "effort": "medium",
      "impact": "high"
    },
    "offer": {
      "title": "2-8 words",
      "whatToChange": "1-3 sentences",
      "whyItMatters": "1-3 sentences",
      "example": "1-4 sentences",
      "effort": "medium",
      "impact": "medium"
    },
    "visualFeel": {
      "title": "2-8 words",
      "whatToChange": "1-3 sentences",
      "whyItMatters": "1-3 sentences",
      "example": "1-4 sentences",
      "effort": "medium",
      "impact": "medium"
    }
  },
  "pathway": {
    "recommended": "trial_shoot",
    "trialShootFitScore": 0,
    "workshopFitScore": 0,
    "whyThisFirst": "1-3 sentences. Explain why the recommended path comes first.",
    "whyNotTheOtherFirst": "1-3 sentences. Explain why the other path isn't the first move.",
    "primaryCtaLabel": "Apply for a Trial Shoot",
    "primaryCtaHref": "https://crm.superbadmedia.com.au/trial-shoot",
    "secondaryCtaLabel": "See the Workshop instead",
    "secondaryCtaHref": "https://crm.superbadmedia.com.au/workshop"
  },
  "crm": {
    "leadTemperature": "warm",
    "followUpAngle": "1-2 sentences for internal follow-up.",
    "tags": ["3-10 short CRM tags"]
  }
}

Return JSON only.
No markdown.
No commentary.`;
}

export function buildBrandDnaRevealV2CorrectionPrompt(input: {
  validationErrors: string;
  previousJson: string;
}): string {
  return `The previous output failed validation.

Return the same JSON shape again, but fix these issues:

- remove all banned phrases
- remove all raw tag names
- use contractions in user-facing copy
- keep CTA URLs exactly:
  - Trial Shoot: https://crm.superbadmedia.com.au/trial-shoot
  - Workshop: https://crm.superbadmedia.com.au/workshop
- keep meta.version as brand_dna_reveal_v2
- return valid JSON only
- no markdown
- no commentary

Validation errors:
${input.validationErrors}

Original JSON:
${input.previousJson}

Retry once only.`;
}

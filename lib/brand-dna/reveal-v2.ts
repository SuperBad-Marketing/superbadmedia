import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { z } from "zod";

import { db as globalDb } from "@/lib/db";
import { invokeLlmText } from "@/lib/ai/invoke";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { killSwitches } from "@/lib/kill-switches";
import {
  buildBrandDnaRevealV2CorrectionPrompt,
  buildBrandDnaRevealV2Prompt,
} from "@/lib/ai/prompts/brand-dna-assessment/generate-reveal-v2";
import { SIGNAL_DEFINITIONS } from "@/lib/brand-dna/signal-definitions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export const BRAND_DNA_TRIAL_SHOOT_URL =
  "https://crm.superbadmedia.com.au/trial-shoot";
export const BRAND_DNA_WORKSHOP_URL =
  "https://crm.superbadmedia.com.au/workshop";

export const BRAND_DNA_TRIAL_SHOOT_PRIMARY_LABEL = "Apply for a Trial Shoot";
export const BRAND_DNA_WORKSHOP_PRIMARY_LABEL = "Book the Workshop";
export const BRAND_DNA_TRIAL_SHOOT_SECONDARY_LABEL =
  "See the Trial Shoot instead";
export const BRAND_DNA_WORKSHOP_SECONDARY_LABEL =
  "See the Workshop instead";

export type BrandDnaAssessmentDepth = "quick_read" | "full_diagnostic";

export type BrandDnaRevealV2 = {
  meta: {
    version: "brand_dna_reveal_v2";
    assessmentDepth: BrandDnaAssessmentDepth;
    confidenceLabel: "Quick Read" | "Full Diagnostic";
    confidenceLine: string;
    generatedAt: string;
  };

  friendRead: {
    openingLine: string;
    recognition: string;
    gentleSting: string;
    practicalBridge: string;
  };

  brandTranslation: {
    plainRead: string;
    whereItHelps: string;
    whereItBites: string;
    customerRead: {
      whatTheyNotice: string;
      whatTheyFeel: string;
      whereTheyHesitate: string;
      whatNeedsToBecomeObvious: string;
    };
  };

  receipt: {
    signalSummaries: string[];
    strongestTension: string;
    quietOrMissingSignal: string;
    realityCheck: string | null;
  };

  practicalMoves: {
    message: PracticalMove;
    content: PracticalMove;
    proof: PracticalMove;
    offer: PracticalMove;
    visualFeel: PracticalMove;
  };

  pathway: {
    recommended: "trial_shoot" | "workshop";
    trialShootFitScore: number;
    workshopFitScore: number;
    whyThisFirst: string;
    whyNotTheOtherFirst: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
  };

  crm: {
    leadTemperature: "not_ready" | "warm" | "strong";
    followUpAngle: string;
    tags: string[];
  };
};

export type PracticalMove = {
  title: string;
  whatToChange: string;
  whyItMatters: string;
  example: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
};

export type HumanSignal = {
  tag: string;
  label: string;
  plainMeaning: string;
};

export const BRAND_DNA_HUMAN_SIGNAL_MAP: Record<
  string,
  { label: string; plainMeaning: string }
> = {
  quiet_confidence: {
    label: "quiet confidence",
    plainMeaning: "prefers the work to speak without begging for attention",
  },
  premium_positioning: {
    label: "premium standard",
    plainMeaning: "wants people to feel the standard before comparing price",
  },
  admires_restraint: {
    label: "restraint",
    plainMeaning: "respects what’s left out as much as what’s shown",
  },
  admires_boldness: {
    label: "boldness",
    plainMeaning: "respects clear choices that don’t apologise for themselves",
  },
  directness: {
    label: "directness",
    plainMeaning: "prefers saying the thing plainly",
  },
  warmth_in_voice: {
    label: "warmth",
    plainMeaning: "wants the brand to feel human and easy to approach",
  },
  proof: {
    label: "proof",
    plainMeaning: "trusts evidence more than claims",
  },
  perfectionism: {
    label: "perfectionism",
    plainMeaning: "keeps polishing after something is already good enough to show",
  },
  risk_caution: {
    label: "caution",
    plainMeaning: "wants enough certainty before making the move",
  },
  risk_appetite: {
    label: "risk appetite",
    plainMeaning: "can move before every answer is available",
  },
  conflict_avoidant: {
    label: "softened edges",
    plainMeaning: "may wrap the sharper point in bubble wrap",
  },
  conviction: {
    label: "conviction",
    plainMeaning: "has a line it doesn’t want to cross",
  },
  thought_leadership: {
    label: "authority",
    plainMeaning: "wants to be known for how it thinks, not just what it sells",
  },
  personality_forward: {
    label: "founder presence",
    plainMeaning: "the person behind the business matters to the brand",
  },
  systems_forward: {
    label: "system strength",
    plainMeaning: "wants the brand to work beyond one person’s presence",
  },
};

const BANNED_REVEAL_PHRASES = [
  "your answers indicate",
  "your responses indicate",
  "your answers suggest",
  "your responses suggest",
  "a pattern emerges",
  "there is a tension between",
  "your brand translates",
  "your brand is translating",
  "authentic brand",
  "brand authenticity",
  "elevate your brand",
  "unlock your potential",
  "connect with your audience",
  "ideal customer",
  "resonate with your audience",
  "values-driven",
  "strategic alignment",
  "brand archetype",
  "brand persona",
  "personality type",
  "build trust with your audience",
  "stand out in your market",
  "tell your story",
  "lean into",
  "unique voice",
  "strong brand identity",
  "main distortion",
];

const FORMAL_VARIANTS: Array<{ formal: string; preferred: string; re: RegExp }> = [
  { formal: "do not", preferred: "don't", re: /\bdo not\b/i },
  { formal: "you are", preferred: "you're", re: /\byou are\b/i },
  { formal: "it is", preferred: "it's", re: /\bit is\b/i },
  { formal: "that is", preferred: "that's", re: /\bthat is\b/i },
  { formal: "cannot", preferred: "can't", re: /\bcannot\b/i },
  { formal: "you have", preferred: "you've", re: /\byou have\b/i },
  { formal: "they are", preferred: "they're", re: /\bthey are\b/i },
  { formal: "does not", preferred: "doesn't", re: /\bdoes not\b/i },
  { formal: "is not", preferred: "isn't", re: /\bis not\b/i },
  { formal: "I would", preferred: "I'd", re: /\bI would\b/i },
  { formal: "you will", preferred: "you'll", re: /\byou will\b/i },
  { formal: "we are", preferred: "we're", re: /\bwe are\b/i },
];

const RAW_TAG_NAMES = new Set([
  ...Object.keys(SIGNAL_DEFINITIONS).filter((tag) => tag.includes("_")),
  "risk_appetite",
  "quiet_confidence",
  "premium_positioning",
  "admires_restraint",
  "confrontation_comfort",
]);

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);
const isoLike = z
  .string()
  .trim()
  .min(1)
  .regex(/^\d{4}-\d{2}-\d{2}T/, "must be an ISO-like string");

function wordBounded(label: string, min: number, max: number): z.ZodString {
  return z.string().trim().min(1).superRefine((value, ctx) => {
    const count = countWords(value);
    if (count < min || count > max) {
      ctx.addIssue({
        code: "custom",
        message: `${label} must be ${min}-${max} words`,
      });
    }
  });
}

const practicalMoveSchema = z.object({
  title: wordBounded("PracticalMove.title", 2, 8),
  whatToChange: nonEmpty(350),
  whyItMatters: nonEmpty(350),
  example: nonEmpty(500),
  effort: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high"]),
});

const pathwayLooseSchema = z.object({
  recommended: z.enum(["trial_shoot", "workshop"]),
  trialShootFitScore: z.number(),
  workshopFitScore: z.number(),
  whyThisFirst: nonEmpty(450),
  whyNotTheOtherFirst: nonEmpty(450),
  primaryCtaLabel: z.string().trim().min(1),
  primaryCtaHref: z.string().trim().min(1),
  secondaryCtaLabel: z.string().trim().min(1),
  secondaryCtaHref: z.string().trim().min(1),
});

export const brandDnaRevealV2LooseSchema = z
  .object({
    meta: z.object({
      version: z.literal("brand_dna_reveal_v2"),
      assessmentDepth: z.enum(["quick_read", "full_diagnostic"]),
      confidenceLabel: z.enum(["Quick Read", "Full Diagnostic"]),
      confidenceLine: nonEmpty(160),
      generatedAt: isoLike,
    }),
    friendRead: z.object({
      openingLine: wordBounded("friendRead.openingLine", 8, 18),
      recognition: nonEmpty(450),
      gentleSting: nonEmpty(450),
      practicalBridge: nonEmpty(450),
    }),
    brandTranslation: z.object({
      plainRead: nonEmpty(450),
      whereItHelps: nonEmpty(450),
      whereItBites: nonEmpty(650),
      customerRead: z.object({
        whatTheyNotice: nonEmpty(350),
        whatTheyFeel: nonEmpty(350),
        whereTheyHesitate: nonEmpty(350),
        whatNeedsToBecomeObvious: nonEmpty(350),
      }),
    }),
    receipt: z.object({
      signalSummaries: z.array(wordBounded("receipt.signalSummaries[]", 8, 24)).min(3).max(5),
      strongestTension: nonEmpty(350),
      quietOrMissingSignal: nonEmpty(350),
      realityCheck: z.string().max(450).nullable(),
    }),
    practicalMoves: z.object({
      message: practicalMoveSchema,
      content: practicalMoveSchema,
      proof: practicalMoveSchema,
      offer: practicalMoveSchema,
      visualFeel: practicalMoveSchema,
    }),
    pathway: pathwayLooseSchema,
    crm: z.object({
      leadTemperature: z.enum(["not_ready", "warm", "strong"]),
      followUpAngle: nonEmpty(300),
      tags: z.array(z.string().trim().min(1)).min(3).max(10),
    }),
  })
  .superRefine((value, ctx) => {
    const expected =
      value.meta.assessmentDepth === "quick_read"
        ? "Quick Read"
        : "Full Diagnostic";
    if (value.meta.confidenceLabel !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["meta", "confidenceLabel"],
        message: "confidenceLabel must match assessmentDepth",
      });
    }
  });

export const brandDnaRevealV2Schema = brandDnaRevealV2LooseSchema.superRefine(
  (value, ctx) => {
    const { pathway } = value;
    if (!Number.isInteger(pathway.trialShootFitScore)) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "trialShootFitScore"],
        message: "trialShootFitScore must be an integer",
      });
    }
    if (!Number.isInteger(pathway.workshopFitScore)) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "workshopFitScore"],
        message: "workshopFitScore must be an integer",
      });
    }
    for (const [path, score] of [
      ["trialShootFitScore", pathway.trialShootFitScore],
      ["workshopFitScore", pathway.workshopFitScore],
    ] as const) {
      if (score < 0 || score > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["pathway", path],
          message: `${path} must be 0-100`,
        });
      }
    }

    const hrefs = [BRAND_DNA_TRIAL_SHOOT_URL, BRAND_DNA_WORKSHOP_URL];
    if (!hrefs.includes(pathway.primaryCtaHref)) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "primaryCtaHref"],
        message: "primaryCtaHref must be an exact Brand DNA CTA URL",
      });
    }
    if (!hrefs.includes(pathway.secondaryCtaHref)) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "secondaryCtaHref"],
        message: "secondaryCtaHref must be an exact Brand DNA CTA URL",
      });
    }
    if (pathway.primaryCtaHref === pathway.secondaryCtaHref) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "secondaryCtaHref"],
        message: "secondaryCtaHref must be the other CTA URL",
      });
    }

    const trialPrimary = pathway.recommended === "trial_shoot";
    const expectedPrimaryHref = trialPrimary
      ? BRAND_DNA_TRIAL_SHOOT_URL
      : BRAND_DNA_WORKSHOP_URL;
    const expectedSecondaryHref = trialPrimary
      ? BRAND_DNA_WORKSHOP_URL
      : BRAND_DNA_TRIAL_SHOOT_URL;
    const expectedPrimaryLabel = trialPrimary
      ? BRAND_DNA_TRIAL_SHOOT_PRIMARY_LABEL
      : BRAND_DNA_WORKSHOP_PRIMARY_LABEL;
    const expectedSecondaryLabel = trialPrimary
      ? BRAND_DNA_WORKSHOP_SECONDARY_LABEL
      : BRAND_DNA_TRIAL_SHOOT_SECONDARY_LABEL;

    if (pathway.primaryCtaHref !== expectedPrimaryHref) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "primaryCtaHref"],
        message: "primary CTA must match recommended pathway",
      });
    }
    if (pathway.secondaryCtaHref !== expectedSecondaryHref) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "secondaryCtaHref"],
        message: "secondary CTA must be the other pathway",
      });
    }
    if (pathway.primaryCtaLabel !== expectedPrimaryLabel) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "primaryCtaLabel"],
        message: "primary CTA label must match recommended pathway",
      });
    }
    if (pathway.secondaryCtaLabel !== expectedSecondaryLabel) {
      ctx.addIssue({
        code: "custom",
        path: ["pathway", "secondaryCtaLabel"],
        message: "secondary CTA label must match the other pathway",
      });
    }
  },
);

export type RevealV2ValidationResult =
  | { success: true; data: BrandDnaRevealV2 }
  | { success: false; errors: string[] };

export function validateBrandDnaRevealV2(input: unknown): RevealV2ValidationResult {
  const parsed = brandDnaRevealV2Schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
    };
  }

  const contentErrors = validateRevealV2Copy(parsed.data as BrandDnaRevealV2);
  if (contentErrors.length > 0) {
    return { success: false, errors: contentErrors };
  }

  return { success: true, data: parsed.data as BrandDnaRevealV2 };
}

export function findBannedRevealPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_REVEAL_PHRASES.filter((phrase) => lower.includes(phrase));
}

export function findRawTagNamesInRevealCopy(text: string): string[] {
  const found: string[] = [];
  for (const tag of RAW_TAG_NAMES) {
    const re = new RegExp(`\\b${escapeRegExp(tag)}\\b`, "i");
    if (re.test(text)) found.push(tag);
  }
  if (/\bbrand_override\.[\w.]+\b/i.test(text)) {
    found.push("brand_override.*");
  }
  return [...new Set(found)];
}

export function findFormalContractionVariants(text: string): string[] {
  return FORMAL_VARIANTS.filter(({ re }) => re.test(text)).map(
    ({ formal, preferred }) => `${formal} -> ${preferred}`,
  );
}

export function inferBrandDnaAssessmentDepth(
  answerCount: number,
): BrandDnaAssessmentDepth {
  return answerCount <= 40 ? "quick_read" : "full_diagnostic";
}

export function getRevealV2ConfidenceLine(
  depth: BrandDnaAssessmentDepth,
  answerCount?: number,
): string {
  if (depth === "quick_read") {
    return "Quick Read · 33 answers · provisional, but useful";
  }

  if (typeof answerCount === "number" && answerCount > 40) {
    return `Full Diagnostic · ${answerCount} answers · deeper read`;
  }

  return "Full Diagnostic · deeper read · still written for actual humans";
}

export function enforceRevealV2Pathway(
  reveal: BrandDnaRevealV2,
  inputs: {
    assessmentDepth: BrandDnaAssessmentDepth;
    differentiator?: string | null;
  },
): BrandDnaRevealV2 {
  const trialScore = clampScore(reveal.pathway.trialShootFitScore);
  const workshopScore = clampScore(reveal.pathway.workshopFitScore);

  const scoreGap = Math.abs(trialScore - workshopScore);

  let recommended: "trial_shoot" | "workshop" =
    trialScore >= workshopScore ? "trial_shoot" : "workshop";

  const differentiator = (inputs.differentiator || "").trim().toLowerCase();

  const differentiatorLooksWeak =
    differentiator.length < 20 ||
    ["quality", "service", "experience", "passion", "care", "customer service", "we care"].some((weak) =>
      differentiator.includes(weak),
    );

  if (scoreGap <= 5) {
    if (differentiatorLooksWeak) {
      recommended = "workshop";
    } else if (inputs.assessmentDepth === "quick_read") {
      recommended = "trial_shoot";
    }
  }

  const primary =
    recommended === "trial_shoot"
      ? {
          primaryCtaLabel: "Apply for a Trial Shoot",
          primaryCtaHref: "https://crm.superbadmedia.com.au/trial-shoot",
          secondaryCtaLabel: "See the Workshop instead",
          secondaryCtaHref: "https://crm.superbadmedia.com.au/workshop",
        }
      : {
          primaryCtaLabel: "Book the Workshop",
          primaryCtaHref: "https://crm.superbadmedia.com.au/workshop",
          secondaryCtaLabel: "See the Trial Shoot instead",
          secondaryCtaHref: "https://crm.superbadmedia.com.au/trial-shoot",
        };

  return {
    ...reveal,
    pathway: {
      ...reveal.pathway,
      recommended,
      trialShootFitScore: trialScore,
      workshopFitScore: workshopScore,
      ...primary,
    },
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getBrandDnaRevealV2Fallback(input: {
  assessmentDepth: BrandDnaAssessmentDepth;
  answerCount?: number;
  differentiator?: string | null;
}): BrandDnaRevealV2 {
  const quickReadFallback: BrandDnaRevealV2 = {
    meta: {
      version: "brand_dna_reveal_v2",
      assessmentDepth: "quick_read",
      confidenceLabel: "Quick Read",
      confidenceLine: "Quick Read · 33 answers · provisional, but useful",
      generatedAt: new Date().toISOString(),
    },
    friendRead: {
      openingLine: "You’re probably better in real life than the brand is showing.",
      recognition: "There’s enough in this read to suggest the business has more underneath it than a stranger can quickly see. The standard might be there, but the public version may be making people work too hard to feel it.",
      gentleSting: "That’s not a disaster. It just means the brand may be relying on people to infer too much.",
      practicalBridge: "The first fix is to make the standard more obvious: clearer message, sharper proof, and a next step that doesn’t make people guess.",
    },
    brandTranslation: {
      plainRead: "This brand probably doesn’t need to become louder first. It needs to become easier to read.",
      whereItHelps: "The restraint can protect the brand from hype, overpromising, and looking like it’s trying too hard.",
      whereItBites: "The same restraint can also hide the strongest parts. If people can’t quickly see why the business is worth choosing, they’ll drift back to the easier option.",
      customerRead: {
        whatTheyNotice: "They may notice the business looks capable enough to consider.",
        whatTheyFeel: "They may not yet feel enough certainty to act.",
        whereTheyHesitate: "The hesitation likely forms around proof, clarity, or the next step.",
        whatNeedsToBecomeObvious: "The brand needs to show why this business is the better choice without needing a long explanation.",
      },
    },
    receipt: {
      signalSummaries: [
        "There’s likely more substance here than the public brand is making obvious.",
        "The brand needs to show more proof, not just explain the service.",
        "The next step should feel easier and clearer.",
      ],
      strongestTension: "The business may want to be noticed without looking like it’s chasing attention.",
      quietOrMissingSignal: "There may not be enough easy self-promotion in the brand yet, so visibility needs to feel like proof rather than performance.",
      realityCheck: null,
    },
    practicalMoves: {
      message: {
        title: "Say it sharper",
        whatToChange: "Stop leading with the service category. Lead with the situation your best customers are sick of.",
        whyItMatters: "People need a reason to care before they care how the service works.",
        example: "Instead of “We create content for local businesses,” try “For businesses that are better in real life than they look online.”",
        effort: "low",
        impact: "high",
      },
      content: {
        title: "Show the decision",
        whatToChange: "Make one post that explains a choice, not just an outcome.",
        whyItMatters: "People trust judgement when they can see it.",
        example: "Show why you chose a shot, changed a detail, refused a shortcut, or made the cheaper version worse on purpose.",
        effort: "low",
        impact: "high",
      },
      proof: {
        title: "Prove the standard",
        whatToChange: "Add one proof block that shows the standard before you claim it.",
        whyItMatters: "A stranger shouldn’t have to take your word for it.",
        example: "Use a before/after, a client note, a process detail, or a small decision that shows care.",
        effort: "medium",
        impact: "high",
      },
      offer: {
        title: "Clarify the next step",
        whatToChange: "Make the next step feel obvious and low-friction.",
        whyItMatters: "If people have to work out what happens after they click, you’re adding friction at the worst moment.",
        example: "Replace a vague enquiry CTA with “Start with a 20-minute fit check” or “Apply for a Trial Shoot.”",
        effort: "medium",
        impact: "medium",
      },
      visualFeel: {
        title: "Make it feel truer",
        whatToChange: "Use visuals that show the real standard of the business.",
        whyItMatters: "The brand should feel like the business before the copy has to explain it.",
        example: "Show people, process, texture, detail, environment, or proof instead of generic polished filler.",
        effort: "medium",
        impact: "medium",
      },
    },
    pathway: {
      recommended: "trial_shoot",
      trialShootFitScore: 65,
      workshopFitScore: 55,
      whyThisFirst: "The first visible gap looks like expression: proof, content, and making the business easier to trust from the outside.",
      whyNotTheOtherFirst: "A workshop may still help later, but this read doesn’t show enough evidence that strategy needs to be pulled apart first.",
      primaryCtaLabel: "Apply for a Trial Shoot",
      primaryCtaHref: "https://crm.superbadmedia.com.au/trial-shoot",
      secondaryCtaLabel: "See the Workshop instead",
      secondaryCtaHref: "https://crm.superbadmedia.com.au/workshop",
    },
    crm: {
      leadTemperature: "warm",
      followUpAngle: "Follow up around making the business feel as strong online as it likely is in real life.",
      tags: ["brand-dna", "quick-read", "trial-shoot-fit", "proof-gap"],
    },
  };

  const reveal: BrandDnaRevealV2 =
    input.assessmentDepth === "full_diagnostic"
      ? {
          ...quickReadFallback,
          meta: {
            version: "brand_dna_reveal_v2",
            assessmentDepth: "full_diagnostic",
            confidenceLabel: "Full Diagnostic",
            confidenceLine: getRevealV2ConfidenceLine(
              "full_diagnostic",
              input.answerCount,
            ),
            generatedAt: new Date().toISOString(),
          },
          friendRead: {
            openingLine: "You’ve got enough here to stop guessing and fix the right thing.",
            recognition: "This read has enough depth to show more than a surface-level brand gap. The business likely has a clearer internal standard than the outside world is currently getting.",
            gentleSting: "That means the problem probably isn’t effort. It’s translation: what’s obvious to you may not be obvious to the people deciding whether to trust you.",
            practicalBridge: "The next move is to make the strongest parts easier to feel, easier to prove, and easier to act on.",
          },
        }
      : quickReadFallback;

  return enforceRevealV2Pathway(reveal, {
    assessmentDepth: input.assessmentDepth,
    differentiator: input.differentiator,
  });
}

export async function generateBrandDnaRevealV2(
  profileId: string,
  sessionToken?: string,
  dbOverride?: AnyDb,
): Promise<BrandDnaRevealV2> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  const profiles = await database
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) {
    return getBrandDnaRevealV2Fallback({
      assessmentDepth: "quick_read",
      answerCount: 0,
    });
  }

  const [session] = sessionToken
    ? await database
        .select({
          name: rundownSessions.name,
          business_name: rundownSessions.business_name,
          gap_reveal_json: rundownSessions.gap_reveal_json,
        })
        .from(rundownSessions)
        .where(eq(rundownSessions.session_token, sessionToken))
        .limit(1)
    : [];

  const answerRows = await database
    .select({ id: brand_dna_answers.id })
    .from(brand_dna_answers)
    .where(eq(brand_dna_answers.profile_id, profileId));
  const answerCount = answerRows.length;

  const assessmentDepth =
    getExplicitAssessmentDepth(profile) ??
    getExplicitAssessmentDepth(session) ??
    inferBrandDnaAssessmentDepth(answerCount);
  const confidenceLabel =
    assessmentDepth === "quick_read" ? "Quick Read" : "Full Diagnostic";
  const confidenceLine = getRevealV2ConfidenceLine(
    assessmentDepth,
    answerCount,
  );

  const businessContext = parseBusinessContext(profile.business_context);
  const differentiator = businessContext?.differentiator ?? "";

  if (profile.reveal_v2_json) {
    try {
      const cached = JSON.parse(profile.reveal_v2_json);
      const validated = validateBrandDnaRevealV2(cached);
      if (validated.success) return validated.data;
    } catch {
      // corrupted cache — regenerate or fallback
    }
  }

  const fallback = () =>
    getBrandDnaRevealV2Fallback({
      assessmentDepth,
      answerCount,
      differentiator,
    });

  if (!killSwitches.llm_calls_enabled) {
    return fallback();
  }

  const [candidate] = profile.candidate_id
    ? await database
        .select({
          company_name: leadCandidates.company_name,
          viability_profile_json: leadCandidates.viability_profile_json,
        })
        .from(leadCandidates)
        .where(eq(leadCandidates.id, profile.candidate_id))
        .limit(1)
    : [];

  const generatedAt = new Date().toISOString();
  const prompt = buildBrandDnaRevealV2Prompt({
    assessmentDepth,
    confidenceLabel,
    confidenceLine,
    generatedAt,
    subjectName: profile.subject_display_name ?? session?.name ?? "this founder",
    businessName:
      session?.business_name ??
      candidate?.company_name ??
      profile.subject_display_name ??
      "this business",
    track: profile.track ?? "unspecified",
    answerCount,
    businessDoes: businessContext?.businessDoes ?? "Not provided.",
    customers: businessContext?.customers ?? "Not provided.",
    differentiator: businessContext?.differentiator ?? "Not provided.",
    ...preparePromptSignalInputs(profile.signal_tags),
    sectionInsights: formatSectionInsights(profile.section_insights),
    reflectionText: profile.reflection_text ?? "No reflection provided.",
    firstImpression: profile.first_impression ?? "No first impression cached yet.",
    prosePortraitExcerpt:
      profile.prose_portrait?.slice(0, 900) ?? "No prose portrait cached yet.",
    publicRealityCheck: formatPublicRealityCheck(
      session?.gap_reveal_json ?? null,
      candidate?.viability_profile_json ?? null,
    ),
  });

  const firstRaw = await callRevealV2Llm(prompt, profileId);
  const firstAttempt = parseValidateAndEnforceGeneratedReveal(firstRaw, {
    assessmentDepth,
    differentiator,
  });

  let finalAttempt = firstAttempt;
  if (!firstAttempt.success) {
    const correctionPrompt = buildBrandDnaRevealV2CorrectionPrompt({
      validationErrors: firstAttempt.errors.join("\n"),
      previousJson: firstRaw,
    });
    const retryRaw = await callRevealV2Llm(correctionPrompt, profileId);
    finalAttempt = parseValidateAndEnforceGeneratedReveal(retryRaw, {
      assessmentDepth,
      differentiator,
    });
  }

  if (!finalAttempt.success) {
    return fallback();
  }

  await database
    .update(brand_dna_profiles)
    .set({
      reveal_v2_json: JSON.stringify(finalAttempt.data),
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  return finalAttempt.data;
}

async function callRevealV2Llm(
  prompt: string,
  profileId: string,
): Promise<string> {
  return invokeLlmText({
    job: "brand-dna-generate-reveal-v2",
    prompt,
    maxTokens: 3200,
    actorType: "prospect",
    actorId: profileId,
  });
}

function parseValidateAndEnforceGeneratedReveal(
  raw: string,
  inputs: { assessmentDepth: BrandDnaAssessmentDepth; differentiator?: string | null },
): RevealV2ValidationResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripJsonFences(raw));
  } catch (error) {
    return {
      success: false,
      errors: [
        `JSON parse failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  const loose = brandDnaRevealV2LooseSchema.safeParse(parsedJson);
  if (!loose.success) {
    return {
      success: false,
      errors: loose.error.issues.map((issue) => {
        const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
    };
  }

  const enforced = enforceRevealV2Pathway(loose.data as BrandDnaRevealV2, inputs);
  return validateBrandDnaRevealV2(enforced);
}

function validateRevealV2Copy(reveal: BrandDnaRevealV2): string[] {
  const errors: string[] = [];
  for (const { path, value } of collectUserFacingRevealStrings(reveal)) {
    const banned = findBannedRevealPhrases(value);
    if (banned.length > 0) {
      errors.push(`${path} contains banned phrase(s): ${banned.join(", ")}`);
    }
    const rawTags = findRawTagNamesInRevealCopy(value);
    if (rawTags.length > 0) {
      errors.push(`${path} exposes raw tag name(s): ${rawTags.join(", ")}`);
    }
    const formal = findFormalContractionVariants(value);
    if (formal.length > 0) {
      errors.push(`${path} uses formal variant(s): ${formal.join(", ")}`);
    }
  }
  return errors;
}

function collectUserFacingRevealStrings(
  reveal: BrandDnaRevealV2,
): Array<{ path: string; value: string }> {
  const values: Array<{ path: string; value: string }> = [
    { path: "meta.confidenceLine", value: reveal.meta.confidenceLine },
    { path: "friendRead.openingLine", value: reveal.friendRead.openingLine },
    { path: "friendRead.recognition", value: reveal.friendRead.recognition },
    { path: "friendRead.gentleSting", value: reveal.friendRead.gentleSting },
    { path: "friendRead.practicalBridge", value: reveal.friendRead.practicalBridge },
    { path: "brandTranslation.plainRead", value: reveal.brandTranslation.plainRead },
    { path: "brandTranslation.whereItHelps", value: reveal.brandTranslation.whereItHelps },
    { path: "brandTranslation.whereItBites", value: reveal.brandTranslation.whereItBites },
    {
      path: "brandTranslation.customerRead.whatTheyNotice",
      value: reveal.brandTranslation.customerRead.whatTheyNotice,
    },
    {
      path: "brandTranslation.customerRead.whatTheyFeel",
      value: reveal.brandTranslation.customerRead.whatTheyFeel,
    },
    {
      path: "brandTranslation.customerRead.whereTheyHesitate",
      value: reveal.brandTranslation.customerRead.whereTheyHesitate,
    },
    {
      path: "brandTranslation.customerRead.whatNeedsToBecomeObvious",
      value: reveal.brandTranslation.customerRead.whatNeedsToBecomeObvious,
    },
    { path: "receipt.strongestTension", value: reveal.receipt.strongestTension },
    {
      path: "receipt.quietOrMissingSignal",
      value: reveal.receipt.quietOrMissingSignal,
    },
    { path: "pathway.whyThisFirst", value: reveal.pathway.whyThisFirst },
    {
      path: "pathway.whyNotTheOtherFirst",
      value: reveal.pathway.whyNotTheOtherFirst,
    },
  ];

  reveal.receipt.signalSummaries.forEach((value, index) => {
    values.push({ path: `receipt.signalSummaries.${index}`, value });
  });
  if (reveal.receipt.realityCheck) {
    values.push({
      path: "receipt.realityCheck",
      value: reveal.receipt.realityCheck,
    });
  }
  for (const [key, move] of Object.entries(reveal.practicalMoves) as Array<
    [keyof BrandDnaRevealV2["practicalMoves"], PracticalMove]
  >) {
    values.push({ path: `practicalMoves.${key}.title`, value: move.title });
    values.push({
      path: `practicalMoves.${key}.whatToChange`,
      value: move.whatToChange,
    });
    values.push({
      path: `practicalMoves.${key}.whyItMatters`,
      value: move.whyItMatters,
    });
    values.push({ path: `practicalMoves.${key}.example`, value: move.example });
  }

  return values;
}

function preparePromptSignalInputs(signalTagsRaw: string | null): {
  topHumanSignals: string;
  quietOrAbsentSignals: string;
  humanTensions: string;
} {
  const tagMap = parseTagMap(signalTagsRaw);
  const top = Object.entries(tagMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag, frequency]) => {
      const signal = toHumanSignal(tag);
      return `${signal.label}: ${signal.plainMeaning} (${frequency})`;
    });

  const quiet = Object.keys(BRAND_DNA_HUMAN_SIGNAL_MAP)
    .filter((tag) => !tagMap[tag] || tagMap[tag] <= 1)
    .slice(0, 6)
    .map((tag) => {
      const signal = toHumanSignal(tag);
      return `${signal.label}: ${signal.plainMeaning}`;
    });

  const tensionPairs: Array<[string, string, string]> = [
    ["risk_appetite", "risk_caution", "can move fast, but still wants enough certainty"],
    ["quiet_confidence", "personality_forward", "wants the work to speak, but the person behind it still matters"],
    ["admires_restraint", "admires_boldness", "respects restraint, but still notices decisive moves"],
    ["premium_positioning", "warmth_in_voice", "wants premium cues without making the brand feel cold"],
    ["systems_forward", "personality_forward", "wants the brand to work beyond one person, but the founder still carries meaning"],
  ];
  const tensions = tensionPairs
    .filter(([a, b]) => (tagMap[a] ?? 0) > 0 && (tagMap[b] ?? 0) > 0)
    .map(([, , description]) => description);

  return {
    topHumanSignals: top.length ? top.join("\n") : "No strong signals yet.",
    quietOrAbsentSignals: quiet.length
      ? quiet.join("\n")
      : "No quiet signals identified.",
    humanTensions: tensions.length
      ? tensions.join("\n")
      : "No clear tensions identified.",
  };
}

function toHumanSignal(rawTag: string): HumanSignal {
  const tag = rawTag.includes(".") ? rawTag.split(".").at(-1) ?? rawTag : rawTag;
  const mapped = BRAND_DNA_HUMAN_SIGNAL_MAP[tag];
  if (mapped) return { tag, ...mapped };
  return {
    tag,
    label: tag.replaceAll("_", " "),
    plainMeaning: "a recurring signal in the assessment",
  };
}

function getExplicitAssessmentDepth(
  source: unknown,
): BrandDnaAssessmentDepth | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const keys = [
    "assessmentDepth",
    "assessment_depth",
    "assessment_type",
    "flow_type",
    "rundown_type",
    "question_set",
  ];
  for (const key of keys) {
    const value = record[key];
    if (value === "quick_read" || value === "full_diagnostic") return value;
    if (value === "quick" || value === "quick_read") return "quick_read";
    if (value === "full" || value === "diagnostic" || value === "full_diagnostic") {
      return "full_diagnostic";
    }
  }
  if (record.is_full_diagnostic === true) return "full_diagnostic";
  if (record.is_full_diagnostic === false) return "quick_read";
  return null;
}

function parseBusinessContext(
  raw: string | null,
): { businessDoes?: string; customers?: string; differentiator?: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as {
        businessDoes?: string;
        customers?: string;
        differentiator?: string;
      };
    }
  } catch {
    return null;
  }
  return null;
}

function formatSectionInsights(raw: string | null): string {
  const insights: string[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        insights.push(...parsed.filter((value): value is string => typeof value === "string"));
      } else if (parsed && typeof parsed === "object") {
        insights.push(
          ...Object.values(parsed).filter(
            (value): value is string => typeof value === "string",
          ),
        );
      }
    } catch {
      // malformed cache
    }
  }
  return insights.length
    ? insights.map((insight, index) => `Section ${index + 1}: ${insight}`).join("\n")
    : "No section insights cached yet.";
}

function formatPublicRealityCheck(
  gapRevealRaw: string | null,
  enrichmentData: unknown,
): string {
  if (gapRevealRaw) {
    try {
      const parsed = JSON.parse(gapRevealRaw) as {
        mode?: string;
        strength?: string;
        gap?: string;
        questions?: string[];
      };
      if (parsed.mode === "observations") {
        return [parsed.strength, parsed.gap].filter(Boolean).join("\n");
      }
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed.questions.join("\n");
      }
    } catch {
      // malformed cache
    }
  }
  if (enrichmentData && typeof enrichmentData === "object") {
    return "Public enrichment data is present, but no written reality check is cached yet.";
  }
  return "No public reality check is available.";
}

function parseTagMap(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.reduce<Record<string, number>>((acc, tag) => {
        if (typeof tag === "string") acc[tag] = (acc[tag] ?? 0) + 1;
        return acc;
      }, {});
    }
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, number>;
    }
  } catch {
    return {};
  }
  return {};
}

function countWords(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

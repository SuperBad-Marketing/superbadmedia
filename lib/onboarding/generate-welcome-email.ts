/**
 * Welcome email generation — Opus-tier, drift-checked.
 *
 * Two variants:
 *   - Retainer: personalised from deal context, quote, outreach research
 *   - SaaS: graceful degradation (rich if outreach-sourced, basic if cold)
 *
 * Generated via `onboarding-welcome-email` LLM slug. Drift-checked via
 * `checkBrandVoiceDrift()` before returning. Classification: transactional.
 *
 * Owner: OS-1.
 */
import { z } from "zod";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift, type BrandDnaProfile } from "@/lib/ai/drift-check";
import { killSwitches } from "@/lib/kill-switches";

export interface GenerateWelcomeEmailInput {
  audience: "retainer" | "saas";
  customerName: string;
  companyName: string;
  portalLink: string;
  /** Product name — required for SaaS, ignored for retainer */
  productName?: string;
  /** Deal notes, quote context, outreach research — retainer context */
  dealContext?: string;
  /** SuperBad's own Brand DNA profile for voice */
  superbadBrandDna: BrandDnaProfile;
  /** Contact location (SaaS) */
  location?: string;
  /** Industry from signup (SaaS) */
  industry?: string;
}

const WelcomeEmailSchema = z.object({
  subject: z.string().min(1).max(120),
  body_html: z.string().min(1),
});

export interface GenerateWelcomeEmailResult {
  subject: string;
  bodyHtml: string;
  driftPass: boolean;
  driftScore: number;
}

export async function generateWelcomeEmail(
  input: GenerateWelcomeEmailInput,
): Promise<GenerateWelcomeEmailResult | null> {
  if (!killSwitches.llm_calls_enabled) {
    return null;
  }

  const prompt = buildWelcomeEmailPrompt(input);
  const raw = await invokeLlmText({
    job: "onboarding-welcome-email",
    prompt,
    maxTokens: 1500,
  });

  // Parse JSON from LLM response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: z.infer<typeof WelcomeEmailSchema>;
  try {
    parsed = WelcomeEmailSchema.parse(JSON.parse(jsonMatch[0]));
  } catch {
    return null;
  }

  // Drift check
  const drift = await checkBrandVoiceDrift(
    parsed.body_html,
    input.superbadBrandDna,
  );

  return {
    subject: parsed.subject,
    bodyHtml: parsed.body_html,
    driftPass: drift.pass,
    driftScore: drift.score,
  };
}

function buildWelcomeEmailPrompt(input: GenerateWelcomeEmailInput): string {
  const { audience, customerName, companyName, portalLink, superbadBrandDna } =
    input;

  const voiceBlock = [
    `SuperBad voice: ${superbadBrandDna.voiceDescription}`,
    `Tone markers: ${superbadBrandDna.toneMarkers.join(", ")}`,
    superbadBrandDna.avoidWords?.length
      ? `Avoid: ${superbadBrandDna.avoidWords.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (audience === "retainer") {
    return `You are writing a welcome email from SuperBad Marketing to a new retainer client.

${voiceBlock}

CLIENT:
- Name: ${customerName}
- Company: ${companyName}
${input.dealContext ? `\nCONTEXT FROM SALES PROCESS:\n${input.dealContext}` : ""}

INSTRUCTIONS:
- Write a personalised opening referencing something specific from the deal context (if available).
- Include a portal link: ${portalLink}
- Time expectation: "about 30 minutes" for Brand DNA.
- Brief preview of what comes after Brand DNA.
- Voice: dry, human, observant. Not a pitch, not a celebration. A greeting.
- The sender is SuperBad, not "SuperBad Lite".
- Subject line: personal, not corporate. Under 60 characters.

Return valid JSON: { "subject": "...", "body_html": "..." }
The body_html should be clean HTML suitable for email. No images, no complex layout.`;
  }

  // SaaS variant
  return `You are writing a welcome email from SuperBad Marketing to a new SaaS subscriber.

${voiceBlock}

CUSTOMER:
- Name: ${customerName}
- Company: ${companyName}
- Product: ${input.productName ?? "SuperBad"}
${input.location ? `- Location: ${input.location}` : ""}
${input.industry ? `- Industry: ${input.industry}` : ""}

INSTRUCTIONS:
- If rich context is available above, personalise the opening.
- If only basic info (name, product, location), still make it feel individual — not a template.
- Include product name "${input.productName ?? "SuperBad"}" in subject and body.
- Include portal link: ${portalLink}
- Time expectation: "about 30 minutes" for Brand DNA, then a quick product setup.
- Voice: dry, human, observant. Not a pitch.
- The sender is SuperBad, not "SuperBad Lite".
- Subject line: includes product name. Under 60 characters.

Return valid JSON: { "subject": "...", "body_html": "..." }
The body_html should be clean HTML suitable for email. No images, no complex layout.`;
}

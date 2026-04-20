/**
 * Prompt builder for the post-application follow-up question.
 *
 * Spec: hiring-pipeline §7.2.
 * Model: hiring-followup-question-draft (Haiku).
 */

export interface FollowupQuestionPromptInput {
  candidateName: string;
  roleName: string;
  portfolioUrls: string[];
  portfolioStyleTags: string[];
  portfolioSummary: string | null;
  locationCity: string | null;
  rateExpectation: string | null;
  availabilityHoursPerWeek: number | null;
  briefStyleSummary: string | null;
  briefExtractedTags: string[];
}

export function buildFollowupQuestionPrompt(
  input: FollowupQuestionPromptInput,
): string {
  const portfolioSection = input.portfolioSummary
    ? `Portfolio summary: ${input.portfolioSummary}`
    : `Portfolio URLs: ${input.portfolioUrls.join(", ")}`;

  const tagsSection =
    input.portfolioStyleTags.length > 0
      ? `Detected style tags from their work: ${input.portfolioStyleTags.join(", ")}`
      : "";

  const briefSection = input.briefStyleSummary
    ? `Role style summary: ${input.briefStyleSummary}\nRole tags: ${input.briefExtractedTags.join(", ")}`
    : "";

  return `You are drafting a follow-up question for a creative contractor who just applied to work with SuperBad Marketing.

Candidate: ${input.candidateName}
Role: ${input.roleName}
${portfolioSection}
${tagsSection}
Location: ${input.locationCity ?? "not specified"}
Rate expectation: ${input.rateExpectation ?? "not specified"}
Availability: ${input.availabilityHoursPerWeek ? `${input.availabilityHoursPerWeek} hours/week` : "not specified"}

${briefSection}

Write ONE short, specific follow-up question based on what you can infer from their portfolio and how it relates to the role. The question should probe a gap or stretch between their visible work and what the role needs.

Examples of good questions:
- "Your reel is food-heavy — comfortable with product-shot work too?"
- "Noticed a lot of natural light in your portfolio. How do you handle mixed studio lighting?"
- "Your editing style leans warm and slow — could you match a punchier, high-energy cut if the brief called for it?"

Rules:
- One question only. No preamble, no sign-off.
- Conversational, direct, specific to THEIR work.
- Never generic ("tell us about yourself", "why do you want to work here").
- Never mention SuperBad by name in the question itself.
- Under 30 words.`;
}

export function buildFollowupQuestionSystem(): string {
  return "You are a creative director at a boutique marketing agency. Your voice is dry, direct, and specific. You ask pointed questions that show you actually looked at someone's work.";
}

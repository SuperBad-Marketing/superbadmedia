export interface CustomQuestionsInput {
  companyName: string;
  industry?: string | null;
  dealStage: string;
  templateLabel: string;
  pastCallSummaries: string[];
  recentActivity: string[];
  templateSectionTitles: string[];
}

export function buildCustomQuestionsPrompt(input: CustomQuestionsInput): string {
  const pastCalls = input.pastCallSummaries.length > 0
    ? input.pastCallSummaries.join("\n")
    : "No previous calls.";

  const activity = input.recentActivity.length > 0
    ? input.recentActivity.join("\n")
    : "No recent activity.";

  return `Generate 2-3 custom questions for a ${input.templateLabel} call with ${input.companyName}${input.industry ? ` (${input.industry})` : ""}.

=== TEMPLATE SECTIONS ===
${input.templateSectionTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

=== PAST CALLS ===
${pastCalls}

=== RECENT ACTIVITY ===
${activity}

=== RULES ===
- Each question should reference something specific from past calls or activity — not generic.
- Each question targets a specific template section (by title).
- Include "listen for" signals: 1-2 green (positive sign) and 1 amber or red (concern).
- If there's nothing specific to ask about, return an empty array — don't force generic questions.

Respond in valid JSON:
[
  {
    "targetSection": "section title to inject into",
    "text": "the question",
    "boldPhrase": "key phrase" or null,
    "signals": [
      { "level": "green", "text": "..." },
      { "level": "amber", "text": "..." }
    ]
  }
]`;
}

export interface PreBriefingInput {
  companyName: string;
  companyShape?: string | null;
  industry?: string | null;
  revenueRange?: string | null;
  teamSize?: string | null;
  location?: string | null;
  dealTitle: string;
  dealStage: string;
  dealValueCents?: number | null;
  dealSource?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  pastCallSummaries: string[];
  recentActivity: string[];
  templateLabel: string;
}

export function buildPreBriefingPrompt(input: PreBriefingInput): string {
  const pastCalls = input.pastCallSummaries.length > 0
    ? input.pastCallSummaries.map((s, i) => `Call ${i + 1}: ${s}`).join("\n")
    : "No previous calls on this deal.";

  const activity = input.recentActivity.length > 0
    ? input.recentActivity.join("\n")
    : "No recent activity.";

  return `You are preparing a sales call briefing for Andy Robinson, founder of SuperBad Marketing (Melbourne). Andy is about to get on a ${input.templateLabel} call.

=== DEAL CONTEXT ===
Company: ${input.companyName}
${input.companyShape ? `Business type: ${input.companyShape}` : ""}
${input.industry ? `Industry: ${input.industry}` : ""}
${input.revenueRange ? `Revenue range: ${input.revenueRange}` : ""}
${input.teamSize ? `Team size: ${input.teamSize}` : ""}
${input.location ? `Location: ${input.location}` : ""}
Deal: ${input.dealTitle}
Stage: ${input.dealStage}
${input.dealValueCents ? `Value: $${(input.dealValueCents / 100).toLocaleString()}` : ""}
${input.dealSource ? `Source: ${input.dealSource}` : ""}
${input.contactName ? `Contact: ${input.contactName}${input.contactRole ? ` (${input.contactRole})` : ""}` : ""}

=== PAST CALLS ===
${pastCalls}

=== RECENT ACTIVITY ===
${activity}

=== YOUR TASK ===
Generate a pre-call briefing with these exact sections:

1. **Situation summary** — 2-3 sentences on where this deal stands and what Andy should know walking in.

2. **Last call recap** — If there were previous calls, summarise the key points. If not, skip this section entirely.

3. **Unresolved items** — Anything from past calls or activity that was left open, promised but not delivered, or needs follow-up. If nothing, say "None identified."

4. **Talking points** — 3-5 specific, actionable talking points tailored to this call. Not generic ("build rapport") — specific ("They mentioned capacity concerns last call — ask if they've hired"). Each should reference something concrete from the deal context.

=== VOICE ===
Write like a sharp colleague handing Andy a cheat sheet before a call. Direct, no filler, no corporate speak. Bullet points preferred. If you don't have enough context for a section, say so honestly rather than padding with generic advice.

Respond in valid JSON with this structure:
{
  "situationSummary": "...",
  "lastCallRecap": "..." or null,
  "unresolvedItems": ["...", "..."] or [],
  "talkingPoints": ["...", "...", "..."]
}`;
}

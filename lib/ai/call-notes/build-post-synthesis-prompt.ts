export interface PostSynthesisInput {
  companyName: string;
  dealTitle: string;
  dealStage: string;
  dealValueCents?: number | null;
  contactName?: string | null;
  templateLabel: string;
  temperature: string;
  agreedNextStep?: string | null;
  followUpDate?: string | null;
  blockers?: string | null;
  sectionNotes: { sectionTitle: string; questionText: string; notes: string; covered: boolean }[];
}

export function buildPostSynthesisPrompt(input: PostSynthesisInput): string {
  const notes = input.sectionNotes
    .filter(n => n.notes.trim() || n.covered)
    .map(n => `[${n.covered ? "COVERED" : "SKIPPED"}] ${n.sectionTitle} > ${n.questionText}\nNotes: ${n.notes || "(no notes)"}`)
    .join("\n\n");

  return `You are synthesising a sales call for Andy Robinson, founder of SuperBad Marketing.

=== CALL CONTEXT ===
Company: ${input.companyName}
Deal: ${input.dealTitle}
Stage: ${input.dealStage}
${input.dealValueCents ? `Deal value: $${(input.dealValueCents / 100).toLocaleString()}` : ""}
${input.contactName ? `Contact: ${input.contactName}` : ""}
Call type: ${input.templateLabel}

=== ANDY'S DEBRIEF ===
Temperature: ${input.temperature}
Agreed next step: ${input.agreedNextStep || "Not specified"}
Follow-up date: ${input.followUpDate || "Not set"}
Blockers: ${input.blockers || "None"}

=== CALL NOTES ===
${notes || "No notes were taken."}

=== YOUR TASK ===
Generate a post-call synthesis with these sections:

1. **Summary** — 3-5 sentences capturing what happened, the prospect's position, and where things stand. Write as if Andy will re-read this in a week and need to remember the call.

2. **Next actions** — Prioritised list of 2-5 specific actions. Each must be concrete and actionable ("Send quote by Thursday" not "Follow up"). For each action, specify an action type from this list:
   - "transition_stage" — recommend moving the deal to a specific stage (include target stage)
   - "set_followup" — set a snooze/follow-up date on the deal (include the date if mentioned)
   - "open_quote_builder" — navigate to the quote builder for this deal
   - "navigate" — general navigation (include description)
   - "manual" — something Andy needs to do outside the platform

3. **Stage recommendation** — Should the deal move to a different pipeline stage based on this call? If yes, name the stage and explain why in one sentence. If no, say "Stay at [current stage]" and why.

4. **Flags** — Anything from the notes that Andy should pay attention to: risks, opportunities, things the prospect said that have implications. 0-3 items. Only include genuine flags, not filler.

=== VOICE ===
Direct, no filler. Write like a smart colleague debriefing Andy after sitting in on the call. Short sentences.

Respond in valid JSON:
{
  "summary": "...",
  "nextActions": [
    {
      "text": "action description",
      "actionType": "transition_stage" | "set_followup" | "open_quote_builder" | "navigate" | "manual",
      "actionData": { "stage": "quoted" } or { "date": "2026-05-01" } or {}
    }
  ],
  "stageRecommendation": {
    "shouldMove": true/false,
    "targetStage": "quoted" or null,
    "reason": "..."
  },
  "flags": ["...", "..."]
}`;
}

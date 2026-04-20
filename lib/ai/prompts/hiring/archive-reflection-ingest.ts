/**
 * Prompt builder for archive reflection → Role Brief style_avoid_list update.
 *
 * Spec: hiring-pipeline §11.1.
 * Model: hiring-archive-reflection-ingest (Haiku).
 */

export interface ArchiveReflectionPromptInput {
  candidateName: string;
  roleName: string;
  reasonCode: string;
  reasonFreeText: string | null;
  reflectionText: string;
  currentAvoidList: string[];
  briefStyleSummary: string | null;
}

export function buildArchiveReflectionPrompt(
  input: ArchiveReflectionPromptInput,
): string {
  const currentAvoidSection =
    input.currentAvoidList.length > 0
      ? `Current "avoid" list for this role:\n${input.currentAvoidList.map((item) => `- ${item}`).join("\n")}`
      : "The role's avoid list is currently empty.";

  const briefSection = input.briefStyleSummary
    ? `Role style summary: ${input.briefStyleSummary}`
    : "";

  return `A candidate has been archived from a hiring pipeline. Andy left a reflection note that should feed back into the Role Brief's "avoid" list — patterns to steer future scouting and screening away from.

Candidate: ${input.candidateName}
Role: ${input.roleName}
Archive reason: ${input.reasonCode}${input.reasonFreeText ? ` — ${input.reasonFreeText}` : ""}
Andy's reflection: "${input.reflectionText}"

${briefSection}

${currentAvoidSection}

Based on the reflection, extract 0–3 concise avoid items (each ≤15 words). These should be actionable style/skill/fit signals, not personality judgments.

Rules:
- Only add items that aren't already covered by the current avoid list.
- If the reflection doesn't contain a useful signal (e.g. "just didn't work out"), return nothing.
- Each item should be specific enough to guide scouting (e.g. "heavy filter presets over natural grading", "overly polished corporate reels").
- Return one item per line, no bullets, no numbering. Empty response if nothing to add.`;
}

export function buildArchiveReflectionSystem(): string {
  return "You are a creative director distilling archive feedback into brief, actionable scouting avoidance signals. Be specific and concise.";
}

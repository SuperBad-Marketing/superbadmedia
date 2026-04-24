import { invokeLlmText } from "@/lib/ai/invoke";
import { getTemplate, getTemplatesForType, ALL_TEMPLATES, type TemplateDef } from "./templates";
import type { ContentType } from "@/lib/db/schema/content-studio";

interface GenerateCopyResult {
  ok: true;
  templateId: string;
  copy: Record<string, string>;
}

interface GenerateCopyError {
  ok: false;
  error: string;
}

export async function generateCopy(
  brief: string,
  contentType: ContentType,
  templateId?: string,
): Promise<GenerateCopyResult | GenerateCopyError> {
  const template = templateId
    ? getTemplate(templateId)
    : await pickTemplate(brief, contentType);

  if (!template) {
    return { ok: false, error: "No matching template found." };
  }

  const slotsDescription = template.copySlots
    .map((slot) => `"${slot}": string`)
    .join(", ");

  const raw = await invokeLlmText({
    job: "content-studio-generate-copy",
    system: COPY_SYSTEM_PROMPT,
    prompt: [
      `Content type: ${contentType}`,
      `Template: ${template.name}`,
      `Copy slots to fill: { ${slotsDescription} }`,
      `Brief: ${brief}`,
      "",
      "Return ONLY valid JSON with the copy slots filled. No markdown, no explanation.",
    ].join("\n"),
    maxTokens: 1024,
  });

  try {
    const parsed = JSON.parse(raw);
    const copy: Record<string, string> = {};
    for (const slot of template.copySlots) {
      copy[slot] = typeof parsed[slot] === "string" ? parsed[slot] : "";
    }
    return { ok: true, templateId: template.id, copy };
  } catch {
    return { ok: false, error: "Failed to parse AI response as JSON." };
  }
}

export async function correctCopy(
  currentCopy: Record<string, string>,
  correction: string,
  template: TemplateDef,
): Promise<GenerateCopyResult | GenerateCopyError> {
  const slotsDescription = template.copySlots
    .map((slot) => `"${slot}": "${currentCopy[slot] ?? ""}"`)
    .join(", ");

  const raw = await invokeLlmText({
    job: "content-studio-correct-copy",
    system: COPY_SYSTEM_PROMPT,
    prompt: [
      `Template: ${template.name}`,
      `Current copy: { ${slotsDescription} }`,
      `Correction request: ${correction}`,
      "",
      "Apply the correction to the copy. Return ONLY valid JSON with all copy slots. No markdown, no explanation.",
    ].join("\n"),
    maxTokens: 1024,
  });

  try {
    const parsed = JSON.parse(raw);
    const copy: Record<string, string> = {};
    for (const slot of template.copySlots) {
      copy[slot] = typeof parsed[slot] === "string" ? parsed[slot] : currentCopy[slot] ?? "";
    }
    return { ok: true, templateId: template.id, copy };
  } catch {
    return { ok: false, error: "Failed to parse AI correction response." };
  }
}

async function pickTemplate(
  brief: string,
  contentType: ContentType,
): Promise<TemplateDef | undefined> {
  const candidates = getTemplatesForType(contentType);
  if (candidates.length === 0) return ALL_TEMPLATES[0];
  if (candidates.length === 1) return candidates[0];

  const options = candidates
    .map((t, i) => `${i + 1}. ${t.id} — "${t.name}" (slots: ${t.copySlots.join(", ")})`)
    .join("\n");

  const raw = await invokeLlmText({
    job: "content-studio-pick-template",
    prompt: [
      `Pick the best template for this brief.`,
      `Brief: "${brief}"`,
      `Content type: ${contentType}`,
      "",
      `Options:`,
      options,
      "",
      `Reply with ONLY the template id (e.g. "announcement-bold"). Nothing else.`,
    ].join("\n"),
    maxTokens: 64,
  });

  const picked = candidates.find((t) => raw.includes(t.id));
  return picked ?? candidates[0];
}

const COPY_SYSTEM_PROMPT = `You write copy for SuperBad Marketing social media posts.

Voice rules:
- Dry, observational, self-deprecating. Never explain the joke.
- Short sentences. Leave room for the mutter.
- Ban "synergy", "leverage", "solutions", "elevate", "game-changer".
- Real first. If it's funny, let it be funny. If it's blunt, let it be blunt.
- Headlines should be punchy and typographic — they'll be rendered large.
- Taglines are quieter, italic, one line.

You return ONLY valid JSON matching the requested copy slots. No markdown fences, no explanation.`;

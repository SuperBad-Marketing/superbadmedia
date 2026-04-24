import { invokeLlmText } from "@/lib/ai/invoke";
import { getTemplate, getTemplatesForType, ALL_TEMPLATES, type TemplateDef } from "./templates";
import type { ContentType } from "@/lib/db/schema/content-studio";

export type SlideCopy = Record<string, string>;

interface GenerateCopyResult {
  ok: true;
  templateId: string;
  slides: SlideCopy[];
}

interface GenerateCopyError {
  ok: false;
  error: string;
}

export async function generateCopy(
  brief: string,
  contentType: ContentType,
  slideCount: number = 1,
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

  const isCarousel = slideCount > 1;

  const prompt = isCarousel
    ? [
        `Content type: ${contentType}`,
        `Template: ${template.name}`,
        `Copy slots per slide: { ${slotsDescription} }`,
        `Number of slides: ${slideCount}`,
        `Brief: ${brief}`,
        "",
        "This is a carousel post. Each slide should build on the narrative — not repeat the same idea.",
        "Slide 1 hooks, middle slides develop, final slide lands.",
        "",
        `Return ONLY a valid JSON array of ${slideCount} objects, each with the copy slots filled. No markdown, no explanation.`,
      ].join("\n")
    : [
        `Content type: ${contentType}`,
        `Template: ${template.name}`,
        `Copy slots to fill: { ${slotsDescription} }`,
        `Brief: ${brief}`,
        "",
        "Return ONLY valid JSON with the copy slots filled. No markdown, no explanation.",
      ].join("\n");

  const raw = await invokeLlmText({
    job: "content-studio-generate-copy",
    system: COPY_SYSTEM_PROMPT,
    prompt,
    maxTokens: isCarousel ? 2048 : 1024,
  });

  try {
    const parsed = JSON.parse(raw);

    if (isCarousel) {
      if (!Array.isArray(parsed) || parsed.length < 1) {
        return { ok: false, error: "AI returned invalid carousel format." };
      }
      const slides: SlideCopy[] = parsed.slice(0, slideCount).map((slide: Record<string, unknown>) => {
        const copy: SlideCopy = {};
        for (const slot of template.copySlots) {
          copy[slot] = typeof slide[slot] === "string" ? slide[slot] as string : "";
        }
        return copy;
      });
      while (slides.length < slideCount) {
        const empty: SlideCopy = {};
        for (const slot of template.copySlots) empty[slot] = "";
        slides.push(empty);
      }
      return { ok: true, templateId: template.id, slides };
    }

    const copy: SlideCopy = {};
    for (const slot of template.copySlots) {
      copy[slot] = typeof parsed[slot] === "string" ? parsed[slot] : "";
    }
    return { ok: true, templateId: template.id, slides: [copy] };
  } catch {
    return { ok: false, error: "Failed to parse AI response as JSON." };
  }
}

export async function correctCopy(
  currentSlides: SlideCopy[],
  correction: string,
  template: TemplateDef,
  slideIndex?: number,
): Promise<GenerateCopyResult | GenerateCopyError> {
  const isCarousel = currentSlides.length > 1;
  const targetSlideIdx = slideIndex ?? (isCarousel ? undefined : 0);

  let prompt: string;

  if (targetSlideIdx !== undefined) {
    const slide = currentSlides[targetSlideIdx] ?? {};
    const slotsDescription = template.copySlots
      .map((slot) => `"${slot}": "${slide[slot] ?? ""}"`)
      .join(", ");
    prompt = [
      `Template: ${template.name}`,
      `Current copy for slide ${targetSlideIdx + 1}: { ${slotsDescription} }`,
      `Correction request: ${correction}`,
      "",
      "Apply the correction to this slide. Return ONLY valid JSON with all copy slots. No markdown, no explanation.",
    ].join("\n");
  } else {
    const slidesJson = JSON.stringify(currentSlides, null, 2);
    prompt = [
      `Template: ${template.name}`,
      `Current carousel copy (${currentSlides.length} slides):`,
      slidesJson,
      `Correction request: ${correction}`,
      "",
      `Apply the correction across the carousel. Return ONLY a valid JSON array of ${currentSlides.length} objects. No markdown, no explanation.`,
    ].join("\n");
  }

  const raw = await invokeLlmText({
    job: "content-studio-correct-copy",
    system: COPY_SYSTEM_PROMPT,
    prompt,
    maxTokens: isCarousel ? 2048 : 1024,
  });

  try {
    const parsed = JSON.parse(raw);

    if (targetSlideIdx !== undefined && !Array.isArray(parsed)) {
      const corrected: SlideCopy = {};
      for (const slot of template.copySlots) {
        corrected[slot] = typeof parsed[slot] === "string"
          ? parsed[slot]
          : currentSlides[targetSlideIdx]?.[slot] ?? "";
      }
      const newSlides = [...currentSlides];
      newSlides[targetSlideIdx] = corrected;
      return { ok: true, templateId: template.id, slides: newSlides };
    }

    if (Array.isArray(parsed)) {
      const slides: SlideCopy[] = parsed.slice(0, currentSlides.length).map(
        (slide: Record<string, unknown>, i: number) => {
          const copy: SlideCopy = {};
          for (const slot of template.copySlots) {
            copy[slot] = typeof slide[slot] === "string"
              ? slide[slot] as string
              : currentSlides[i]?.[slot] ?? "";
          }
          return copy;
        },
      );
      return { ok: true, templateId: template.id, slides };
    }

    return { ok: false, error: "Unexpected correction response format." };
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

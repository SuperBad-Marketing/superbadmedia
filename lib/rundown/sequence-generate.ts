/**
 * LLM email generator for the Rundown post-completion nurture sequence.
 * Generates one email at a time using structured briefs + lead context.
 */

import { invokeLlmText } from "@/lib/ai/invoke";
import {
  buildSystemPrompt,
  buildEmail1Prompt,
  buildEmail2Prompt,
  buildEmail3Prompt,
  type SequenceContext,
} from "./sequence-briefs";

export interface GeneratedEmail {
  subject: string;
  bodyHtml: string;
}

export async function generateSequenceEmail(
  emailNumber: 1 | 2 | 3,
  ctx: SequenceContext,
): Promise<GeneratedEmail> {
  const system = buildSystemPrompt();
  let prompt: string;

  switch (emailNumber) {
    case 1:
      prompt = buildEmail1Prompt(ctx);
      break;
    case 2:
      prompt = buildEmail2Prompt(ctx);
      break;
    case 3:
      prompt = buildEmail3Prompt(ctx);
      break;
  }

  const raw = await invokeLlmText({
    job: "rundown-sequence-draft-email",
    system,
    prompt,
    maxTokens: 1200,
    actorType: "prospect",
    actorId: ctx.businessName,
  });

  return parseEmailOutput(raw);
}

function parseEmailOutput(raw: string): GeneratedEmail {
  const lines = raw.split("\n");
  let subject = "";
  const bodyLines: string[] = [];
  let pastSubject = false;

  for (const line of lines) {
    if (!pastSubject) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.toLowerCase().startsWith("subject:")) {
        subject = trimmed.replace(/^subject:\s*/i, "").trim();
        pastSubject = true;
      } else if (!subject) {
        subject = trimmed;
        pastSubject = true;
      } else {
        pastSubject = true;
        bodyLines.push(line);
      }
    } else {
      bodyLines.push(line);
    }
  }

  let bodyHtml = bodyLines.join("\n").trim();
  if (!bodyHtml.startsWith("<")) {
    bodyHtml = bodyHtml
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0)
      .map((p) => `<p style="margin:0 0 16px;">${p.trim()}</p>`)
      .join("\n");
  }

  return { subject: subject || "your brand dna", bodyHtml };
}

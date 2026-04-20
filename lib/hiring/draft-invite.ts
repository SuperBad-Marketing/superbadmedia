import { invokeLlmText } from "@/lib/ai/invoke";
import type { PortfolioSignal } from "./portfolio";

export interface DraftInviteInput {
  candidateName: string;
  signal: PortfolioSignal;
  roleName: string;
  styleSummary: string | null;
  extractedTags: string[];
}

export interface DraftInviteResult {
  subject: string;
  body: string;
  confidence: number;
}

export async function draftInviteEmail(
  input: DraftInviteInput,
): Promise<DraftInviteResult> {
  const prompt = `Draft a short invite email from Andy at SuperBad Marketing to a freelancer. Return JSON only, no markdown fences:
{"subject": "<email subject>", "body": "<email body>", "confidence": <0.0-1.0>}

Voice rules: dry, observational, self-deprecating, slow burn. Short sentences. No "synergy", "leverage", "solutions". The email should feel like a thoughtful human reaching out, not a recruitment template.

CANDIDATE: ${input.candidateName}
Portfolio: ${input.signal.url} (${input.signal.platform})
Bio: ${input.signal.bio || "not available"}
Work: ${input.signal.work_samples.map((s) => s.title || s.url).join(", ") || "not available"}
Tags: ${input.signal.extracted_tags.join(", ") || "none"}

ROLE: ${input.roleName}
Style: ${input.styleSummary || "not specified"}
Tags: ${input.extractedTags.join(", ") || "none"}

Requirements:
- Reference something specific from their portfolio (even if inferred from the URL/platform)
- Brief (3-4 sentences max for the body)
- One line explaining what SuperBad does
- Soft CTA (no pressure, no "let me know ASAP")
- Confidence = your self-rating on fit + draft quality (0.0-1.0). Be honest — low data = lower confidence.`;

  const raw = await invokeLlmText({
    job: "hiring-invite-draft",
    prompt,
    maxTokens: 500,
  });

  try {
    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);
    return {
      subject: String(parsed.subject || ""),
      body: String(parsed.body || ""),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    };
  } catch {
    return {
      subject: "",
      body: raw,
      confidence: 0,
    };
  }
}

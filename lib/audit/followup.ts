import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { logActivity } from "@/lib/activity-log";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import type { CategoryScore } from "./scoring";

export interface AuditFollowUpInput {
  contactName: string;
  contactEmail: string;
  companyName: string;
  domain: string;
  categoryScores: CategoryScore[];
  weakestCategory: CategoryScore;
  viabilityProfile: ViabilityProfile;
  dealId: string;
  companyId: string;
  contactId: string;
}

export interface AuditFollowUpResult {
  subject: string;
  body: string;
}

export async function generateAuditFollowUp(
  input: AuditFollowUpInput,
): Promise<AuditFollowUpResult> {
  const prompt = [
    "You are writing a follow-up email from Andy at SuperBad Marketing to a business owner who just completed a free marketing audit.",
    "",
    `Recipient: ${input.contactName} (${input.contactEmail})`,
    `Business: ${input.companyName} (${input.domain})`,
    "",
    "Audit results:",
    ...input.categoryScores.map(
      (c) => `  ${c.category}: ${c.grade} (${c.score}/100)${c.category === input.weakestCategory.category ? " ← weakest" : ""}`,
    ),
    "",
    `Their weakest area is ${input.weakestCategory.category} (${input.weakestCategory.grade}, ${input.weakestCategory.score}/100).`,
    "",
    "Write an email that:",
    "1. References their weakest category by name and score",
    "2. Makes one specific observation about what the signals showed in that area",
    "3. Suggests a conversation — not a pitch",
    "4. Is short (3–5 sentences max)",
    "5. Voice: dry, direct, observational. No exclamation marks. No 'synergy' or 'leverage'.",
    "6. Sign off as Andy",
    "",
    "Return ONLY the email body (no subject line, no greeting formatting). The subject will be set separately.",
  ].join("\n");

  const body = await invokeLlmText({
    job: "audit-followup-draft",
    prompt,
    maxTokens: 400,
  });

  const subject = `Your ${input.weakestCategory.category} score — ${input.companyName}`;

  await logActivity({
    companyId: input.companyId,
    contactId: input.contactId,
    dealId: input.dealId,
    kind: "audit_followup_drafted",
    body: `Follow-up draft generated referencing ${input.weakestCategory.category} (${input.weakestCategory.grade})`,
    meta: {
      weakest_category: input.weakestCategory.category,
      weakest_grade: input.weakestCategory.grade,
    },
  });

  return { subject, body };
}

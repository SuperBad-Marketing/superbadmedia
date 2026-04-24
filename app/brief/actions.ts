"use server";

import { submitBrief, type SubmitBriefInput } from "@/lib/briefs/submit-brief";
import type { BriefKind, BriefBudgetRange } from "@/lib/db/schema/briefs";

type ActionResult =
  | { ok: true; referenceNumber: string }
  | { ok: false; error: string };

export async function submitLeanBriefAction(input: {
  businessName: string;
  contactName: string;
  contactEmail: string;
  description: string;
  deliveryDateMs: number;
}): Promise<ActionResult> {
  if (!input.businessName.trim()) return { ok: false, error: "Business name is required." };
  if (!input.contactName.trim()) return { ok: false, error: "Contact name is required." };
  if (!input.contactEmail.trim()) return { ok: false, error: "Email is required." };
  if (!input.description.trim()) return { ok: false, error: "Description is required." };
  if (!input.deliveryDateMs) return { ok: false, error: "Delivery date is required." };

  try {
    const result = await submitBrief({
      briefType: "lean",
      source: "public",
      businessName: input.businessName.trim(),
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim(),
      description: input.description.trim(),
      deliveryDateMs: input.deliveryDateMs,
    });
    return { ok: true, referenceNumber: result.referenceNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Submission failed." };
  }
}

export async function submitStructuredBriefAction(input: {
  businessName: string;
  contactName: string;
  contactEmail: string;
  description: string;
  deliveryDateMs: number;
  projectTitle: string;
  briefKind: string;
  styleReferences: string;
  keyMessages: string;
  targetAudience: string;
  deliverablesBreakdown: string;
  locationDetails: string;
  talentNotes: string;
  budgetRange: string;
  additionalNotes: string;
}): Promise<ActionResult> {
  if (!input.businessName.trim()) return { ok: false, error: "Business name is required." };
  if (!input.contactName.trim()) return { ok: false, error: "Contact name is required." };
  if (!input.contactEmail.trim()) return { ok: false, error: "Email is required." };
  if (!input.description.trim()) return { ok: false, error: "Description is required." };
  if (!input.deliveryDateMs) return { ok: false, error: "Delivery date is required." };

  try {
    const result = await submitBrief({
      briefType: "structured",
      source: "public",
      businessName: input.businessName.trim(),
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim(),
      description: input.description.trim(),
      deliveryDateMs: input.deliveryDateMs,
      projectTitle: input.projectTitle.trim() || undefined,
      briefKind: (input.briefKind as BriefKind) || undefined,
      styleReferences: input.styleReferences.trim() || undefined,
      keyMessages: input.keyMessages.trim() || undefined,
      targetAudience: input.targetAudience.trim() || undefined,
      deliverablesBreakdown: input.deliverablesBreakdown.trim() || undefined,
      locationDetails: input.locationDetails.trim() || undefined,
      talentNotes: input.talentNotes.trim() || undefined,
      budgetRange: (input.budgetRange as BriefBudgetRange) || undefined,
      additionalNotes: input.additionalNotes.trim() || undefined,
    });
    return { ok: true, referenceNumber: result.referenceNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Submission failed." };
  }
}

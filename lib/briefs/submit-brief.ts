import { randomUUID } from "node:crypto";
import { db as defaultDb } from "@/lib/db";
import { briefs, type BriefType, type BriefSource, type BriefKind, type BriefBudgetRange, type BriefStatus, type BriefMatchMethod } from "@/lib/db/schema/briefs";
import { tasks } from "@/lib/db/schema/tasks";
import { user } from "@/lib/db/schema/user";
import { nextReferenceNumber } from "./reference-number";
import { matchBriefToClient } from "./match-client";
import { logActivity } from "@/lib/activity-log";
import { generateStoryboard } from "./generate-storyboard";

export interface SubmitBriefInput {
  briefType: BriefType;
  source: BriefSource;
  businessName: string;
  contactName: string;
  contactEmail: string;
  description: string;
  deliveryDateMs: number;
  projectTitle?: string;
  briefKind?: BriefKind;
  styleReferences?: string;
  keyMessages?: string;
  targetAudience?: string;
  deliverablesBreakdown?: string;
  locationDetails?: string;
  talentNotes?: string;
  budgetRange?: BriefBudgetRange;
  additionalNotes?: string;
  attachments?: Array<{ filename: string; url: string; size_bytes: number }>;
  companyId?: string;
  createdBy?: string;
}

export interface SubmitBriefResult {
  briefId: string;
  referenceNumber: string;
  taskId: string;
  matchResult: {
    companyId: string | null;
    companyName: string | null;
    confidence: number | null;
    method: string | null;
  };
}

export async function submitBrief(
  input: SubmitBriefInput,
  dbInstance = defaultDb,
): Promise<SubmitBriefResult> {
  const nowMs = Date.now();
  const briefId = randomUUID();
  const taskId = randomUUID();
  const referenceNumber = await nextReferenceNumber(dbInstance);

  let companyId = input.companyId ?? null;
  let matchConfidence: number | null = null;
  let matchMethod: BriefMatchMethod | null = null;
  let matchedCompanyName: string | null = null;
  let briefStatus: BriefStatus = "pending";

  if (input.source === "portal" && companyId) {
    matchMethod = "portal";
    matchConfidence = 100;
    briefStatus = "matched";
  } else if (input.source === "admin" && companyId) {
    matchMethod = "manual";
    matchConfidence = 100;
    briefStatus = "matched";
  } else if (input.source === "public") {
    const match = await matchBriefToClient(
      input.businessName,
      input.contactName,
      input.contactEmail,
      dbInstance,
    );
    if (match) {
      matchConfidence = Math.round(match.confidence * 100);
      matchedCompanyName = match.companyName;
      if (match.confidence >= 0.9) {
        companyId = match.companyId;
        matchMethod = "auto";
        briefStatus = "matched";
      } else if (match.confidence >= 0.6) {
        companyId = match.companyId;
        matchMethod = "suggested";
        briefStatus = "pending";
      } else {
        briefStatus = "unmatched";
      }
    } else {
      briefStatus = "unmatched";
    }
  }

  const taskTitle =
    input.briefType === "structured" && input.projectTitle
      ? `${input.projectTitle} — ${input.businessName}`
      : `${input.briefType === "lean" ? "Lean" : "Structured"} Brief — ${input.businessName}`;

  let createdBy = input.createdBy;
  if (!createdBy) {
    const adminUser = await dbInstance
      .select({ id: user.id })
      .from(user)
      .limit(1)
      .get();
    createdBy = adminUser?.id ?? "admin-dev-01";
  }

  await dbInstance.insert(tasks).values({
    id: taskId,
    title: taskTitle,
    body: input.description,
    kind: "client_deliverable",
    status: "todo",
    priority: "normal",
    due_at_ms: input.deliveryDateMs,
    entity_type: companyId ? "company" : null,
    entity_id: companyId,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
    created_by: createdBy,
  });

  await dbInstance.insert(briefs).values({
    id: briefId,
    reference_number: referenceNumber,
    brief_type: input.briefType,
    status: briefStatus,
    source: input.source,
    business_name: input.businessName,
    contact_name: input.contactName,
    contact_email: input.contactEmail,
    company_id: companyId,
    match_confidence: matchConfidence,
    match_method: matchMethod,
    matched_at_ms: companyId ? nowMs : null,
    matched_by: input.source === "admin" ? input.createdBy ?? null : null,
    description: input.description,
    delivery_date_ms: input.deliveryDateMs,
    project_title: input.projectTitle ?? null,
    brief_kind: input.briefKind ?? null,
    style_references: input.styleReferences ?? null,
    key_messages: input.keyMessages ?? null,
    target_audience: input.targetAudience ?? null,
    deliverables_breakdown: input.deliverablesBreakdown ?? null,
    location_details: input.locationDetails ?? null,
    talent_notes: input.talentNotes ?? null,
    budget_range: input.budgetRange ?? null,
    additional_notes: input.additionalNotes ?? null,
    attachments_json: input.attachments ?? [],
    auto_task_id: taskId,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await logActivity({
    kind: "brief_submitted",
    companyId: companyId ?? undefined,
    body: `Brief ${referenceNumber} submitted (${input.briefType}, ${input.source}).`,
    meta: {
      brief_id: briefId,
      reference_number: referenceNumber,
      brief_type: input.briefType,
      source: input.source,
      match_method: matchMethod,
      match_confidence: matchConfidence,
    },
  });

  if (input.briefType === "structured") {
    generateStoryboard(briefId).catch(() => {});
  }

  return {
    briefId,
    referenceNumber,
    taskId,
    matchResult: {
      companyId,
      companyName: matchedCompanyName,
      confidence: matchConfidence,
      method: matchMethod,
    },
  };
}

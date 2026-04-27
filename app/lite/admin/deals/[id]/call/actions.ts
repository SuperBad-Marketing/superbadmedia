"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { call_logs, type CallTemplateType, type CallTemperature } from "@/lib/db/schema/call-logs";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { activity_log } from "@/lib/db/schema/activity-log";
import { eq, desc, and } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";
import { invokeLlmText } from "@/lib/ai/invoke";
import { buildPreBriefingPrompt } from "@/lib/ai/call-notes/build-pre-briefing-prompt";
import { buildCustomQuestionsPrompt } from "@/lib/ai/call-notes/build-custom-questions-prompt";
import { buildPostSynthesisPrompt } from "@/lib/ai/call-notes/build-post-synthesis-prompt";
import { getCallTemplate } from "@/lib/call-templates";
import type { SectionsState } from "@/lib/call-templates/types";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function adminActorTag(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return `user:${session.user.id ?? "admin"}`;
}

export async function createCallAction(
  dealId: string,
  templateType: CallTemplateType,
): Promise<ActionResult<{ callId: string }>> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const deal = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1).then(r => r[0]);
  if (!deal) return { ok: false, error: "Deal not found." };

  const now = Date.now();
  const id = randomUUID();

  await db.insert(call_logs).values({
    id,
    deal_id: dealId,
    company_id: deal.company_id,
    contact_id: deal.primary_contact_id,
    stage_at_time: deal.stage,
    template_type: templateType,
    status: "prep",
    created_at_ms: now,
    updated_at_ms: now,
  });

  await logActivity({
    companyId: deal.company_id,
    contactId: deal.primary_contact_id,
    dealId,
    kind: "call_started",
    body: `${getCallTemplate(templateType).label} call started`,
    createdBy: by,
  });

  revalidatePath(`/lite/admin/deals/${dealId}`);
  return { ok: true, data: { callId: id } };
}

export async function generateBriefingAction(
  callId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const call = await db.select().from(call_logs).where(eq(call_logs.id, callId)).limit(1).then(r => r[0]);
  if (!call) return { ok: false, error: "Call not found." };

  const deal = await db.select().from(deals).where(eq(deals.id, call.deal_id)).limit(1).then(r => r[0]);
  if (!deal) return { ok: false, error: "Deal not found." };

  const company = await db.select().from(companies).where(eq(companies.id, call.company_id)).limit(1).then(r => r[0]);
  const contact = call.contact_id
    ? await db.select().from(contacts).where(eq(contacts.id, call.contact_id)).limit(1).then(r => r[0])
    : null;

  const pastCalls = await db.select()
    .from(call_logs)
    .where(and(eq(call_logs.deal_id, call.deal_id), eq(call_logs.status, "complete")))
    .orderBy(desc(call_logs.completed_at_ms))
    .limit(5);

  const pastCallSummaries = pastCalls.map(c => {
    const synthesis = c.llm_synthesis as { summary?: string } | null;
    return synthesis?.summary ?? `${getCallTemplate(c.template_type).label} call (${c.temperature ?? "no temp"})`;
  });

  const recentActivityRows = await db.select()
    .from(activity_log)
    .where(eq(activity_log.deal_id, call.deal_id))
    .orderBy(desc(activity_log.created_at_ms))
    .limit(10);

  const recentActivity = recentActivityRows.map(a => `${a.kind}: ${a.body}`);

  const template = getCallTemplate(call.template_type);

  const briefingPrompt = buildPreBriefingPrompt({
    companyName: company?.name ?? "Unknown",
    companyShape: company?.shape ?? null,
    industry: company?.industry_vertical ?? null,
    revenueRange: company?.revenue_range ?? null,
    teamSize: company?.team_size ?? null,
    location: company?.location ?? null,
    dealTitle: deal.title,
    dealStage: deal.stage,
    dealValueCents: deal.value_cents,
    dealSource: deal.source,
    contactName: contact?.name ?? null,
    contactRole: contact?.role ?? null,
    pastCallSummaries,
    recentActivity,
    templateLabel: template.label,
  });

  const customQuestionsPrompt = buildCustomQuestionsPrompt({
    companyName: company?.name ?? "Unknown",
    industry: company?.industry_vertical ?? null,
    dealStage: deal.stage,
    templateLabel: template.label,
    pastCallSummaries,
    recentActivity,
    templateSectionTitles: template.sections.map(s => s.title),
  });

  const [briefingRaw, customQuestionsRaw] = await Promise.all([
    invokeLlmText({ job: "call-pre-briefing", prompt: briefingPrompt, maxTokens: 1500, actorType: "internal" }),
    invokeLlmText({ job: "call-custom-questions", prompt: customQuestionsPrompt, maxTokens: 800, actorType: "internal" }),
  ]);

  let briefing = null;
  let customQuestions = null;

  try {
    briefing = JSON.parse(briefingRaw.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
  } catch {
    briefing = { situationSummary: briefingRaw, lastCallRecap: null, unresolvedItems: [], talkingPoints: [] };
  }

  try {
    customQuestions = JSON.parse(customQuestionsRaw.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
  } catch {
    customQuestions = [];
  }

  await db.update(call_logs)
    .set({
      llm_briefing: briefing,
      llm_custom_questions: customQuestions,
      updated_at_ms: Date.now(),
    })
    .where(eq(call_logs.id, callId));

  revalidatePath(`/lite/admin/deals/${call.deal_id}/call/${callId}`);
  return { ok: true };
}

export async function startCallAction(callId: string): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  await db.update(call_logs)
    .set({ status: "active", updated_at_ms: Date.now() })
    .where(eq(call_logs.id, callId));

  return { ok: true };
}

export async function saveCallProgressAction(
  callId: string,
  sectionsData: SectionsState,
): Promise<ActionResult> {
  await db.update(call_logs)
    .set({ sections_data: sectionsData as unknown as null, updated_at_ms: Date.now() })
    .where(eq(call_logs.id, callId));

  return { ok: true };
}

export async function endCallAction(callId: string): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  await db.update(call_logs)
    .set({ status: "debrief", updated_at_ms: Date.now() })
    .where(eq(call_logs.id, callId));

  return { ok: true };
}

export async function submitDebriefAction(
  callId: string,
  debrief: {
    temperature: CallTemperature;
    agreedNextStep: string;
    followUpDateMs: number | null;
    blockers: string;
  },
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  await db.update(call_logs)
    .set({
      temperature: debrief.temperature,
      agreed_next_step: debrief.agreedNextStep || null,
      follow_up_date_ms: debrief.followUpDateMs,
      blockers: debrief.blockers || null,
      updated_at_ms: Date.now(),
    })
    .where(eq(call_logs.id, callId));

  return { ok: true };
}

export async function generateSynthesisAction(
  callId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const call = await db.select().from(call_logs).where(eq(call_logs.id, callId)).limit(1).then(r => r[0]);
  if (!call) return { ok: false, error: "Call not found." };

  const deal = await db.select().from(deals).where(eq(deals.id, call.deal_id)).limit(1).then(r => r[0]);
  if (!deal) return { ok: false, error: "Deal not found." };

  const contact = call.contact_id
    ? await db.select().from(contacts).where(eq(contacts.id, call.contact_id)).limit(1).then(r => r[0])
    : null;

  const template = getCallTemplate(call.template_type);
  const sectionsData = (call.sections_data ?? {}) as SectionsState;

  const sectionNotes = template.sections.flatMap(section =>
    section.questions.map(q => ({
      sectionTitle: section.title,
      questionText: q.text,
      notes: sectionsData[q.id]?.notes ?? "",
      covered: sectionsData[q.id]?.checked ?? false,
    })),
  );

  const followUpDate = call.follow_up_date_ms
    ? new Date(call.follow_up_date_ms).toLocaleDateString("en-AU")
    : null;

  const prompt = buildPostSynthesisPrompt({
    companyName: deal.title,
    dealTitle: deal.title,
    dealStage: deal.stage,
    dealValueCents: deal.value_cents,
    contactName: contact?.name ?? null,
    templateLabel: template.label,
    temperature: call.temperature ?? "warm",
    agreedNextStep: call.agreed_next_step,
    followUpDate,
    blockers: call.blockers,
    sectionNotes,
  });

  const raw = await invokeLlmText({ job: "call-post-synthesis", prompt, maxTokens: 2000, actorType: "internal" });

  let synthesis = null;
  try {
    synthesis = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
  } catch {
    synthesis = { summary: raw, nextActions: [], stageRecommendation: null, flags: [] };
  }

  await db.update(call_logs)
    .set({ llm_synthesis: synthesis, updated_at_ms: Date.now() })
    .where(eq(call_logs.id, callId));

  revalidatePath(`/lite/admin/deals/${call.deal_id}/call/${callId}`);
  return { ok: true };
}

export async function completeCallAction(callId: string): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const call = await db.select().from(call_logs).where(eq(call_logs.id, callId)).limit(1).then(r => r[0]);
  if (!call) return { ok: false, error: "Call not found." };

  const now = Date.now();
  await db.update(call_logs)
    .set({ status: "complete", completed_at_ms: now, updated_at_ms: now })
    .where(eq(call_logs.id, callId));

  const synthesis = call.llm_synthesis as { summary?: string } | null;
  await logActivity({
    companyId: call.company_id,
    contactId: call.contact_id,
    dealId: call.deal_id,
    kind: "call_completed",
    body: synthesis?.summary ?? `${getCallTemplate(call.template_type).label} call completed`,
    meta: { temperature: call.temperature, callId },
    createdBy: by,
  });

  if (call.follow_up_date_ms) {
    await db.update(deals)
      .set({ snoozed_until_ms: call.follow_up_date_ms, updated_at_ms: now })
      .where(eq(deals.id, call.deal_id));
  }

  revalidatePath(`/lite/admin/deals/${call.deal_id}`);
  revalidatePath("/lite/admin/pipeline");
  return { ok: true };
}

export async function addAdHocNoteAction(
  dealId: string,
  note: {
    text: string;
    temperature?: CallTemperature | null;
    followUpDateMs?: number | null;
  },
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const deal = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1).then(r => r[0]);
  if (!deal) return { ok: false, error: "Deal not found." };

  await logActivity({
    companyId: deal.company_id,
    contactId: deal.primary_contact_id,
    dealId,
    kind: "adhoc_note_added",
    body: note.text,
    meta: { temperature: note.temperature ?? null },
    createdBy: by,
  });

  const now = Date.now();
  if (note.followUpDateMs) {
    await db.update(deals)
      .set({ snoozed_until_ms: note.followUpDateMs, updated_at_ms: now })
      .where(eq(deals.id, dealId));
  }

  revalidatePath(`/lite/admin/deals/${dealId}`);
  revalidatePath("/lite/admin/pipeline");
  return { ok: true };
}

export async function getCallAction(callId: string) {
  return db.select().from(call_logs).where(eq(call_logs.id, callId)).limit(1).then(r => r[0] ?? null);
}

export async function getCallsForDealAction(dealId: string) {
  return db.select()
    .from(call_logs)
    .where(eq(call_logs.deal_id, dealId))
    .orderBy(desc(call_logs.created_at_ms));
}

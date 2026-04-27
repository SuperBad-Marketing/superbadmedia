import { db } from "@/lib/db";
import { call_logs } from "@/lib/db/schema/call-logs";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CallFlowClient } from "./call-flow-client";
import { getCallTemplate } from "@/lib/call-templates";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string; callId: string }>;
}) {
  const { id: dealId, callId } = await params;

  const call = await db.select().from(call_logs).where(eq(call_logs.id, callId)).limit(1).then(r => r[0]);
  if (!call || call.deal_id !== dealId) notFound();

  const deal = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1).then(r => r[0]);
  if (!deal) notFound();

  const company = await db.select().from(companies).where(eq(companies.id, deal.company_id)).limit(1).then(r => r[0]);
  const contact = call.contact_id
    ? await db.select().from(contacts).where(eq(contacts.id, call.contact_id)).limit(1).then(r => r[0])
    : null;

  const template = getCallTemplate(call.template_type);

  return (
    <CallFlowClient
      call={{
        id: call.id,
        dealId: call.deal_id,
        status: call.status,
        templateType: call.template_type,
        temperature: call.temperature,
        agreedNextStep: call.agreed_next_step,
        followUpDateMs: call.follow_up_date_ms,
        blockers: call.blockers,
        sectionsData: (call.sections_data ?? {}) as Record<string, { checked: boolean; notes: string }>,
        llmBriefing: call.llm_briefing as Record<string, unknown> | null,
        llmCustomQuestions: call.llm_custom_questions as unknown[] | null,
        llmSynthesis: call.llm_synthesis as Record<string, unknown> | null,
        createdAtMs: call.created_at_ms,
      }}
      deal={{
        id: deal.id,
        title: deal.title,
        stage: deal.stage,
      }}
      companyName={company?.name ?? "Unknown"}
      contactName={contact?.name ?? null}
      template={template}
    />
  );
}

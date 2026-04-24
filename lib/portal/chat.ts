import { db } from "@/lib/db";
import { portal_chat_messages } from "@/lib/db/schema/portal-chat-messages";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";
import { invoices } from "@/lib/db/schema/invoices";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { threads, messages } from "@/lib/db/schema/messages";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { invokeLlmText } from "@/lib/ai/invoke";
import settingsRegistry from "@/lib/settings";
import { logActivity } from "@/lib/activity-log";
import type { PortalChatMessageRow } from "@/lib/db/schema/portal-chat-messages";

export async function getChatHistory(
  contactId: string,
  limit = 50,
): Promise<PortalChatMessageRow[]> {
  const rows = await db
    .select()
    .from(portal_chat_messages)
    .where(eq(portal_chat_messages.contact_id, contactId))
    .orderBy(desc(portal_chat_messages.created_at_ms))
    .limit(limit);
  return rows.reverse();
}

export async function getTodayChatCount(contactId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(portal_chat_messages)
    .where(
      and(
        eq(portal_chat_messages.contact_id, contactId),
        eq(portal_chat_messages.role, "client"),
        gte(portal_chat_messages.created_at_ms, startOfDay.getTime()),
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function getDailyLimit(contactId: string): Promise<number> {
  const contact = await db
    .select({ relationship_type: contacts.relationship_type })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  const isRetainer = contact[0]?.relationship_type === "client";
  const key = isRetainer
    ? "portal.chat_calls_per_day_retainer"
    : "portal.chat_calls_per_day_pre_retainer";
  return settingsRegistry.get(key);
}

interface ChatContext {
  contactName: string;
  companyName: string;
  contactRole: string | null;
  brandDnaStatus: string | null;
  brandDnaProse: string | null;
  dealStage: string | null;
  wonOutcome: string | null;
  valueCents: number | null;
  subscriptionState: string | null;
  billingCadence: string | null;
  pendingInvoiceCount: number;
  overdueInvoiceCount: number;
  isRetainer: boolean;
}

export async function assemblePortalContext(
  contactId: string,
): Promise<ChatContext> {
  const [contactRow] = await db
    .select({
      name: contacts.name,
      role: contacts.role,
      company_id: contacts.company_id,
      relationship_type: contacts.relationship_type,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  const [companyRow] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, contactRow.company_id))
    .limit(1);

  const dealRows = await db
    .select({
      stage: deals.stage,
      won_outcome: deals.won_outcome,
      value_cents: deals.value_cents,
      subscription_state: deals.subscription_state,
      billing_cadence: deals.billing_cadence,
    })
    .from(deals)
    .where(eq(deals.company_id, contactRow.company_id))
    .orderBy(desc(deals.created_at_ms))
    .limit(1);

  const invoiceRows = await db
    .select({
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.company_id, contactRow.company_id));

  const pendingInvoiceCount = invoiceRows.filter(
    (i) => i.status === "sent",
  ).length;
  const overdueInvoiceCount = invoiceRows.filter(
    (i) => i.status === "overdue",
  ).length;

  const bdna = await db
    .select({
      status: brand_dna_profiles.status,
      prose_portrait: brand_dna_profiles.prose_portrait,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.contact_id, contactId))
    .limit(1);

  const deal = dealRows[0] ?? null;
  const isRetainer = contactRow.relationship_type === "client";

  return {
    contactName: contactRow.name,
    companyName: companyRow?.name ?? "Unknown",
    contactRole: contactRow.role,
    brandDnaStatus: bdna[0]?.status ?? null,
    brandDnaProse: bdna[0]?.prose_portrait ?? null,
    dealStage: deal?.stage ?? null,
    wonOutcome: deal?.won_outcome ?? null,
    valueCents: deal?.value_cents ?? null,
    subscriptionState: deal?.subscription_state ?? null,
    billingCadence: deal?.billing_cadence ?? null,
    pendingInvoiceCount,
    overdueInvoiceCount,
    isRetainer,
  };
}

function buildContextBlock(ctx: ChatContext): string {
  const lines: string[] = [
    `Client: ${ctx.contactName} at ${ctx.companyName}`,
  ];
  if (ctx.contactRole) lines.push(`Role: ${ctx.contactRole}`);
  if (ctx.dealStage) lines.push(`Deal stage: ${ctx.dealStage}`);
  if (ctx.wonOutcome) lines.push(`Won outcome: ${ctx.wonOutcome}`);
  if (ctx.valueCents) lines.push(`Deal value: $${(ctx.valueCents / 100).toFixed(2)}`);
  if (ctx.subscriptionState) lines.push(`Subscription: ${ctx.subscriptionState}`);
  if (ctx.billingCadence) lines.push(`Billing: ${ctx.billingCadence}`);
  if (ctx.pendingInvoiceCount > 0)
    lines.push(`Pending invoices: ${ctx.pendingInvoiceCount}`);
  if (ctx.overdueInvoiceCount > 0)
    lines.push(`Overdue invoices: ${ctx.overdueInvoiceCount}`);
  if (ctx.brandDnaStatus)
    lines.push(`Brand DNA status: ${ctx.brandDnaStatus}`);
  lines.push(`Relationship: ${ctx.isRetainer ? "retainer client" : "prospect / pre-retainer"}`);
  return lines.join("\n");
}

const BARTENDER_SYSTEM = `You are the SuperBad portal bartender — the AI concierge for a creative marketing agency run by Andy Robinson in Melbourne. Your register is warm, observational, dry-humoured, never pitchy. You know the client's name and use it naturally. Short responses preferred — bartender efficiency, not chatbot verbosity.

Rules:
- Never pitch services. Never use "synergy", "leverage", or "solutions".
- If asked whether you're human: "No — but Andy is. Want me to get him?"
- Never reveal other clients' data or internal pipeline state.
- Never hallucinate data you weren't given in context.
- If the client asks something you can't answer or requests an action outside your scope, say you'll flag it for Andy (escalation).
- Keep responses to 1-3 sentences unless the client asks for detail.
- No exclamation marks. No slogan. No emoji unless the client uses them first.`;

export async function generateOpeningLine(
  contactId: string,
  options?: { kickoffVariant?: boolean },
): Promise<string> {
  const isKickoff = options?.kickoffVariant ?? false;

  // Don't send back-to-back assistant messages. If the most recent message
  // is already from the assistant, return it instead of generating another.
  const recent = await getChatHistory(contactId, 1);
  if (recent.length > 0 && recent[recent.length - 1].role === "assistant") {
    return recent[recent.length - 1].content;
  }

  const ctx = await assemblePortalContext(contactId);
  const contextBlock = buildContextBlock(ctx);

  const prompt = isKickoff
    ? `Generate a single warm opening line for ${ctx.contactName} who just became a retainer client. This is their first login after Brand DNA completion and deal close. Acknowledge the new chapter in one breath. Surface first-shoot scheduling as the single primary next action${ctx.pendingInvoiceCount > 0 ? ' — add "once your first invoice clears" since they have a pending invoice' : ""}. Never pitch services already paid for. Never re-walk Brand DNA. Bartender register, no slogan, no exclamation marks. One to two sentences max.

Current state:
${contextBlock}`
    : `Generate a single warm, contextual opening line for ${ctx.contactName} visiting their SuperBad portal. Acknowledge what's current without recapping everything. Never pitch. If nothing notable is happening, a simple warm greeting. One sentence only.

Current state:
${contextBlock}`;

  const line = await invokeLlmText({
    job: "client-mgmt-bartender-opening-line",
    system: BARTENDER_SYSTEM,
    prompt,
    maxTokens: 150,
  });

  await db.insert(portal_chat_messages).values({
    contact_id: contactId,
    role: "assistant",
    content: line,
    escalated_to_inbox: false,
    created_at_ms: Date.now(),
  });

  if (isKickoff) {
    await db
      .update(contacts)
      .set({
        retainer_kickoff_bartender_said_at_ms: Date.now(),
        updated_at_ms: Date.now(),
      })
      .where(eq(contacts.id, contactId));

    await logActivity({
      contactId,
      kind: "retainer_kickoff_bartender_message_sent",
      body: JSON.stringify({
        client_id: contactId,
        contact_id: contactId,
        gate_bypassed_pre_retainer: true,
      }),
    });
  }

  return line;
}

export interface ChatResponse {
  reply: string;
  escalated: boolean;
}

export async function handleChatMessage(
  contactId: string,
  message: string,
): Promise<ChatResponse> {
  const now = Date.now();

  await db.insert(portal_chat_messages).values({
    contact_id: contactId,
    role: "client",
    content: message,
    escalated_to_inbox: false,
    created_at_ms: now,
  });

  const ctx = await assemblePortalContext(contactId);
  const contextBlock = buildContextBlock(ctx);
  const history = await getChatHistory(contactId, 20);
  const historyBlock = history
    .map((m) => `${m.role === "client" ? ctx.contactName : "SuperBad"}: ${m.content}`)
    .join("\n");

  const system = `${BARTENDER_SYSTEM}

Client context:
${contextBlock}

${ctx.brandDnaProse ? `Brand DNA prose portrait:\n${ctx.brandDnaProse}\n` : ""}
Available actions you can help with:
- Navigate to invoices, quotes, or gallery (provide guidance)
- Explain their package or deal details
- Answer questions about their account
- If they ask to reschedule, cancel, edit profile, or anything outside scope: escalate to Andy

If you need to escalate, start your response with [ESCALATE] followed by your client-facing response. The escalation summary will be generated separately.

Recent conversation:
${historyBlock}`;

  const reply = await invokeLlmText({
    job: "client-mgmt-chat-response",
    system,
    prompt: message,
    maxTokens: 500,
  });

  const escalated = reply.startsWith("[ESCALATE]");
  const cleanReply = escalated
    ? reply.replace("[ESCALATE]", "").trim()
    : reply;

  await db.insert(portal_chat_messages).values({
    contact_id: contactId,
    role: "assistant",
    content: cleanReply,
    escalated_to_inbox: escalated,
    created_at_ms: Date.now(),
  });

  if (escalated) {
    await escalateToInbox(contactId, message, cleanReply, ctx);
  }

  return { reply: cleanReply, escalated };
}

async function escalateToInbox(
  contactId: string,
  clientMessage: string,
  bartenderReply: string,
  ctx: ChatContext,
): Promise<void> {
  const summary = await invokeLlmText({
    job: "client-mgmt-escalation-summary",
    system: `Client message: ${clientMessage}\nBartender response: ${bartenderReply}\nContext: ${ctx.contactName} at ${ctx.companyName}`,
    prompt:
      "Draft a concise, factual summary for Andy. Internal voice (not bartender). Include what the client asked, what the AI couldn't help with, and any relevant context. One paragraph maximum.",
    maxTokens: 300,
  });

  const [contact] = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  const threadId = randomUUID();
  const messageId = randomUUID();
  const now = Date.now();

  await db.insert(threads).values({
    id: threadId,
    contact_id: contactId,
    company_id: contact.company_id,
    channel_of_origin: "portal_chat",
    subject: `Portal chat escalation — ${ctx.contactName}`,
    priority_class: "signal",
    last_message_at_ms: now,
    last_inbound_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await db.insert(messages).values({
    id: messageId,
    thread_id: threadId,
    direction: "inbound",
    channel: "portal_chat",
    from_address: ctx.contactName,
    to_addresses: JSON.stringify(["andy@superbadmedia.com.au"]),
    body_text: summary,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await logActivity({
    companyId: contact.company_id,
    contactId,
    kind: "portal_chat_escalated",
    body: `Portal chat escalated: ${clientMessage.slice(0, 100)}`,
    meta: { thread_id: threadId },
  });
}

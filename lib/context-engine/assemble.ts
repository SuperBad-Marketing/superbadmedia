import { eq, desc, and, ne, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema/messages";
import { threads } from "@/lib/db/schema/messages";
import { activity_log } from "@/lib/db/schema/activity-log";
import { action_items } from "@/lib/db/schema/action-items";
import { deals } from "@/lib/db/schema/deals";
import { invoices } from "@/lib/db/schema/invoices";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { context_summaries } from "@/lib/db/schema/context-summaries";
import { active_strategies } from "@/lib/db/schema/active-strategies";

export type AssemblePurpose = "summary" | "extraction" | "draft";

export interface AssembledContext {
  contact: {
    id: string;
    name: string;
    role: string | null;
    email: string | null;
    preferredChannel: string;
    companyId: string;
  };
  company: {
    id: string;
    name: string;
    industry: string | null;
    sizeBand: string | null;
    location: string | null;
  } | null;
  recentMessages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    channel: string;
    subject: string | null;
    bodyText: string;
    sentAtMs: number | null;
  }>;
  activityEntries: Array<{
    kind: string;
    body: string;
    createdAtMs: number;
  }>;
  openActionItems: Array<{
    description: string;
    owner: string;
    dueDateMs: number | null;
  }>;
  currentDeal: {
    stage: string;
    valueCents: number | null;
    lastStageChangeAtMs: number;
    subscriptionState: string | null;
  } | null;
  outstandingInvoices: Array<{
    invoiceNumber: string;
    status: string;
    totalCentsIncGst: number | null;
  }>;
  brandDna: {
    signalTags: string | null;
    prosePortrait: string | null;
  } | null;
  conversationSummary: string | null;
  activeStrategy: {
    status: string;
    payloadJson: unknown;
  } | null;
}

export interface ExtractionContext {
  messageBody: string;
  direction: "inbound" | "outbound";
}

const SUMMARY_MESSAGE_LIMIT = 20;
const DRAFT_MESSAGE_LIMIT = 3;
const ACTIVITY_LIMIT = 30;

export async function assembleContext(
  contactId: string,
  purpose: "summary",
): Promise<AssembledContext>;
export async function assembleContext(
  contactId: string,
  purpose: "draft",
): Promise<AssembledContext>;
export async function assembleContext(
  contactId: string,
  purpose: "extraction",
  messageBody: string,
  direction: "inbound" | "outbound",
): Promise<ExtractionContext>;
export async function assembleContext(
  contactId: string,
  purpose: AssemblePurpose,
  messageBody?: string,
  direction?: "inbound" | "outbound",
): Promise<AssembledContext | ExtractionContext> {
  if (purpose === "extraction") {
    return {
      messageBody: messageBody!,
      direction: direction!,
    };
  }

  const messageLimit =
    purpose === "draft" ? DRAFT_MESSAGE_LIMIT : SUMMARY_MESSAGE_LIMIT;

  const contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();

  if (!contact) {
    throw new Error(`assembleContext: contact ${contactId} not found`);
  }

  const [company, recentMsgs, activityRows, actionItemRows, deal] =
    await Promise.all([
      db
        .select()
        .from(companies)
        .where(eq(companies.id, contact.company_id))
        .get(),

      db
        .select({
          id: messages.id,
          direction: messages.direction,
          channel: messages.channel,
          subject: messages.subject,
          bodyText: messages.body_text,
          sentAtMs: messages.sent_at_ms,
          threadId: messages.thread_id,
        })
        .from(messages)
        .innerJoin(threads, eq(messages.thread_id, threads.id))
        .where(eq(threads.contact_id, contactId))
        .orderBy(desc(messages.created_at_ms))
        .limit(messageLimit),

      purpose === "summary"
        ? db
            .select({
              kind: activity_log.kind,
              body: activity_log.body,
              createdAtMs: activity_log.created_at_ms,
            })
            .from(activity_log)
            .where(eq(activity_log.contact_id, contactId))
            .orderBy(desc(activity_log.created_at_ms))
            .limit(ACTIVITY_LIMIT)
        : Promise.resolve([]),

      db
        .select({
          description: action_items.description,
          owner: action_items.owner,
          dueDateMs: action_items.due_date_ms,
        })
        .from(action_items)
        .where(
          and(
            eq(action_items.contact_id, contactId),
            eq(action_items.status, "open"),
          ),
        ),

      db
        .select()
        .from(deals)
        .where(eq(deals.primary_contact_id, contactId))
        .orderBy(desc(deals.updated_at_ms))
        .get(),
    ]);

  const outstandingInvs = deal
    ? await db
        .select({
          invoiceNumber: invoices.invoice_number,
          status: invoices.status,
          totalCentsIncGst: invoices.total_cents_inc_gst,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.deal_id, deal.id),
            ne(invoices.status, "paid"),
            ne(invoices.status, "void"),
          ),
        )
    : [];

  const brandDna = await db
    .select({
      signalTags: brand_dna_profiles.signal_tags,
      prosePortrait: brand_dna_profiles.prose_portrait,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.company_id, contact.company_id),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .get();

  const summary = await db
    .select({
      conversationSummary: context_summaries.conversation_summary,
    })
    .from(context_summaries)
    .where(eq(context_summaries.contact_id, contactId))
    .get();

  const strategy = company
    ? await db
        .select({
          status: active_strategies.status,
          payloadJson: active_strategies.payload_json,
        })
        .from(active_strategies)
        .where(eq(active_strategies.client_id, company.id))
        .get()
    : null;

  return {
    contact: {
      id: contact.id,
      name: contact.name,
      role: contact.role,
      email: contact.email,
      preferredChannel: contact.preferred_channel,
      companyId: contact.company_id,
    },
    company: company
      ? {
          id: company.id,
          name: company.name,
          industry: company.industry,
          sizeBand: company.size_band,
          location: company.location,
        }
      : null,
    recentMessages: recentMsgs.map((m) => ({
      id: m.id,
      direction: m.direction as "inbound" | "outbound",
      channel: m.channel,
      subject: m.subject,
      bodyText: m.bodyText,
      sentAtMs: m.sentAtMs,
    })),
    activityEntries: activityRows,
    openActionItems: actionItemRows,
    currentDeal: deal
      ? {
          stage: deal.stage,
          valueCents: deal.value_cents,
          lastStageChangeAtMs: deal.last_stage_change_at_ms,
          subscriptionState: deal.subscription_state,
        }
      : null,
    outstandingInvoices: outstandingInvs,
    brandDna: brandDna ?? null,
    conversationSummary: summary?.conversationSummary ?? null,
    activeStrategy: strategy
      ? { status: strategy.status, payloadJson: strategy.payloadJson }
      : null,
  };
}

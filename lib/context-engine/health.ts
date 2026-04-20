import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema/messages";
import { threads } from "@/lib/db/schema/messages";
import { action_items } from "@/lib/db/schema/action-items";
import { deals } from "@/lib/db/schema/deals";
import { invoices } from "@/lib/db/schema/invoices";
import { contacts } from "@/lib/db/schema/contacts";

export type HealthLabel = "healthy" | "cooling" | "at_risk" | "stale";

export interface HealthScore {
  score: number;
  label: HealthLabel;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function labelFromScore(score: number): HealthLabel {
  if (score >= 75) return "healthy";
  if (score >= 50) return "cooling";
  if (score >= 25) return "at_risk";
  return "stale";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function computeHealthScore(
  contactId: string,
): Promise<HealthScore> {
  const now = Date.now();

  const contact = await db
    .select({ companyId: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();

  if (!contact) {
    return { score: 0, label: "stale" };
  }

  const [lastMsg, yourOverdueItems, theirOverdueItems, deal] =
    await Promise.all([
      db
        .select({ createdAtMs: messages.created_at_ms })
        .from(messages)
        .innerJoin(threads, eq(messages.thread_id, threads.id))
        .where(eq(threads.contact_id, contactId))
        .orderBy(desc(messages.created_at_ms))
        .limit(1)
        .get(),

      db
        .select({ dueDateMs: action_items.due_date_ms })
        .from(action_items)
        .where(
          and(
            eq(action_items.contact_id, contactId),
            eq(action_items.owner, "you"),
            eq(action_items.status, "open"),
          ),
        ),

      db
        .select({ dueDateMs: action_items.due_date_ms })
        .from(action_items)
        .where(
          and(
            eq(action_items.contact_id, contactId),
            eq(action_items.owner, "them"),
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

  const yourOverdueCount = yourOverdueItems.filter(
    (i) => i.dueDateMs != null && i.dueDateMs < now,
  ).length;

  const theirOverdueCount = theirOverdueItems.filter(
    (i) => i.dueDateMs != null && i.dueDateMs < now,
  ).length;

  const overdueInvoices = deal
    ? await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.deal_id, deal.id),
            eq(invoices.status, "overdue"),
          ),
        )
    : [];

  // Factor 1: Days since last contact (weight: 40)
  let recencyScore = 40;
  if (lastMsg) {
    const daysSince = (now - lastMsg.createdAtMs) / MS_PER_DAY;
    if (daysSince <= 3) recencyScore = 40;
    else if (daysSince <= 7) recencyScore = 30;
    else if (daysSince <= 14) recencyScore = 20;
    else if (daysSince <= 30) recencyScore = 10;
    else recencyScore = 0;
  } else {
    recencyScore = 0;
  }

  // Factor 2: Your overdue action items (weight: 20)
  const yourOverdueScore = clamp(20 - yourOverdueCount * 10, 0, 20);

  // Factor 3: Their overdue action items (weight: 10)
  const theirOverdueScore = clamp(10 - theirOverdueCount * 5, 0, 10);

  // Factor 4: Deal stage velocity (weight: 15)
  let stageScore = 15;
  if (deal) {
    const daysInStage =
      (now - deal.last_stage_change_at_ms) / MS_PER_DAY;
    if (daysInStage <= 7) stageScore = 15;
    else if (daysInStage <= 14) stageScore = 10;
    else if (daysInStage <= 30) stageScore = 5;
    else stageScore = 0;
  }

  // Factor 5: Outstanding invoice age (weight: 15)
  let invoiceScore = 15;
  if (overdueInvoices.length > 0) {
    invoiceScore = clamp(15 - overdueInvoices.length * 7, 0, 15);
  }

  const totalScore = clamp(
    recencyScore +
      yourOverdueScore +
      theirOverdueScore +
      stageScore +
      invoiceScore,
    0,
    100,
  );

  return {
    score: totalScore,
    label: labelFromScore(totalScore),
  };
}

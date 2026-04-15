/**
 * SB-9 — `saas_data_loss_warning` handler.
 *
 * Fires 7 days after a subscriber's first payment failure of a billing
 * cycle. Idempotent: re-checks `deals.subscription_state` at fire time
 * and no-ops if the subscription has recovered. Logs
 * `saas_data_loss_warning_sent` + sends the warning email.
 *
 * Scheduled by `invoice-payment-failed` webhook only on the first
 * failure of a cycle (enqueue guarded by `payment_failure_count === 0`
 * before increment). Cancelled by `invoice-payment-succeeded` on
 * recovery via `scheduled_tasks.status = "skipped"`.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { saas_products } from "@/lib/db/schema/saas-products";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import { logActivity } from "@/lib/activity-log";
import { sendSaasDataLossWarningEmail } from "@/lib/emails/saas-payment-recovery";

interface DataLossWarningPayload {
  deal_id: string;
  first_failure_at_ms: number;
}

function dashboardUrl(): string {
  const base =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au";
  return `${base.replace(/\/$/, "")}/lite/onboarding`;
}

export async function handleSaasDataLossWarning(
  task: ScheduledTaskRow,
): Promise<void> {
  const payload = task.payload as DataLossWarningPayload | null;
  if (!payload?.deal_id) {
    throw new Error(
      `saas_data_loss_warning: missing deal_id on task ${task.id}`,
    );
  }

  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, payload.deal_id))
    .get();

  if (!deal) return;

  // Idempotent re-check — if subscription recovered between scheduling
  // and fire, skip silently.
  if (deal.subscription_state !== "past_due") return;
  if (!deal.saas_product_id || !deal.primary_contact_id) return;

  const contact = await db
    .select({ email: contacts.email_normalised })
    .from(contacts)
    .where(eq(contacts.id, deal.primary_contact_id))
    .get();
  if (!contact?.email) return;

  const product = await db
    .select({ name: saas_products.name })
    .from(saas_products)
    .where(eq(saas_products.id, deal.saas_product_id))
    .get();

  const nowMs = Date.now();
  const firstFailureMs =
    deal.first_payment_failure_at_ms ?? payload.first_failure_at_ms;
  const daysSinceFailure = Math.max(
    1,
    Math.round((nowMs - firstFailureMs) / (24 * 60 * 60 * 1000)),
  );

  await sendSaasDataLossWarningEmail({
    to: contact.email,
    productName: product?.name ?? "SuperBad",
    dashboardUrl: dashboardUrl(),
    daysSinceFailure,
  });

  await logActivity({
    companyId: deal.company_id,
    contactId: deal.primary_contact_id,
    dealId: deal.id,
    kind: "saas_data_loss_warning_sent",
    body: `Data-loss warning sent after ${daysSinceFailure} days past due.`,
    meta: {
      deal_id: deal.id,
      product_id: deal.saas_product_id,
      first_payment_failure_at_ms: firstFailureMs,
      days_since_failure: daysSinceFailure,
    },
  });
}

export const SAAS_DATA_LOSS_HANDLERS = {
  saas_data_loss_warning: handleSaasDataLossWarning,
} as const;

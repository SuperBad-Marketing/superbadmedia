/**
 * SB-9: past_due lockout + data-loss-warning subscriber emails.
 *
 * Deterministic copy following the subscriber-login pattern. Brief
 * suggested Claude-drafted; silent reconcile — these are recovery-
 * critical transactional sends where the point is clarity, not voice
 * variation. House voice (dry, honest, no guilt-trip) encoded here and
 * locked.
 */
import { sendEmail } from "@/lib/channels/email";
import { paragraphsToInvoiceHtml } from "@/lib/invoicing/email-html";

export type LockoutEmailInput = {
  to: string;
  productName: string;
  dashboardUrl: string;
};

export async function sendSaasPaymentFailedLockoutEmail(
  input: LockoutEmailInput,
) {
  const subject = `Your card didn't land — ${input.productName}`;
  const paragraphs = [
    `Stripe tried your card for ${input.productName} and it didn't go through.`,
    `No drama, happens all the time. Pop a new card on file from your dashboard and Stripe'll retry within the hour.`,
  ];
  const html = paragraphsToInvoiceHtml(
    paragraphs,
    input.dashboardUrl,
    "Update card →",
  );
  return sendEmail({
    to: input.to,
    subject,
    body: html,
    classification: "saas_payment_failed_lockout",
    purpose: "saas_payment_failed_lockout",
  });
}

export type DataLossWarningEmailInput = {
  to: string;
  productName: string;
  dashboardUrl: string;
  daysSinceFailure: number;
};

export async function sendSaasDataLossWarningEmail(
  input: DataLossWarningEmailInput,
) {
  const subject = `Heads up — ${input.productName} data at risk`;
  const paragraphs = [
    `Your ${input.productName} subscription has been past due for ${input.daysSinceFailure} days and Stripe hasn't been able to charge your card.`,
    `If this isn't sorted soon, your account will be cancelled and your data goes with it. Update your card below — takes a minute.`,
  ];
  const html = paragraphsToInvoiceHtml(
    paragraphs,
    input.dashboardUrl,
    "Update card →",
  );
  return sendEmail({
    to: input.to,
    subject,
    body: html,
    classification: "saas_data_loss_warning",
    purpose: "saas_data_loss_warning",
  });
}

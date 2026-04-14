/**
 * /lite/invoices/[token] — client-facing invoice page (BI-2b slice).
 *
 * Full branded two-section scroll-snap experience per spec §4.4:
 *   §1 the invoice; §2 payment (bank transfer details + Stripe Payment
 *   Element). Paid/overdue/void state branches handled server-side.
 *
 * Public surface (no auth) — proxy allowlists `/lite/invoices/`.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices, type InvoiceLineItem } from "@/lib/db/schema/invoices";
import { defaultSupplier } from "@/lib/invoicing/pdf-template";
import { loadPublicInvoiceByToken } from "@/lib/invoicing/load-public-invoice";
import {
  InvoiceWebExperience,
  type InvoiceStatusForClient,
} from "@/components/lite/invoices/invoice-web-experience";
import { SupersededInvoiceCard } from "@/components/lite/invoices/superseded-invoice-card";

export const dynamic = "force-dynamic";

function bankDetailsFromEnv() {
  return {
    account_name:
      process.env.SUPERBAD_BANK_ACCOUNT_NAME ?? "To be confirmed",
    bsb: process.env.SUPERBAD_BANK_BSB ?? "To be confirmed",
    account_number:
      process.env.SUPERBAD_BANK_ACCOUNT_NUMBER ?? "To be confirmed",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const row = await db
    .select({ invoice_number: invoices.invoice_number })
    .from(invoices)
    .where(eq(invoices.token, token))
    .get();
  if (!row) {
    return { title: "SuperBad", robots: { index: false, follow: false } };
  }
  return {
    title: `Tax Invoice ${row.invoice_number} — SuperBad`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bundle = await loadPublicInvoiceByToken(token);
  if (!bundle) notFound();

  const {
    invoice,
    company,
    primaryContact,
    sourceQuoteToken,
    supersededByToken,
  } = bundle;

  // Void state: gentle redirect card if there's a replacement, plain
  // void card otherwise.
  if (invoice.status === "void") {
    return (
      <SupersededInvoiceCard
        replacementToken={supersededByToken}
        invoiceNumber={invoice.invoice_number}
      />
    );
  }

  const supplier = defaultSupplier();
  const lineItems = (invoice.line_items_json ?? []) as InvoiceLineItem[];
  const contactLine = primaryContact
    ? [primaryContact.name, primaryContact.email].filter(Boolean).join(" · ")
    : null;

  return (
    <InvoiceWebExperience
      token={invoice.token}
      invoiceNumber={invoice.invoice_number}
      status={invoice.status as InvoiceStatusForClient}
      companyName={company.name}
      companyAbn={company.abn}
      contactLine={contactLine}
      supplier={supplier}
      bank={bankDetailsFromEnv()}
      issueDateMs={invoice.issue_date_ms}
      dueDateMs={invoice.due_at_ms}
      paidAtMs={invoice.paid_at_ms}
      stripePaymentIntentId={invoice.stripe_payment_intent_id}
      scopeSummary={invoice.scope_summary}
      lineItems={lineItems}
      gstApplicable={invoice.gst_applicable}
      totalIncGstCents={invoice.total_cents_inc_gst}
      totalExGstCents={invoice.total_cents_ex_gst}
      gstCents={invoice.gst_cents}
      sourceQuoteToken={sourceQuoteToken}
      pdfHref={`/api/invoices/${invoice.token}/pdf`}
    />
  );
}

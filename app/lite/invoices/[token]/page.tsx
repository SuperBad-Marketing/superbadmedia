/**
 * /lite/invoices/[token] — client-facing invoice page (BI-1b slice).
 *
 * Minimum viable read-only view: masthead, "Tax Invoice" title, invoice
 * number, issue + due dates, billed-to/from blocks, line items, GST-
 * itemised totals, Download PDF link. Scroll-snap two-section layout,
 * Stripe Payment Element, post-payment confirmation, and the "Mark as
 * paid via bank transfer" admin button all land in BI-2.
 *
 * Public surface (no auth) — proxy allowlists `/lite/invoices/`.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices, type InvoiceLineItem } from "@/lib/db/schema/invoices";
import { companies } from "@/lib/db/schema/companies";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { quotes } from "@/lib/db/schema/quotes";
import { defaultSupplier } from "@/lib/invoicing/pdf-template";

export const dynamic = "force-dynamic";

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

function moneyAud(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invoice = await db
    .select()
    .from(invoices)
    .where(eq(invoices.token, token))
    .get();
  if (!invoice) notFound();

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, invoice.company_id))
    .get();
  if (!company) notFound();

  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, invoice.deal_id))
    .get();
  let primaryContact: ContactRow | null = null;
  if (deal && "primary_contact_id" in deal && deal.primary_contact_id) {
    primaryContact =
      ((await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, deal.primary_contact_id))
        .get()) as ContactRow | undefined) ?? null;
  }

  let quoteUrl: string | null = null;
  if (invoice.quote_id) {
    const sourceQuote = await db
      .select({ token: quotes.token })
      .from(quotes)
      .where(eq(quotes.id, invoice.quote_id))
      .get();
    if (sourceQuote?.token) {
      quoteUrl = `/lite/quotes/${sourceQuote.token}`;
    }
  }

  const supplier = defaultSupplier();
  const lineItems = (invoice.line_items_json ?? []) as InvoiceLineItem[];
  const pdfHref = `/api/invoices/${invoice.token}/pdf`;
  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";
  const isVoid = invoice.status === "void";

  return (
    <main className="min-h-[100dvh] bg-[#faf6ef] text-[#1a1a1a] font-[family-name:var(--font-dm-sans,system-ui)]">
      <div className="mx-auto max-w-[760px] px-6 py-16 md:py-20">
        <header className="flex items-start justify-between gap-6">
          <div>
            <div className="font-[family-name:var(--font-black-han-sans,Impact)] text-3xl tracking-wider leading-none">
              SUPERBAD
            </div>
            <div className="mt-1 text-[10px] tracking-[0.22em] uppercase text-[#6b6b6b]">
              SuperBad Marketing · Melbourne
            </div>
          </div>
          {isPaid ? (
            <div className="rounded-sm border-2 border-[#2f8f5a] px-3 py-1.5 text-[#2f8f5a] font-[family-name:var(--font-black-han-sans,Impact)] text-lg tracking-wider">
              PAID
            </div>
          ) : null}
        </header>

        <h1 className="mt-10 font-[family-name:var(--font-black-han-sans,Impact)] text-2xl tracking-wide uppercase text-[#c1202d]">
          Tax Invoice
        </h1>

        <dl className="mt-5 grid grid-cols-3 gap-x-6 gap-y-2 text-sm text-[#4a4a4a]">
          <div>
            <dt className="text-[10px] tracking-[0.18em] uppercase text-[#8a8a8a] mb-1">
              Invoice
            </dt>
            <dd>{invoice.invoice_number}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-[0.18em] uppercase text-[#8a8a8a] mb-1">
              Issued
            </dt>
            <dd>{formatDate(invoice.issue_date_ms)}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-[0.18em] uppercase text-[#8a8a8a] mb-1">
              Due
            </dt>
            <dd>{formatDate(invoice.due_at_ms)}</dd>
          </div>
        </dl>

        <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase text-[#8a8a8a] mb-2">
              Billed to
            </div>
            <div className="font-[family-name:var(--font-black-han-sans,Impact)] text-xl leading-tight">
              {company.name}
            </div>
            {company.abn ? (
              <div className="mt-1 text-sm text-[#6b6b6b]">ABN {company.abn}</div>
            ) : null}
            {primaryContact ? (
              <div className="text-sm text-[#6b6b6b]">
                {[primaryContact.name, primaryContact.email]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase text-[#8a8a8a] mb-2">
              From
            </div>
            <div className="font-[family-name:var(--font-black-han-sans,Impact)] text-xl leading-tight">
              {supplier.name}
            </div>
            <div className="mt-1 text-sm text-[#6b6b6b]">ABN {supplier.abn}</div>
            <div className="text-sm text-[#6b6b6b]">{supplier.email}</div>
          </div>
        </section>

        {invoice.scope_summary ? (
          <p className="mt-8 border-l-2 border-[#c1202d] bg-[#c1202d]/5 px-4 py-3 text-[15px] leading-relaxed text-[#4a4a4a]">
            {invoice.scope_summary}
          </p>
        ) : null}

        <table className="mt-10 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-[10px] uppercase tracking-[0.15em] text-[#6b6b6b]">
              <th className="py-2 text-left font-medium">Description</th>
              <th className="py-2 text-right font-medium w-16">Qty</th>
              <th className="py-2 text-right font-medium w-28">Unit inc GST</th>
              <th className="py-2 text-right font-medium w-28">Line total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 italic text-[#8a8a8a]">
                  No line items.
                </td>
              </tr>
            ) : (
              lineItems.map((l, i) => (
                <tr key={i} className="border-b border-[#e6dfd1]">
                  <td className="py-3 align-top">{l.description}</td>
                  <td className="py-3 align-top text-right tabular-nums">
                    {l.quantity}
                  </td>
                  <td className="py-3 align-top text-right tabular-nums">
                    {moneyAud(l.unit_price_cents_inc_gst)}
                  </td>
                  <td className="py-3 align-top text-right tabular-nums">
                    {moneyAud(l.line_total_cents_inc_gst)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-6 ml-auto w-full max-w-[280px] text-sm">
          {invoice.gst_applicable ? (
            <>
              <div className="flex justify-between py-1 text-[#4a4a4a]">
                <span>Subtotal (ex GST)</span>
                <span className="tabular-nums">
                  {moneyAud(invoice.total_cents_ex_gst)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-[#4a4a4a]">
                <span>GST (10%)</span>
                <span className="tabular-nums">{moneyAud(invoice.gst_cents)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-1 text-xs italic text-[#8a8a8a]">
              <span>GST not applicable</span>
            </div>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-[#1a1a1a] pt-3">
            <span className="text-[10px] tracking-[0.18em] uppercase text-[#6b6b6b]">
              Total inc GST
            </span>
            <span className="font-[family-name:var(--font-black-han-sans,Impact)] text-3xl leading-none tabular-nums">
              {moneyAud(invoice.total_cents_inc_gst)}
            </span>
          </div>
        </div>

        {isOverdue ? (
          <div className="mt-8 rounded-sm border-l-2 border-[#c1202d] bg-[#c1202d]/5 px-4 py-3 text-sm text-[#c1202d]">
            This invoice is overdue.
          </div>
        ) : null}

        {isVoid ? (
          <div className="mt-8 rounded-sm border-l-2 border-[#8a8a8a] bg-[#efe9dd] px-4 py-3 text-sm text-[#6b6b6b]">
            This invoice has been voided.
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={pdfHref}
            className="inline-flex items-center gap-2 rounded-sm bg-[#1a1a1a] px-5 py-3 text-[#faf6ef] transition hover:bg-black"
          >
            <span className="font-[family-name:var(--font-black-han-sans,Impact)] tracking-wide">
              Download PDF
            </span>
            <span className="text-[#c1202d]" aria-hidden>
              →
            </span>
          </a>
          {quoteUrl ? (
            <a
              href={quoteUrl}
              className="text-sm text-[#4a4a4a] underline decoration-[#c1202d] underline-offset-4 hover:text-[#1a1a1a]"
            >
              View the original proposal →
            </a>
          ) : null}
        </div>

        <footer className="mt-16 text-xs leading-relaxed text-[#8a8a8a]">
          Tax invoice issued by {supplier.name}. Standard terms apply — read
          them at{" "}
          <a href="/lite/legal/terms" className="underline">
            /lite/legal/terms
          </a>
          .
        </footer>
      </div>
    </main>
  );
}

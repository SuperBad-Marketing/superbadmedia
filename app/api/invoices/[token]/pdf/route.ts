import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema/invoices";
import { renderInvoicePdf } from "@/lib/invoicing/render-invoice-pdf";

/**
 * Token-gated invoice PDF download. Public surface — anyone with the
 * token can fetch the PDF, matching `/lite/invoices/[token]` page
 * access. No status gating: paid/overdue/void invoices all render
 * (the paid variant picks up its own watermark from the template).
 *
 * Streams `application/pdf` inline with a brand-forward filename per
 * `feedback_takeaway_artefacts_brand_forward` + spec §4.5.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const invoice = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.token, token))
    .get();
  if (!invoice) {
    return new Response("not found", { status: 404 });
  }
  const { buffer, filename } = await renderInvoicePdf(invoice.id);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import { renderQuotePdf } from "@/lib/quote-builder/render-quote-pdf";

/**
 * Token-gated quote PDF download. Public surface — anyone with the token
 * can fetch the PDF, matching `/lite/quotes/[token]` page access. No
 * status gating: superseded/withdrawn/expired quotes still render their
 * own PDF (the row is the proof, the web page is the live experience).
 *
 * Streams `application/pdf` inline with a brand-forward filename per
 * `feedback_takeaway_artefacts_brand_forward` + spec §4.4.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const quote = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.token, token))
    .get();
  if (!quote) {
    return new Response("not found", { status: 404 });
  }
  const { buffer, filename } = await renderQuotePdf(quote.id);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}

"use server";

/**
 * Public quote-page actions. QB-4c ships the real Accept flow:
 *   1. Capture proof-of-acceptance (legal versions, ip, UA, content hash)
 *   2. Transition quote: sent|viewed → accepted
 *   3. Manual-billed: full post-accept side effects inline (deal → won,
 *      manual_invoice_generate enqueue, settle email).
 *   4. Stripe-billed: proof captured + quote flipped to accepted; the
 *      caller then confirms the Payment Intent client-side; webhook
 *      finishes the subscription + settle side effects.
 */
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import { acceptQuote } from "@/lib/quote-builder/accept";

export type AcceptQuoteActionResult =
  | {
      ok: true;
      paymentMode: "stripe" | "manual";
    }
  | {
      ok: false;
      error: string;
    };

export async function acceptQuoteAction(input: {
  token: string;
}): Promise<AcceptQuoteActionResult> {
  const quote = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.token, input.token))
    .get();
  if (!quote) return { ok: false, error: "quote_not_found" };

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent") ?? null;

  const result = await acceptQuote({
    quote_id: quote.id,
    ip,
    userAgent,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, paymentMode: result.paymentMode };
}

"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import {
  updateDraftQuote,
  QuoteNotDraftError,
} from "@/lib/quote-builder/draft";
import type { QuoteContent } from "@/lib/quote-builder/content-shape";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string };

export async function updateDraftQuoteAction(input: {
  deal_id: string;
  quote_id: string;
  content: QuoteContent;
}): Promise<ActionResult<{ updated_at_ms: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    await updateDraftQuote({
      quote_id: input.quote_id,
      content: input.content,
      user_id: session.user.id,
    });
    revalidatePath(
      `/lite/admin/deals/${input.deal_id}/quotes/${input.quote_id}/edit`,
    );
    return { ok: true, value: { updated_at_ms: Date.now() } };
  } catch (err) {
    if (err instanceof QuoteNotDraftError) {
      return {
        ok: false,
        error: "This quote is no longer a draft.",
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed.",
    };
  }
}

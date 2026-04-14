"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import {
  updateDraftQuote,
  QuoteNotDraftError,
} from "@/lib/quote-builder/draft";
import type { QuoteContent } from "@/lib/quote-builder/content-shape";
import {
  composeQuoteSendEmail,
  type ComposedQuoteEmail,
} from "@/lib/quote-builder/compose-send-email";
import { transitionQuoteStatus } from "@/lib/quote-builder/transitions";
import { sendEmail } from "@/lib/channels/email/send";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { paragraphsToHtml } from "@/lib/quote-builder/compose-send-email";

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

export type PrepareSendQuoteResult = ActionResult<{
  subject: string;
  bodyParagraphs: string[];
  recipientEmail: string;
  recipientName: string;
  drift: ComposedQuoteEmail["drift"];
  fallbackUsed: boolean;
  quoteUrl: string;
}>;

/**
 * Compose the send-email draft for the modal. Admin-only. Read-only —
 * does not transition the quote. Caller surfaces drift indicator + lets
 * Andy edit subject/paragraphs before firing `sendQuoteAction`.
 */
export async function prepareSendQuoteAction(input: {
  quote_id: string;
}): Promise<PrepareSendQuoteResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const composed = await composeQuoteSendEmail({ quote_id: input.quote_id });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const quote = await db
      .select({ token: quotes.token })
      .from(quotes)
      .where(eq(quotes.id, input.quote_id))
      .get();
    if (!quote) return { ok: false, error: "Quote not found." };
    return {
      ok: true,
      value: {
        subject: composed.subject,
        bodyParagraphs: composed.bodyParagraphs,
        recipientEmail: composed.recipientEmail,
        recipientName: composed.recipientName,
        drift: composed.drift,
        fallbackUsed: composed.fallbackUsed,
        quoteUrl: `${baseUrl.replace(/\/$/, "")}/lite/quotes/${quote.token}`,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Compose failed.",
    };
  }
}

/**
 * Final send action. Atomically transitions draft → sent (concurrency-
 * guarded), dispatches the email via `sendEmail()` with the
 * `quote_send` classification (transactional, bypasses outreach kill
 * switch + quiet window), and enqueues a `quote_pdf_render` warm-up
 * task. Idempotent on quote.status — a second click after success will
 * bounce on the transition guard with a typed error.
 */
export async function sendQuoteAction(input: {
  deal_id: string;
  quote_id: string;
  to: string;
  subject: string;
  bodyParagraphs: string[];
}): Promise<ActionResult<{ message_id?: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  if (!input.to || input.bodyParagraphs.length === 0 || !input.subject.trim()) {
    return { ok: false, error: "Subject, recipient, and body are required." };
  }
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const row = await db
      .select({ token: quotes.token, status: quotes.status, expires_at_ms: quotes.expires_at_ms })
      .from(quotes)
      .where(eq(quotes.id, input.quote_id))
      .get();
    if (!row) return { ok: false, error: "Quote not found." };
    if (row.status !== "draft") {
      return { ok: false, error: `Quote already ${row.status}.` };
    }
    const quoteUrl = `${baseUrl.replace(/\/$/, "")}/lite/quotes/${row.token}`;
    const bodyHtml = paragraphsToHtml(input.bodyParagraphs, quoteUrl);

    const result = await sendEmail({
      to: input.to,
      subject: input.subject.trim(),
      body: bodyHtml,
      classification: "quote_send",
      purpose: `quote-builder:${input.quote_id}`,
    });
    if (!result.sent) {
      return {
        ok: false,
        error: `Send blocked — ${result.reason ?? "unknown"}.`,
      };
    }

    // Transition only after the email lands. Concurrency-guarded.
    await transitionQuoteStatus({
      quote_id: input.quote_id,
      from: "draft",
      to: "sent",
      patch: {
        sent_at_ms: Date.now(),
        thread_message_id: result.messageId ?? null,
      },
    });

    // Warm the PDF cache offline so the first client click is instant.
    await enqueueTask({
      task_type: "quote_pdf_render",
      runAt: Date.now(),
      payload: { quote_id: input.quote_id },
      idempotencyKey: `quote_pdf_render:${input.quote_id}`,
    });

    revalidatePath(
      `/lite/admin/deals/${input.deal_id}/quotes/${input.quote_id}/edit`,
    );
    revalidatePath(`/lite/admin/deals/${input.deal_id}`);
    return { ok: true, value: { message_id: result.messageId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Send failed.",
    };
  }
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import { quote_templates } from "@/lib/db/schema/quote-templates";
import { catalogue_items } from "@/lib/db/schema/catalogue-items";
import {
  updateDraftQuote,
  QuoteNotDraftError,
} from "@/lib/quote-builder/draft";
import {
  type QuoteContent,
  type QuoteLineItem,
  computeTotals,
  inferStructure,
} from "@/lib/quote-builder/content-shape";
import {
  composeQuoteSendEmail,
  type ComposedQuoteEmail,
} from "@/lib/quote-builder/compose-send-email";
import {
  composeIntroParagraph,
  checkIntroRedraftThrottle,
} from "@/lib/quote-builder/compose-intro-paragraph";
import { transitionQuoteStatus } from "@/lib/quote-builder/transitions";
import { sendEmail } from "@/lib/channels/email/send";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { paragraphsToHtml } from "@/lib/quote-builder/compose-send-email";
import { logActivity } from "@/lib/activity-log";
import { settingsRegistry } from "@/lib/settings";
import { inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

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
export type RedraftIntroResult = ActionResult<{
  paragraph_text: string;
  provenance: string;
  confidence: "high" | "medium" | "low";
  drift_score: number;
  drift_pass: boolean;
  remaining: number;
}>;

/**
 * Regenerate the §1 "What you told us" paragraph via the pyramid-synthesis
 * Opus prompt (§6.2). Throttled to `quote.intro_paragraph_redraft_hourly_cap`
 * redrafts per quote per rolling hour. Returns the draft without writing it
 * — caller applies via `updateDraftQuoteAction` after Andy inspects the result.
 */
export async function redraftIntroParagraphAction(input: {
  quote_id: string;
  freeformInstruction?: string | null;
}): Promise<RedraftIntroResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const throttle = await checkIntroRedraftThrottle(input.quote_id);
    if (!throttle.allowed) {
      const minutes = Math.max(
        1,
        Math.ceil((throttle.resetMs - Date.now()) / 60000),
      );
      return {
        ok: false,
        error: `Redraft cap reached — try again in ~${minutes}m.`,
      };
    }
    const composed = await composeIntroParagraph({
      quote_id: input.quote_id,
      freeformInstruction: input.freeformInstruction ?? null,
    });
    await logActivity({
      kind: "note",
      body: "Intro paragraph redrafted.",
      meta: {
        kind: "quote_intro_redrafted",
        quote_id: input.quote_id,
        confidence: composed.confidence,
        drift_score: composed.drift.score,
      },
      createdBy: session.user.id,
    });
    return {
      ok: true,
      value: {
        paragraph_text: composed.paragraph_text,
        provenance: composed.provenance,
        confidence: composed.confidence,
        drift_score: composed.drift.score,
        drift_pass: composed.drift.pass,
        remaining: Math.max(0, throttle.remaining - 1),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Redraft failed.",
    };
  }
}

export type ApplyTemplateResult = ActionResult<{
  content: QuoteContent;
  term_length_months: number | null;
}>;

/**
 * Seed the draft from a `quote_templates` row. Replaces the §2 line items
 * + §2/§4 prose, sets term length if the template specifies one, and
 * increments `usage_count` (atomic SQL increment — no read-modify-write
 * race).
 *
 * Returns the new content for the client to swap into editor state; the
 * caller fires `updateDraftQuoteAction` with it to persist. §1 "What you
 * told us" is never templated per spec §4.5.
 */
export async function applyQuoteTemplateAction(input: {
  quote_id: string;
  template_id: string;
  current_content: QuoteContent;
}): Promise<ApplyTemplateResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const tpl = await db
      .select()
      .from(quote_templates)
      .where(eq(quote_templates.id, input.template_id))
      .get();
    if (!tpl || tpl.deleted_at_ms != null) {
      return { ok: false, error: "Template not found." };
    }
    const defaults = (tpl.default_line_items_json ?? []) as Array<{
      catalogue_item_id: string;
      qty: number;
      override_price_cents_inc_gst: number | null;
      kind: "retainer" | "one_off";
    }>;
    const ids = defaults.map((d) => d.catalogue_item_id);
    const catRows = ids.length
      ? await db
          .select()
          .from(catalogue_items)
          .where(inArray(catalogue_items.id, ids))
      : [];
    const catMap = new Map(catRows.map((r) => [r.id, r]));
    const lineItems: QuoteLineItem[] = [];
    for (const d of defaults) {
      const cat = catMap.get(d.catalogue_item_id);
      if (!cat || cat.deleted_at_ms != null) continue;
      const price =
        d.override_price_cents_inc_gst ?? cat.base_price_cents_inc_gst;
      lineItems.push({
        id: randomUUID(),
        kind: d.kind,
        snapshot: {
          catalogue_item_id: cat.id,
          name: cat.name,
          category: cat.category,
          unit: cat.unit,
          base_price_cents_inc_gst: cat.base_price_cents_inc_gst,
          tier_rank: cat.tier_rank,
        },
        qty: d.qty,
        unit_price_cents_inc_gst: price,
      });
    }
    const sections = (tpl.default_sections_json ?? {}) as {
      whatWellDo_prose?: string;
      terms_overrides_prose?: string;
    };
    const nextContent: QuoteContent = {
      ...input.current_content,
      sections: {
        // §1 stays — templates never carry client-specific prose.
        whatYouToldUs: input.current_content.sections.whatYouToldUs,
        whatWellDo: {
          line_items: lineItems,
          prose: sections.whatWellDo_prose ?? "",
        },
        terms: {
          template_id: input.template_id,
          overrides_prose: sections.terms_overrides_prose ?? "",
        },
      },
      term_length_months:
        tpl.term_length_months ?? input.current_content.term_length_months,
    };
    // Defensive recompute so the caller gets a valid shape to preview.
    computeTotals(nextContent);
    inferStructure(nextContent);

    await db
      .update(quote_templates)
      .set({
        usage_count: sql`${quote_templates.usage_count} + 1`,
        updated_at_ms: Date.now(),
      })
      .where(eq(quote_templates.id, input.template_id));

    return {
      ok: true,
      value: {
        content: nextContent,
        term_length_months: nextContent.term_length_months,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Apply failed.",
    };
  }
}

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

    // Nudge if still unviewed N days from now (per §3.1.5 + §3.2.2).
    // `markQuoteViewed` flips this row to `skipped` via the same idempotency
    // key when the client opens the page, so a viewed quote never pings.
    const reminderDays = await settingsRegistry.get("quote.reminder_days");
    const reminderAt = Date.now() + reminderDays * 24 * 60 * 60 * 1000;
    if (!row.expires_at_ms || reminderAt < row.expires_at_ms) {
      await enqueueTask({
        task_type: "quote_reminder_3d",
        runAt: reminderAt,
        payload: { quote_id: input.quote_id },
        idempotencyKey: `quote_reminder_3d:${input.quote_id}`,
      });
    }

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

"use server";

import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals, DEAL_STAGES, type DealStage } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { quotes } from "@/lib/db/schema/quotes";
import { logActivity } from "@/lib/activity-log";
import { resendPortalLink } from "@/lib/onboarding/create-credentials";

type ActionResult = { ok: true } | { ok: false; error: string };

async function adminActorTag(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return `user:${session.user.id ?? "admin"}`;
}

export async function updateDealAction(
  dealId: string,
  fields: {
    title?: string;
    value_cents?: number | null;
    next_action_text?: string | null;
    stage?: DealStage;
  },
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [deal] = db.select({ id: deals.id }).from(deals).where(eq(deals.id, dealId)).limit(1).all();
  if (!deal) return { ok: false, error: "Deal not found." };

  const update: Record<string, unknown> = { updated_at_ms: Date.now() };
  if (fields.title !== undefined) {
    const t = fields.title.trim();
    if (!t) return { ok: false, error: "Title cannot be empty." };
    update.title = t;
  }
  if (fields.value_cents !== undefined) update.value_cents = fields.value_cents;
  if (fields.next_action_text !== undefined) update.next_action_text = fields.next_action_text;
  if (fields.stage !== undefined) {
    if (!DEAL_STAGES.includes(fields.stage)) return { ok: false, error: "Unknown stage." };
    update.stage = fields.stage;
    update.last_stage_change_at_ms = Date.now();
  }

  db.update(deals).set(update).where(eq(deals.id, dealId)).run();

  void logActivity({
    kind: "deal_updated",
    body: `Updated deal ${dealId}`,
    createdBy: by,
    meta: { deal_id: dealId, fields: Object.keys(fields) },
  });

  revalidatePath("/lite/admin/pipeline");
  revalidatePath(`/lite/admin/pipeline/${dealId}`);
  return { ok: true };
}

export async function updateContactAction(
  contactId: string,
  fields: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  },
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [contact] = db.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId)).limit(1).all();
  if (!contact) return { ok: false, error: "Contact not found." };

  const update: Record<string, unknown> = {};
  if (fields.name !== undefined) {
    const n = fields.name.trim();
    if (!n) return { ok: false, error: "Name cannot be empty." };
    update.name = n;
  }
  if (fields.email !== undefined) update.email = fields.email?.trim() || null;
  if (fields.phone !== undefined) update.phone = fields.phone?.trim() || null;
  if (fields.role !== undefined) update.role = fields.role?.trim() || null;

  db.update(contacts).set(update).where(eq(contacts.id, contactId)).run();

  revalidatePath("/lite/admin/pipeline");
  return { ok: true };
}

export async function updateCompanyAction(
  companyId: string,
  fields: { name?: string },
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  if (fields.name !== undefined) {
    const n = fields.name.trim();
    if (!n) return { ok: false, error: "Company name cannot be empty." };
    db.update(companies).set({ name: n }).where(eq(companies.id, companyId)).run();
  }

  revalidatePath("/lite/admin/pipeline");
  return { ok: true };
}

export async function deleteDealAction(dealId: string): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [deal] = db.select({ id: deals.id }).from(deals).where(eq(deals.id, dealId)).limit(1).all();
  if (!deal) return { ok: false, error: "Deal not found." };

  try {
    const { auditSubmissions } = await import("@/lib/db/schema/audit-submissions");
    const { outreachSequences } = await import("@/lib/db/schema/outreach-sequences");
    await db.update(auditSubmissions).set({ deal_id: null }).where(eq(auditSubmissions.deal_id, dealId));
    await db.delete(outreachSequences).where(eq(outreachSequences.deal_id, dealId));
    await db.delete(deals).where(eq(deals.id, dealId));
  } catch (err) {
    console.error("[deleteDeal] Failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed — this deal may have linked records that couldn't be removed." };
  }

  void logActivity({
    kind: "deal_deleted",
    body: `Deleted deal ${dealId}`,
    createdBy: by,
    meta: { deal_id: dealId },
  });

  revalidatePath("/lite/admin/pipeline");
  return { ok: true };
}

export async function resendPortalLinkAction(
  contactId: string,
  companyId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const result = await resendPortalLink({ contactId, companyId });
  if (!result.ok) {
    const messages: Record<string, string> = {
      contact_not_found: "Contact not found.",
      email_missing: "Contact has no email address.",
    };
    return { ok: false, error: messages[result.reason] ?? "Failed." };
  }
  return { ok: true };
}

// ── Quote actions ─────────────────────────────────────────────────────────

export async function getQuotesForDealAction(dealId: string) {
  const by = await adminActorTag();
  if (!by) return [];

  return db
    .select()
    .from(quotes)
    .where(eq(quotes.deal_id, dealId))
    .orderBy(desc(quotes.created_at_ms));
}

export async function createQuoteAction(
  dealId: string,
  companyId: string,
): Promise<{ ok: true; quoteId: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const { createDraftQuote } = await import("@/lib/quote-builder/draft");

  try {
    const row = await createDraftQuote({
      deal_id: dealId,
      company_id: companyId,
      user_id: session.user.id!,
    });

    void logActivity({
      kind: "quote_drafted",
      body: `Created draft quote ${row.quote_number} for deal ${dealId}`,
      createdBy: `user:${session.user.id}`,
      meta: { deal_id: dealId, quote_id: row.id },
    });

    revalidatePath(`/lite/admin/pipeline/${dealId}`);
    return { ok: true, quoteId: row.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create quote.",
    };
  }
}

export async function deleteQuoteAction(
  quoteId: string,
  dealId: string,
): Promise<ActionResult> {
  const by = await adminActorTag();
  if (!by) return { ok: false, error: "Not authorised." };

  const [quote] = db
    .select({ id: quotes.id, status: quotes.status, quote_number: quotes.quote_number })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1)
    .all();
  if (!quote) return { ok: false, error: "Quote not found." };

  if (quote.status === "accepted") {
    return { ok: false, error: "Cannot delete an accepted quote." };
  }

  db.delete(quotes).where(eq(quotes.id, quoteId)).run();

  void logActivity({
    kind: "quote_deleted",
    body: `Deleted quote ${quote.quote_number}`,
    createdBy: by,
    meta: { deal_id: dealId, quote_id: quoteId },
  });

  revalidatePath(`/lite/admin/pipeline/${dealId}`);
  return { ok: true };
}

export async function sendQuoteAction(
  quoteId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const { transitionQuoteStatus } = await import(
    "@/lib/quote-builder/transitions"
  );
  const { composeQuoteSendEmail } = await import(
    "@/lib/quote-builder/compose-send-email"
  );

  try {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .limit(1);
    if (!quote) return { ok: false, error: "Quote not found." };

    if (quote.status !== "draft") {
      return { ok: false, error: `Quote is already ${quote.status}.` };
    }

    await transitionQuoteStatus({
      quote_id: quoteId,
      from: "draft",
      to: "sent",
      patch: { sent_at_ms: Date.now() },
    });

    try {
      await composeQuoteSendEmail({ quote_id: quoteId });
    } catch (emailErr) {
      console.error("[quote-send] Email failed:", emailErr);
    }

    void logActivity({
      kind: "quote_sent",
      body: `Sent quote ${quote.quote_number}`,
      createdBy: `user:${session.user.id}`,
      meta: { quote_id: quoteId },
    });

    revalidatePath(`/lite/admin/pipeline/${quote.deal_id}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send quote.",
    };
  }
}

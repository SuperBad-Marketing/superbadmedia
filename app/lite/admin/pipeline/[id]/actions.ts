"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals, DEAL_STAGES, type DealStage } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { logActivity } from "@/lib/activity-log";
import { createOnboardingCredentials } from "@/lib/onboarding/create-credentials";

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

  db.delete(deals).where(eq(deals.id, dealId)).run();

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

  const result = await createOnboardingCredentials({ contactId, companyId });
  if (!result.ok) {
    const messages: Record<string, string> = {
      contact_not_found: "Contact not found.",
      email_missing: "Contact has no email address.",
      already_verified: "Already verified — they can log in with their existing link.",
    };
    return { ok: false, error: messages[result.reason] ?? "Failed." };
  }
  return { ok: true };
}

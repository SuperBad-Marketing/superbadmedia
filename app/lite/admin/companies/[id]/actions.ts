"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { trial_shoot_notes } from "@/lib/db/schema/trial-shoot-notes";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { logActivity } from "@/lib/activity-log";
import {
  advanceTrialShootStatus,
  updateTrialShootPlan,
  type TrialShootStatus,
} from "@/lib/crm";

import type {
  InfraEmailListValue,
  InfraAdExperienceValue,
  InfraLeadMagnetValue,
  InfraWebsiteStatusValue,
  InfraSocialCadenceValue,
} from "@/lib/db/schema/trial-shoot-notes";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string };

// ── Shoot-day notes ────────────────────────────────────────────────────

export interface SaveShootDayNotesInput {
  dealId: string;
  infraEmailList: InfraEmailListValue | null;
  infraEmailListNote: string | null;
  infraAdExperience: InfraAdExperienceValue | null;
  infraAdExperienceNote: string | null;
  infraLeadMagnet: InfraLeadMagnetValue | null;
  infraLeadMagnetNote: string | null;
  infraWebsiteStatus: InfraWebsiteStatusValue | null;
  infraWebsiteCms: string | null;
  infraSocialCadence: InfraSocialCadenceValue | null;
  infraSocialPrimaryPlatform: string | null;
  infraCompetitors: string | null;
  goals: Array<{ priority: number; text: string }>;
  signalEnergy: number | null;
  signalFluency: number | null;
  signalIcpClarity: number | null;
  signalConversionReady: number | null;
  observations: string | null;
}

export async function saveShootDayNotesAction(
  companyId: string,
  input: SaveShootDayNotesInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const nowMs = Date.now();
    const userId = session.user.id ?? "admin";
    const existing = await db.query.trial_shoot_notes.findFirst({
      where: eq(trial_shoot_notes.deal_id, input.dealId),
    });

    const data = {
      infra_email_list: input.infraEmailList,
      infra_email_list_note: input.infraEmailListNote,
      infra_ad_experience: input.infraAdExperience,
      infra_ad_experience_note: input.infraAdExperienceNote,
      infra_lead_magnet: input.infraLeadMagnet,
      infra_lead_magnet_note: input.infraLeadMagnetNote,
      infra_website_status: input.infraWebsiteStatus,
      infra_website_cms: input.infraWebsiteCms,
      infra_social_cadence: input.infraSocialCadence,
      infra_social_primary_platform: input.infraSocialPrimaryPlatform,
      infra_competitors: input.infraCompetitors,
      goals_json: input.goals,
      signal_energy: input.signalEnergy,
      signal_fluency: input.signalFluency,
      signal_icp_clarity: input.signalIcpClarity,
      signal_conversion_ready: input.signalConversionReady,
      observations: input.observations,
      filled_at_ms: nowMs,
      filled_by: userId,
      updated_at_ms: nowMs,
    };

    if (existing) {
      await db
        .update(trial_shoot_notes)
        .set(data)
        .where(eq(trial_shoot_notes.id, existing.id));
    } else {
      await db.insert(trial_shoot_notes).values({
        id: randomUUID(),
        deal_id: input.dealId,
        ...data,
        created_at_ms: nowMs,
      });
    }

    revalidatePath(`/lite/admin/companies/${companyId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed.",
    };
  }
}

// ── Generate six-week plan ─────────────────────────────────────────────

export async function generateSixWeekPlanAction(
  companyId: string,
  dealId: string,
): Promise<ActionResult<{ planId: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const deal = await db.query.deals.findFirst({
      where: eq(deals.id, dealId),
    });
    if (!deal) return { ok: false, error: "Deal not found." };

    const existingPlan = await db.query.six_week_plans.findFirst({
      where: eq(six_week_plans.deal_id, dealId),
      orderBy: (t, { desc }) => desc(t.created_at_ms),
    });

    if (
      existingPlan &&
      !["archived", "superseded"].includes(existingPlan.status)
    ) {
      return {
        ok: false,
        error: "An active plan already exists for this deal.",
      };
    }

    const nowMs = Date.now();
    const planId = randomUUID();

    await db.insert(six_week_plans).values({
      id: planId,
      deal_id: dealId,
      company_id: companyId,
      status: "generating",
      generation_version: existingPlan
        ? (existingPlan.generation_version ?? 0) + 1
        : 1,
      parent_plan_id: existingPlan?.id ?? null,
      regen_count: 0,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    });

    await enqueueTask({
      task_type: "six_week_plan_generate",
      runAt: nowMs,
      payload: { planId, dealId },
      idempotencyKey: `swp-gen-${planId}`,
    });

    await logActivity({
      kind: "six_week_plan_generation_started",
      companyId,
      dealId,
      createdBy: `user:${session.user.id ?? "admin"}`,
      body: "Six-week plan generation enqueued.",
      meta: { planId },
    });

    revalidatePath(`/lite/admin/companies/${companyId}`);
    return { ok: true, value: { planId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Generation failed.",
    };
  }
}

export async function advanceTrialShootStatusAction(
  companyId: string,
  toStatus: TrialShootStatus,
): Promise<ActionResult<{ status: TrialShootStatus }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const { company } = advanceTrialShootStatus(companyId, toStatus, {
      by: `user:${session.user.id ?? "admin"}`,
    });
    revalidatePath(`/lite/admin/companies/${companyId}`);
    return { ok: true, value: { status: company.trial_shoot_status } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Advance failed.",
    };
  }
}

export async function updateTrialShootPlanAction(
  companyId: string,
  plan: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    updateTrialShootPlan(companyId, plan, {
      by: `user:${session.user.id ?? "admin"}`,
    });
    revalidatePath(`/lite/admin/companies/${companyId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed.",
    };
  }
}

// ── Contact CRUD ──────────────────────────────────────────────────────

export interface ContactInput {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
}

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalisePhone(raw: string): string {
  return raw.replace(/[^+\d]/g, "");
}

export async function createContactAction(
  companyId: string,
  input: ContactInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };

  const nowMs = Date.now();
  const id = randomUUID();
  const existingContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.company_id, companyId));
  const isFirst = existingContacts.length === 0;

  await db.insert(contacts).values({
    id,
    company_id: companyId,
    name,
    role: input.role?.trim() || null,
    email: input.email?.trim() || null,
    email_normalised: input.email ? normaliseEmail(input.email) : null,
    phone: input.phone?.trim() || null,
    phone_normalised: input.phone ? normalisePhone(input.phone) : null,
    is_primary: isFirst,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  revalidatePath(`/lite/admin/companies/${companyId}`);
  return { ok: true, value: { id } };
}

export async function updateContactAction(
  companyId: string,
  contactId: string,
  input: ContactInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };

  await db
    .update(contacts)
    .set({
      name,
      role: input.role?.trim() || null,
      email: input.email?.trim() || null,
      email_normalised: input.email ? normaliseEmail(input.email) : null,
      phone: input.phone?.trim() || null,
      phone_normalised: input.phone ? normalisePhone(input.phone) : null,
      updated_at_ms: Date.now(),
    })
    .where(eq(contacts.id, contactId));

  revalidatePath(`/lite/admin/companies/${companyId}`);
  return { ok: true };
}

export async function deleteContactAction(
  companyId: string,
  contactId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const contact = await db
    .select({ is_primary: contacts.is_primary })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();
  if (!contact) return { ok: false, error: "Contact not found." };

  try {
    const { auditSubmissions } = await import("@/lib/db/schema/audit-submissions");
    await db.update(auditSubmissions).set({ contact_id: null }).where(eq(auditSubmissions.contact_id, contactId));
    await db.delete(contacts).where(eq(contacts.id, contactId));
  } catch {
    return { ok: false, error: "Delete failed — this contact may have linked records that couldn't be removed." };
  }

  if (contact.is_primary) {
    const remaining = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.company_id, companyId))
      .limit(1);
    if (remaining.length > 0) {
      await db
        .update(contacts)
        .set({ is_primary: true, updated_at_ms: Date.now() })
        .where(eq(contacts.id, remaining[0].id));
    }
  }

  revalidatePath(`/lite/admin/companies/${companyId}`);
  return { ok: true };
}

export async function deleteCompanyAction(
  companyId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const { companies } = await import("@/lib/db/schema/companies");
  const company = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  if (!company) return { ok: false, error: "Company not found." };

  try {
    const { auditSubmissions } = await import("@/lib/db/schema/audit-submissions");
    const { caseSnippets } = await import("@/lib/db/schema/case-snippets");
    await db.update(auditSubmissions).set({ company_id: null }).where(eq(auditSubmissions.company_id, companyId));
    await db.update(auditSubmissions).set({ contact_id: null }).where(
      eq(auditSubmissions.company_id, companyId),
    );
    await db.delete(caseSnippets).where(eq(caseSnippets.company_id, companyId));

    const companyContacts = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.company_id, companyId));
    for (const c of companyContacts) {
      await db.update(auditSubmissions).set({ contact_id: null }).where(eq(auditSubmissions.contact_id, c.id));
    }

    const companyDeals = await db
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.company_id, companyId));
    for (const d of companyDeals) {
      await db.update(auditSubmissions).set({ deal_id: null }).where(eq(auditSubmissions.deal_id, d.id));
    }

    await db.delete(companies).where(eq(companies.id, companyId));
  } catch {
    return { ok: false, error: "Delete failed — this company may have linked records that couldn't be removed." };
  }

  await logActivity({
    kind: "company_deleted",
    body: `Deleted company ${company.name}`,
    createdBy: `user:${session.user.id ?? "admin"}`,
    meta: { company_id: companyId },
  });

  revalidatePath("/lite/admin/companies");
  return { ok: true };
}

export async function setPrimaryContactAction(
  companyId: string,
  contactId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const nowMs = Date.now();
  await db
    .update(contacts)
    .set({ is_primary: false, updated_at_ms: nowMs })
    .where(eq(contacts.company_id, companyId));

  await db
    .update(contacts)
    .set({ is_primary: true, updated_at_ms: nowMs })
    .where(eq(contacts.id, contactId));

  revalidatePath(`/lite/admin/companies/${companyId}`);
  return { ok: true };
}

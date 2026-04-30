"use server";

import { eq, and, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { brand_dna_blends } from "@/lib/db/schema/brand-dna-blends";
import { brand_dna_invites } from "@/lib/db/schema/brand-dna-invites";
import { context_summaries } from "@/lib/db/schema/context-summaries";
import { portal_chat_messages } from "@/lib/db/schema/portal-chat-messages";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { deals } from "@/lib/db/schema/deals";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { logActivity } from "@/lib/activity-log";

type ResetResult = { ok: true; cleared: number } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user;
}

export async function resetBrandDnaAction(
  scope: "all_clients" | "company",
  companyId?: string,
): Promise<ResetResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorised." };

  const profileFilter =
    scope === "company" && companyId
      ? and(
          eq(brand_dna_profiles.company_id, companyId),
          eq(brand_dna_profiles.subject_type, "client"),
        )
      : eq(brand_dna_profiles.subject_type, "client");

  const profiles = await db
    .select({ id: brand_dna_profiles.id, company_id: brand_dna_profiles.company_id })
    .from(brand_dna_profiles)
    .where(profileFilter)
    .all();

  if (profiles.length === 0) return { ok: true, cleared: 0 };

  const profileIds = profiles.map((p) => p.id);

  await db.delete(brand_dna_answers).where(inArray(brand_dna_answers.profile_id, profileIds));
  await db.delete(brand_dna_profiles).where(inArray(brand_dna_profiles.id, profileIds));

  if (scope === "company" && companyId) {
    await db.delete(brand_dna_blends).where(eq(brand_dna_blends.company_id, companyId));
    await db.delete(brand_dna_invites).where(
      inArray(
        brand_dna_invites.contact_id,
        db
          .select({ id: contacts.id })
          .from(contacts)
          .where(eq(contacts.company_id, companyId)),
      ),
    );
  } else {
    const companyIds = [...new Set(profiles.map((p) => p.company_id).filter(Boolean))] as string[];
    if (companyIds.length > 0) {
      await db.delete(brand_dna_blends).where(inArray(brand_dna_blends.company_id, companyIds));
    }
  }

  await logActivity({
    kind: "brand_dna_reset",
    body: scope === "company"
      ? `Brand DNA reset for company ${companyId}`
      : `Brand DNA reset for all clients (${profiles.length} profiles)`,
    meta: { scope, company_id: companyId ?? null, profiles_cleared: profiles.length },
  });

  revalidatePath("/lite/admin/settings/data-management");
  revalidatePath("/lite/brand-dna");
  return { ok: true, cleared: profiles.length };
}

export async function resetClientContextAction(
  scope: "all" | "company",
  companyId?: string,
): Promise<ResetResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorised." };

  let contactIds: string[];

  if (scope === "company" && companyId) {
    const rows = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.company_id, companyId))
      .all();
    contactIds = rows.map((r) => r.id);
  } else {
    const rows = await db.select({ id: contacts.id }).from(contacts).all();
    contactIds = rows.map((r) => r.id);
  }

  if (contactIds.length === 0) return { ok: true, cleared: 0 };

  let cleared = 0;

  const contextRows = await db
    .delete(context_summaries)
    .where(inArray(context_summaries.contact_id, contactIds))
    .returning({ id: context_summaries.id });
  cleared += contextRows.length;

  const chatRows = await db
    .delete(portal_chat_messages)
    .where(inArray(portal_chat_messages.contact_id, contactIds))
    .returning({ id: portal_chat_messages.id });
  cleared += chatRows.length;

  await logActivity({
    kind: "client_context_reset",
    body: scope === "company"
      ? `Client context reset for company ${companyId}`
      : `Client context reset for all contacts (${cleared} rows)`,
    meta: { scope, company_id: companyId ?? null, rows_cleared: cleared },
  });

  revalidatePath("/lite/admin/settings/data-management");
  return { ok: true, cleared };
}

export async function listCompaniesForResetAction(): Promise<
  { id: string; name: string }[]
> {
  const user = await requireAdmin();
  if (!user) return [];

  return db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .orderBy(companies.name)
    .all();
}

export type CompanyListItem = {
  id: string;
  name: string;
  domain: string | null;
  contactCount: number;
  dealCount: number;
  postCount: number;
  hasContentEngine: boolean;
  createdAtMs: number;
};

export async function listCompaniesWithStatsAction(): Promise<CompanyListItem[]> {
  const user = await requireAdmin();
  if (!user) return [];

  const rows = await db
    .select({ id: companies.id, name: companies.name, domain: companies.domain, created_at_ms: companies.created_at_ms })
    .from(companies)
    .orderBy(companies.name)
    .all();

  const result: CompanyListItem[] = [];

  for (const row of rows) {
    const [contactRows, dealRows, postRows, ceRows] = await Promise.all([
      db.select({ c: sql<number>`count(*)` }).from(contacts).where(eq(contacts.company_id, row.id)),
      db.select({ c: sql<number>`count(*)` }).from(deals).where(eq(deals.company_id, row.id)),
      db.select({ c: sql<number>`count(*)` }).from(blogPosts).where(eq(blogPosts.company_id, row.id)),
      db.select({ c: sql<number>`count(*)` }).from(contentEngineConfig).where(eq(contentEngineConfig.company_id, row.id)),
    ]);

    result.push({
      id: row.id,
      name: row.name,
      domain: row.domain,
      contactCount: contactRows[0]?.c ?? 0,
      dealCount: dealRows[0]?.c ?? 0,
      postCount: postRows[0]?.c ?? 0,
      hasContentEngine: (ceRows[0]?.c ?? 0) > 0,
      createdAtMs: row.created_at_ms,
    });
  }

  return result;
}

export async function deleteCompanyAction(
  companyId: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorised." };

  if (!companyId) return { ok: false, error: "No company specified." };

  const company = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!company) return { ok: false, error: "Company not found." };

  await db.delete(contentTopics).where(eq(contentTopics.company_id, companyId));
  await db.delete(contentEngineConfig).where(eq(contentEngineConfig.company_id, companyId));

  const profileIds = (
    await db
      .select({ id: brand_dna_profiles.id })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.company_id, companyId))
  ).map((r) => r.id);

  if (profileIds.length > 0) {
    await db.delete(brand_dna_answers).where(inArray(brand_dna_answers.profile_id, profileIds));
    await db.delete(brand_dna_profiles).where(inArray(brand_dna_profiles.id, profileIds));
  }
  await db.delete(brand_dna_blends).where(eq(brand_dna_blends.company_id, companyId));

  await db.delete(companies).where(eq(companies.id, companyId));

  await logActivity({
    kind: "company_deleted",
    body: `Deleted company: ${company.name}`,
    meta: { company_id: companyId, company_name: company.name },
  });

  revalidatePath("/lite/admin/settings/data-management");
  revalidatePath("/lite/content");
  revalidatePath("/lite/admin/companies");
  return { ok: true, name: company.name };
}

/**
 * Shared company resolution for /lite/content/* pages.
 *
 * Reads `?company=<id>` from search params. Falls back to the first
 * company with a content engine config. Returns the full list of
 * configured companies so the context bar can render a picker.
 */
import { db } from "@/lib/db";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { companies as companiesTable } from "@/lib/db/schema/companies";
import { inArray } from "drizzle-orm";

export interface ContentCompanyContext {
  companies: Array<{ id: string; name: string }>;
  activeCompanyId: string | null;
  activeCompanyName: string | null;
}

export async function resolveContentCompany(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ContentCompanyContext> {
  const configs = await db
    .select({ company_id: contentEngineConfig.company_id })
    .from(contentEngineConfig);

  const configCompanyIds = configs.map((c) => c.company_id);

  if (configCompanyIds.length === 0) {
    return { companies: [], activeCompanyId: null, activeCompanyName: null };
  }

  const companies = await db
    .select({ id: companiesTable.id, name: companiesTable.name })
    .from(companiesTable)
    .where(inArray(companiesTable.id, configCompanyIds));

  const requestedId =
    typeof searchParams.company === "string" ? searchParams.company : undefined;

  const active =
    companies.find((c) => c.id === requestedId) ?? companies[0] ?? null;

  return {
    companies,
    activeCompanyId: active?.id ?? null,
    activeCompanyName: active?.name ?? null,
  };
}

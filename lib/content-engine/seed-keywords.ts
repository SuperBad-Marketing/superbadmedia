/**
 * Content Engine — seed keyword management (CE-10).
 *
 * Reads and mutates `content_engine_config.seed_keywords` (JSON array).
 * Seed keywords influence the weekly research pipeline (CE-2).
 *
 * Owner: CE-10. Consumer: Topics tab at /lite/content/topics.
 */
import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { logActivity } from "@/lib/activity-log";

/**
 * Get the current seed keywords for a company.
 */
export async function getSeedKeywords(
  companyId: string,
  deps: { db?: typeof defaultDb } = {},
): Promise<string[]> {
  const database = deps.db ?? defaultDb;

  const row = await database
    .select({ seed_keywords: contentEngineConfig.seed_keywords })
    .from(contentEngineConfig)
    .where(eq(contentEngineConfig.company_id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row?.seed_keywords) return [];
  return (row.seed_keywords as string[]) ?? [];
}

/**
 * Add a seed keyword. No-ops if already present (case-insensitive).
 */
export async function addSeedKeyword(
  companyId: string,
  keyword: string,
  deps: { db?: typeof defaultDb } = {},
): Promise<{ ok: true } | { ok: false; reason: "already_exists" | "no_config" }> {
  const database = deps.db ?? defaultDb;
  const normalised = keyword.trim().toLowerCase();

  const row = await database
    .select({
      id: contentEngineConfig.id,
      seed_keywords: contentEngineConfig.seed_keywords,
    })
    .from(contentEngineConfig)
    .where(eq(contentEngineConfig.company_id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return { ok: false, reason: "no_config" };

  const existing = (row.seed_keywords as string[] | null) ?? [];
  if (existing.some((k) => k.toLowerCase() === normalised)) {
    return { ok: false, reason: "already_exists" };
  }

  const updated = [...existing, normalised];
  await database
    .update(contentEngineConfig)
    .set({
      seed_keywords: updated as unknown as string,
      updated_at_ms: Date.now(),
    })
    .where(eq(contentEngineConfig.id, row.id));

  await logActivity({
    companyId,
    kind: "content_seed_keyword_added",
    body: `Seed keyword added: "${normalised}"`,
    meta: { keyword: normalised, total: updated.length },
  });

  return { ok: true };
}

/**
 * Remove a seed keyword. No-ops if not found (case-insensitive).
 */
export async function removeSeedKeyword(
  companyId: string,
  keyword: string,
  deps: { db?: typeof defaultDb } = {},
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "no_config" }> {
  const database = deps.db ?? defaultDb;
  const normalised = keyword.trim().toLowerCase();

  const row = await database
    .select({
      id: contentEngineConfig.id,
      seed_keywords: contentEngineConfig.seed_keywords,
    })
    .from(contentEngineConfig)
    .where(eq(contentEngineConfig.company_id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return { ok: false, reason: "no_config" };

  const existing = (row.seed_keywords as string[] | null) ?? [];
  const idx = existing.findIndex((k) => k.toLowerCase() === normalised);
  if (idx === -1) return { ok: false, reason: "not_found" };

  const updated = [...existing.slice(0, idx), ...existing.slice(idx + 1)];
  await database
    .update(contentEngineConfig)
    .set({
      seed_keywords: updated as unknown as string,
      updated_at_ms: Date.now(),
    })
    .where(eq(contentEngineConfig.id, row.id));

  await logActivity({
    companyId,
    kind: "content_seed_keyword_removed",
    body: `Seed keyword removed: "${normalised}"`,
    meta: { keyword: normalised, total: updated.length },
  });

  return { ok: true };
}

/**
 * `isBrandDnaCompleteForUser` — DB check for the NextAuth jwt callback.
 *
 * Returns true when the SuperBad-self Brand DNA profile exists with
 * `subject_type = 'superbad_self' AND is_current = true AND status = 'complete'`.
 *
 * Kill-switch gated: when `brand_dna_assessment_enabled` is false the query
 * is short-circuited (returns false). Non-Brand-DNA deployments pay no DB
 * cost in the auth hot path.
 *
 * The `superbad_self` profile is singular by design (one Andy). `userId` is
 * accepted to signal an authenticated caller, but does not filter the query
 * — the schema pins `subject_id = null` for superbad_self rows.
 *
 * Owner: BDA-4.
 */
import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";

// Matches the BDA-3 pattern (`generate-first-impression.ts`) — accept any
// Drizzle SQLite instance so tests can pass a schema-less in-memory DB.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export async function isBrandDnaCompleteForUser(
  userId: string,
  dbOverride?: AnyDb,
): Promise<boolean> {
  if (!killSwitches.brand_dna_assessment_enabled) return false;
  if (!userId) return false;

  const database: AnyDb = dbOverride ?? (defaultDb as unknown as AnyDb);

  const rows = await database
    .select({ id: brand_dna_profiles.id })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

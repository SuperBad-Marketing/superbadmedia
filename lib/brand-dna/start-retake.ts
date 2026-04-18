/**
 * Brand DNA — retake flow.
 *
 * Archives the current profile (is_current = false) and creates a fresh
 * profile at the next version number. The new profile starts in 'pending'
 * status — the client re-takes the full assessment from scratch.
 *
 * Per spec §3.4: retakes are full assessments. No pre-population, no anchoring.
 *
 * Owner: BDA-5.
 */

import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as globalDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { logActivity } from "@/lib/activity-log";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type StartRetakeResult = {
  newProfileId: string;
  previousVersion: number;
  newVersion: number;
};

/**
 * Start a retake for a contact (or superbad_self).
 *
 * Archives the current profile and creates a fresh one at version + 1.
 * Returns the new profile ID for redirect into the assessment flow.
 */
export async function startRetake(
  contactId: string | null,
  opts?: {
    subjectType?: "superbad_self" | "client";
    companyId?: string | null;
    displayName?: string | null;
    dbOverride?: AnyDb;
  },
): Promise<StartRetakeResult | null> {
  const database = (opts?.dbOverride ?? globalDb) as AnyDb;
  const subjectType = opts?.subjectType ?? "client";

  const currentRows = await database
    .select()
    .from(brand_dna_profiles)
    .where(
      contactId
        ? and(
            eq(brand_dna_profiles.contact_id, contactId),
            eq(brand_dna_profiles.is_current, true),
          )
        : and(
            eq(brand_dna_profiles.subject_type, "superbad_self"),
            eq(brand_dna_profiles.is_current, true),
          ),
    )
    .limit(1);

  const currentProfile = currentRows[0];
  if (!currentProfile || currentProfile.status !== "complete") {
    return null;
  }

  const now = Date.now();
  const newVersion = currentProfile.version + 1;
  const newId = randomUUID();

  await database
    .update(brand_dna_profiles)
    .set({ is_current: false, updated_at_ms: now })
    .where(eq(brand_dna_profiles.id, currentProfile.id));

  await database.insert(brand_dna_profiles).values({
    id: newId,
    subject_type: subjectType,
    subject_id: contactId,
    contact_id: contactId,
    company_id: opts?.companyId ?? currentProfile.company_id,
    subject_display_name:
      opts?.displayName ?? currentProfile.subject_display_name,
    version: newVersion,
    is_current: true,
    is_superbad_self: subjectType === "superbad_self",
    status: "pending",
    created_at_ms: now,
    updated_at_ms: now,
  });

  await logActivity({
    kind: "retake_started",
    body: `Brand DNA retake started (v${currentProfile.version} → v${newVersion})`,
    contactId,
    companyId: opts?.companyId ?? currentProfile.company_id ?? undefined,
  });

  return {
    newProfileId: newId,
    previousVersion: currentProfile.version,
    newVersion,
  };
}

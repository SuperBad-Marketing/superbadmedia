/**
 * Redeem a Brand DNA Assessment invite token.
 *
 * Validates the raw token against brand_dna_invites, marks it used, and
 * creates (or attaches to an existing) brand_dna_profiles row for the
 * contact so the assessment can begin.
 *
 * Validation steps:
 *   1. Hash the token and look up the matching brand_dna_invites row.
 *   2. Reject if not found.
 *   3. Reject if already used (used_at_ms is not null).
 *   4. Reject if expired (expires_at_ms < now).
 *   5. Mark used, create/attach profile, log activity.
 *
 * Returns null on any validation failure. Caller is responsible for
 * establishing the assessment session after a successful redeem.
 *
 * Owner: BDA-1. Consumer: BDA-2 (invite route handler).
 */
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db as globalDb } from "@/lib/db";
import { brand_dna_invites } from "@/lib/db/schema/brand-dna-invites";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { logActivity } from "@/lib/activity-log";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type RedeemedBrandDnaInvite = {
  /** The contact this invite was issued for. */
  contactId: string;
  /** ID of the brand_dna_profiles row (newly created or pre-existing). */
  profileId: string;
  /** True if a new profile row was created; false if pre-existing row was attached. */
  profileCreated: boolean;
};

export async function redeemBrandDnaInvite(
  rawToken: string,
  dbOverride?: AnyDb,
): Promise<RedeemedBrandDnaInvite | null> {
  const database = dbOverride ?? globalDb;
  const now = Date.now();

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const invite = await database
    .select()
    .from(brand_dna_invites)
    .where(eq(brand_dna_invites.token_hash, tokenHash))
    .get();

  if (!invite) return null;
  if (invite.used_at_ms !== null) return null; // already redeemed
  if (invite.expires_at_ms < now) return null; // expired

  // Mark invite as used.
  await database
    .update(brand_dna_invites)
    .set({ used_at_ms: now })
    .where(eq(brand_dna_invites.id, invite.id));

  // Check for a pre-existing in-progress or pending profile for this contact.
  const existingProfile = await database
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.contact_id, invite.contact_id))
    .get();

  let profileId: string;
  let profileCreated: boolean;

  if (existingProfile) {
    // Attach to the existing profile (e.g. invite sent mid-assessment).
    profileId = existingProfile.id;
    profileCreated = false;
  } else {
    // Create a new profile row for this contact.
    profileId = randomUUID();
    await database.insert(brand_dna_profiles).values({
      id: profileId,
      subject_type: "client",
      subject_id: invite.contact_id,
      contact_id: invite.contact_id,
      status: "pending",
      is_superbad_self: false,
      is_current: true,
      version: 1,
      created_at_ms: now,
      updated_at_ms: now,
    });
    profileCreated = true;
  }

  await logActivity({
    contactId: invite.contact_id,
    kind: "brand_dna_invite_redeemed",
    body: "Brand DNA invite redeemed",
    meta: { invite_id: invite.id, profile_id: profileId },
  });

  return {
    contactId: invite.contact_id,
    profileId,
    profileCreated,
  };
}

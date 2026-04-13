/**
 * Issue a Brand DNA Assessment invite token.
 *
 * Wraps issueMagicLink() (lib/portal/issue-magic-link.ts) with
 * issued_for = 'brand_dna_invite', then writes a brand_dna_invites row
 * with the same token hash for invite-specific lookup and metadata.
 *
 * The invite URL (from issueMagicLink) is the delivery vehicle. The
 * brand_dna_invites row is the authoritative record for invite status,
 * expiry, and redemption tracking. BDA-2 builds the route handler that
 * processes the URL and calls redeemBrandDnaInvite().
 *
 * Activity logged: brand_dna_invite_sent.
 *
 * Owner: BDA-1.
 */
import { createHash, randomUUID } from "node:crypto";
import { db as globalDb } from "@/lib/db";
import { brand_dna_invites } from "@/lib/db/schema/brand-dna-invites";
import { issueMagicLink } from "@/lib/portal/issue-magic-link";
import { logActivity } from "@/lib/activity-log";
import settings from "@/lib/settings";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type IssueBrandDnaInviteInput = {
  /** The contact row id the invite is for. */
  contactId: string;
  /** The admin user id issuing the invite (Andy). */
  issuedByUserId: string;
};

export type IssueBrandDnaInviteResult = {
  /** Full invite URL containing the raw token, e.g. /lite/portal/r/<token>. */
  url: string;
  /** ID of the created brand_dna_invites row. */
  inviteId: string;
};

export async function issueBrandDnaInvite(
  input: IssueBrandDnaInviteInput,
  dbOverride?: AnyDb,
): Promise<IssueBrandDnaInviteResult> {
  const database = dbOverride ?? globalDb;
  const now = Date.now();

  // Delegate token generation + portal_magic_links row to issueMagicLink.
  const { url, rawToken } = await issueMagicLink(
    {
      contactId: input.contactId,
      issuedFor: "brand_dna_invite",
    },
    database,
  );

  // Hash the raw token to match portal_magic_links.ott_hash for lookups.
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  // Compute expiry using the same TTL setting as the underlying portal link.
  const ttlHours = await settings.get("portal.magic_link_ttl_hours");
  const expiresAtMs = now + ttlHours * 60 * 60 * 1000;

  const inviteId = randomUUID();

  await database.insert(brand_dna_invites).values({
    id: inviteId,
    contact_id: input.contactId,
    token_hash: tokenHash,
    created_by: input.issuedByUserId,
    expires_at_ms: expiresAtMs,
    used_at_ms: null,
    created_at_ms: now,
  });

  await logActivity({
    contactId: input.contactId,
    kind: "brand_dna_invite_sent",
    body: "Brand DNA invite issued",
    meta: { invite_id: inviteId, issued_by: input.issuedByUserId },
    createdBy: input.issuedByUserId,
  });

  return { url, inviteId };
}

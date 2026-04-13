/**
 * Redeem a one-time portal magic-link token.
 *
 * Validates the raw token against the `portal_magic_links` table:
 *   1. Hash the token and look up the matching row.
 *   2. Reject if already consumed (`consumed_at_ms` is not null).
 *   3. Reject if past the TTL (`expires_at_ms < now`).
 *   4. Mark consumed and return the session data.
 *
 * Returns null on any failure (not-found, consumed, expired). The caller
 * is responsible for issuing the session cookie after a successful redeem.
 *
 * Owner: A8. Consumers: app/lite/portal/r/[token]/route.ts.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db as globalDb } from "@/lib/db";
import { portal_magic_links } from "@/lib/db/schema/portal-magic-links";
import { logActivity } from "@/lib/activity-log";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type RedeemedPortalSession = {
  contactId: string;
  clientId: string | null;
  submissionId: string | null;
};

export async function redeemMagicLink(
  rawToken: string,
  dbOverride?: AnyDb,
): Promise<RedeemedPortalSession | null> {
  const database = dbOverride ?? globalDb;

  const ottHash = createHash("sha256").update(rawToken).digest("hex");

  const link = await database
    .select()
    .from(portal_magic_links)
    .where(eq(portal_magic_links.ott_hash, ottHash))
    .get();

  if (!link) return null;
  if (link.consumed_at_ms !== null) return null; // already redeemed
  if (link.expires_at_ms < Date.now()) return null; // expired

  await database
    .update(portal_magic_links)
    .set({ consumed_at_ms: Date.now() })
    .where(eq(portal_magic_links.id, link.id));

  await logActivity({
    contactId: link.contact_id,
    kind: "portal_magic_link_redeemed",
    body: "Magic link redeemed",
    meta: {
      submission_id: link.submission_id,
      client_id: link.client_id,
      issued_for: link.issued_for,
    },
  });

  return {
    contactId: link.contact_id,
    clientId: link.client_id,
    submissionId: link.submission_id,
  };
}

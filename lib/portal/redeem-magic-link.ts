/**
 * Redeem a magic-link OTT (one-time token).
 *
 * Called by `app/lite/portal/r/[token]/route.ts` when a recipient clicks
 * their portal link. Validates:
 *   1. The SHA-256 hash matches a row in `portal_magic_links`.
 *   2. The token has not already been consumed (single-use).
 *   3. The token has not expired (`issued_at_ms + ttl_hours * 3600000`).
 *
 * On success: marks the row consumed, logs the activity, and returns the
 * `contactId` so the route handler can issue a portal session cookie.
 *
 * Owner: A8. Consumers: `app/lite/portal/r/[token]/route.ts`.
 *
 * @module
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db } from "@/lib/db";
import { portal_magic_links } from "@/lib/db/schema/portal-magic-links";
import { activity_log } from "@/lib/db/schema/activity-log";

// Matches the pattern established in A7 (lib/channels/email/can-send-to.ts):
// Tests create drizzle(sqlite) without a schema argument; production db has
// the full schema. Using Record<string,unknown> accepts both.
type AnyDrizzle = BetterSQLite3Database<Record<string, unknown>>;

export type RedeemMagicLinkResult =
  | { success: true; contactId: string }
  | { success: false; reason: "not_found" | "expired" | "already_consumed" };

/**
 * Redeem a magic-link token.
 *
 * @param rawToken   - The raw URL-safe base64 token from the URL path.
 * @param clientIp   - Optional request IP for audit trail.
 * @param dbOverride - Optional DB override for testing.
 */
export async function redeemMagicLink(
  rawToken: string,
  clientIp?: string,
  dbOverride?: AnyDrizzle,
): Promise<RedeemMagicLinkResult> {
  const database = (dbOverride ?? db) as AnyDrizzle;

  // Hash the provided token for DB lookup
  const ottHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const rows = await database
    .select()
    .from(portal_magic_links)
    .where(eq(portal_magic_links.ott_hash, ottHash))
    .limit(1);

  if (rows.length === 0) {
    return { success: false, reason: "not_found" };
  }

  const row = rows[0];

  if (row.consumed_at_ms !== null) {
    return { success: false, reason: "already_consumed" };
  }

  const expiresAt = row.issued_at_ms + row.ttl_hours * 60 * 60 * 1000;
  if (Date.now() > expiresAt) {
    return { success: false, reason: "expired" };
  }

  const now = Date.now();

  // Mark consumed
  await database
    .update(portal_magic_links)
    .set({
      consumed_at_ms: now,
      consumed_from_ip: clientIp ?? null,
    })
    .where(eq(portal_magic_links.id, row.id));

  // Log activity using same DB instance so tests stay isolated
  await database.insert(activity_log).values({
    id: crypto.randomUUID(),
    kind: "portal_magic_link_redeemed",
    contact_id: row.contact_id,
    company_id: null,
    deal_id: null,
    body: `Magic link redeemed (${row.issued_for})`,
    meta: JSON.stringify({
      issued_for: row.issued_for,
      submission_id: row.submission_id,
      time_to_consume_hours: Math.round(
        (now - row.issued_at_ms) / (60 * 60 * 1000),
      ),
    }),
    created_at_ms: now,
    created_by: null,
  });

  return { success: true, contactId: row.contact_id };
}

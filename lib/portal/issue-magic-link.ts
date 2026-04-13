/**
 * Issue a one-time portal access token (magic link).
 *
 * Generates a 32-byte cryptographically random token, stores its SHA-256
 * hash in `portal_magic_links`, and returns the full redemption URL.
 *
 * The raw token is NEVER stored — only the SHA-256 hex. Send the URL to the
 * recipient via `sendEmail()` in the calling layer; this helper is
 * transport-agnostic.
 *
 * Settings consumed:
 *   - `portal.magic_link_ttl_hours` (default 168)
 *
 * Activity logged:
 *   - `portal_magic_link_sent` on every successful issue.
 *
 * Owner: A8. Consumers: every email that embeds a portal return link.
 *
 * @module
 */
import crypto from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db } from "@/lib/db";
import { portal_magic_links } from "@/lib/db/schema/portal-magic-links";
import type { PortalMagicLinkIssuedFor } from "@/lib/db/schema/portal-magic-links";
import { activity_log } from "@/lib/db/schema/activity-log";
import settings from "@/lib/settings";

// Matches the pattern established in A7 (lib/channels/email/can-send-to.ts):
// Tests create drizzle(sqlite) without a schema argument; production db has
// the full schema. Using Record<string,unknown> accepts both.
type AnyDrizzle = BetterSQLite3Database<Record<string, unknown>>;

export interface IssueMagicLinkParams {
  /** The contact who will receive this link. Always required. */
  contactId: string;
  /** Intro Funnel submission context — null for retainer/CM portal. */
  submissionId?: string | null;
  /** Client row context — set for retainer-side CM portal. */
  clientId?: string | null;
  /** Where in the journey this link is being issued from. */
  issuedFor: PortalMagicLinkIssuedFor;
  /** Optional DB override for testing */
  dbOverride?: AnyDrizzle;
}

export interface IssueMagicLinkResult {
  /** Full redemption URL — embed directly in email body. */
  url: string;
  /** SHA-256 hex hash of the OTT (stored in DB). For logging/audit only. */
  ottHash: string;
}

/**
 * Issue a magic link for a contact.
 *
 * @returns The redemption URL + stored hash.
 * @throws  If DB insert fails. Caller handles the error.
 */
export async function issueMagicLink(
  params: IssueMagicLinkParams,
): Promise<IssueMagicLinkResult> {
  const {
    contactId,
    submissionId = null,
    clientId = null,
    issuedFor,
    dbOverride,
  } = params;

  const database = (dbOverride ?? db) as AnyDrizzle;

  // Read TTL from settings (hours)
  const ttlHours = await settings.get("portal.magic_link_ttl_hours");

  // Generate 32-byte random token, URL-safe base64 encoded
  const rawToken = crypto.randomBytes(32).toString("base64url");

  // SHA-256 hash for DB storage (raw token never persisted)
  const ottHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const now = Date.now();

  await database.insert(portal_magic_links).values({
    id: crypto.randomUUID(),
    submission_id: submissionId,
    client_id: clientId,
    contact_id: contactId,
    ott_hash: ottHash,
    issued_for: issuedFor,
    issued_at_ms: now,
    ttl_hours: ttlHours,
    consumed_at_ms: null,
    consumed_from_ip: null,
    created_at_ms: now,
  });

  // Log activity using same DB instance so tests stay isolated
  await database.insert(activity_log).values({
    id: crypto.randomUUID(),
    kind: "portal_magic_link_sent",
    contact_id: contactId,
    company_id: null,
    deal_id: null,
    body: `Magic link issued (${issuedFor})`,
    meta: JSON.stringify({ issued_for: issuedFor, submission_id: submissionId }),
    created_at_ms: now,
    created_by: null,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const url = `${appUrl}/lite/portal/r/${rawToken}`;

  return { url, ottHash };
}

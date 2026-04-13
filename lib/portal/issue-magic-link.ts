/**
 * Issue a one-time portal magic-link token.
 *
 * Writes a hashed OTT row to `portal_magic_links`, logs the activity, and
 * returns the raw token embedded in the portal URL. Only the SHA-256 hash
 * is persisted; the raw token exists only in the returned value (and in the
 * email body the caller embeds it in).
 *
 * TTL: `settings.get('portal.magic_link_ttl_hours')` (default 168 h / 7 d).
 *
 * Owner: A8. Consumers: IF-4 (journey emails), A8 recovery form, CM-3.
 */
import { randomBytes, createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { db as globalDb } from "@/lib/db";
import { portal_magic_links } from "@/lib/db/schema/portal-magic-links";
import settings from "@/lib/settings";
import { logActivity } from "@/lib/activity-log";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type IssueMagicLinkInput = {
  /** The contact row id this link is issued for. */
  contactId: string;
  /** Non-null for Client Management portal links; null for Intro Funnel. */
  clientId?: string | null;
  /** Scopes the link to an intro-funnel submission row; nullable. */
  submissionId?: string | null;
  /** Human-readable description e.g. "portal_access", "journey_beat". */
  issuedFor?: string;
};

export type IssueMagicLinkResult = {
  /** Full portal URL containing the raw token, e.g. /lite/portal/r/<token>. */
  url: string;
  /** Raw 32-byte URL-safe-base64 token. Embed in the email body. */
  rawToken: string;
};

export async function issueMagicLink(
  input: IssueMagicLinkInput,
  dbOverride?: AnyDb,
): Promise<IssueMagicLinkResult> {
  const database = dbOverride ?? globalDb;

  const ttlHours = await settings.get("portal.magic_link_ttl_hours");
  const now = Date.now();
  const rawToken = randomBytes(32).toString("base64url");
  const ottHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAtMs = now + ttlHours * 60 * 60 * 1000;

  await database.insert(portal_magic_links).values({
    id: randomUUID(),
    contact_id: input.contactId,
    client_id: input.clientId ?? null,
    submission_id: input.submissionId ?? null,
    ott_hash: ottHash,
    issued_for: input.issuedFor ?? "portal_access",
    expires_at_ms: expiresAtMs,
    consumed_at_ms: null,
    created_at_ms: now,
  });

  await logActivity({
    contactId: input.contactId,
    kind: "portal_magic_link_sent",
    body: `Magic link issued for ${input.issuedFor ?? "portal_access"}`,
    meta: {
      submission_id: input.submissionId ?? null,
      client_id: input.clientId ?? null,
    },
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const url = `${baseUrl}/lite/portal/r/${rawToken}`;

  return { url, rawToken };
}

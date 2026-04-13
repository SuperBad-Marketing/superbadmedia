import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * One-time tokens for portal session recovery and journey-beat email
 * entry links. Both Intro Funnel (/lite/intro/[token]/*) and Client
 * Management (/portal/[token]/*) reuse this table.
 *
 * Column semantics (per Intro Funnel §10.1, generalised in A8):
 *   - `contact_id`   — who the link is for (always required).
 *   - `client_id`    — non-null for Client Management reuse; null for Intro Funnel.
 *   - `submission_id`— scopes the link to an intro-funnel submission row;
 *                      null when issued for admin-recovery or CM portal links.
 *   - `ott_hash`     — SHA-256 of the raw 32-byte URL-safe-base64 token.
 *                      Only the hash is stored; the raw token only ever lives
 *                      in the email body.
 *   - `issued_for`   — human-readable label e.g. "portal_access",
 *                      "journey_beat_email_footer".
 *   - `expires_at_ms`— absolute expiry epoch-ms; default TTL is 168 h (7 days)
 *                      from `settings.get('portal.magic_link_ttl_hours')`.
 *   - `consumed_at_ms` — null until the token is redeemed; subsequent
 *                        redemption attempts are rejected.
 *
 * Owner: A8. Consumers: IF-4 (journey emails), CM-3 (portal shell), A8
 * recovery form.
 */
export const portal_magic_links = sqliteTable(
  "portal_magic_links",
  {
    id: text("id").primaryKey(),
    contact_id: text("contact_id").notNull(),
    client_id: text("client_id"),
    submission_id: text("submission_id"),
    ott_hash: text("ott_hash").notNull().unique(),
    issued_for: text("issued_for").notNull().default("portal_access"),
    expires_at_ms: integer("expires_at_ms").notNull(),
    consumed_at_ms: integer("consumed_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_ott_hash: index("portal_magic_links_ott_hash_idx").on(t.ott_hash),
    by_contact: index("portal_magic_links_contact_idx").on(
      t.contact_id,
      t.created_at_ms,
    ),
  }),
);

export type PortalMagicLinkRow = typeof portal_magic_links.$inferSelect;
export type PortalMagicLinkInsert = typeof portal_magic_links.$inferInsert;

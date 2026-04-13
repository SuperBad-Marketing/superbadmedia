import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * One-time portal access tokens (OTTs).
 *
 * Every client-facing email from SuperBad Lite embeds a fresh OTT that lets
 * the recipient reopen their portal without a password. The token is SHA-256
 * hashed at rest; the raw token only ever appears in the email body.
 *
 * `submission_id` is nullable so Client Management can reuse this table for
 * retainer-side portal access (client_id present, submission_id absent).
 *
 * Spec: intro-funnel.md §10.1 + client-management.md §10.1 (generalised at A8).
 * Owner: A8. Consumers: IF-{2..N}, CM-1+, portal r/[token] redeem route.
 */
export const PORTAL_MAGIC_LINK_ISSUED_FOR = [
  "journey_email",
  "recovery_form",
  "section_1",
] as const;

export type PortalMagicLinkIssuedFor =
  (typeof PORTAL_MAGIC_LINK_ISSUED_FOR)[number];

export const portal_magic_links = sqliteTable(
  "portal_magic_links",
  {
    id: text("id").primaryKey(),
    /** FK → intro_funnel_submissions — deferred until IF-1 */
    submission_id: text("submission_id"),
    /** FK → clients — deferred until CM-1 */
    client_id: text("client_id"),
    /** FK → contacts — deferred until SP-1 (contacts table) */
    contact_id: text("contact_id").notNull(),
    /** SHA-256 hex of the raw 32-byte URL-safe base64 token */
    ott_hash: text("ott_hash").notNull().unique(),
    issued_for: text("issued_for", {
      enum: PORTAL_MAGIC_LINK_ISSUED_FOR,
    }).notNull(),
    issued_at_ms: integer("issued_at_ms").notNull(),
    /** Default 168 = 7 days. Overridable per issued_for if needed. */
    ttl_hours: integer("ttl_hours").notNull(),
    /** Set when redeemMagicLink() marks the token consumed */
    consumed_at_ms: integer("consumed_at_ms"),
    /** Light audit trail — IP from the redeem request */
    consumed_from_ip: text("consumed_from_ip"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_contact: index("portal_magic_links_contact_idx").on(
      t.contact_id,
      t.issued_at_ms,
    ),
  }),
);

export type PortalMagicLinkRow = typeof portal_magic_links.$inferSelect;
export type PortalMagicLinkInsert = typeof portal_magic_links.$inferInsert;

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Tokenised invite links for the Brand DNA Assessment.
 *
 * Andy generates a one-time invite link from a contact record. The invitee
 * clicks the link, gets a temporary session scoped to the assessment, and
 * results attach to that contact's brand_dna_profiles row.
 *
 * Invite tokens are issued via issueBrandDnaInvite() (lib/brand-dna/issue-invite.ts)
 * which wraps issueMagicLink() (lib/portal/issue-magic-link.ts) with
 * issued_for = 'brand_dna_invite'. The underlying portal_magic_links row
 * handles URL routing; this table stores invite-specific metadata and
 * the token hash for direct lookup during redemption.
 *
 * Owner: BDA-1. Consumer: BDA-2 (invite route handler).
 */
export const brand_dna_invites = sqliteTable(
  "brand_dna_invites",
  {
    id: text("id").primaryKey(),
    /** FK to contacts.id — who this invite is for. */
    contact_id: text("contact_id").notNull(),
    /**
     * SHA-256 hash of the raw 32-byte URL-safe-base64 token.
     * Only the hash is stored; the raw token lives in the invite URL only.
     * Matches portal_magic_links.ott_hash for the corresponding link row.
     */
    token_hash: text("token_hash").notNull().unique(),
    /** FK to users.id — the admin user (Andy) who issued the invite. */
    created_by: text("created_by").notNull(),
    /** UTC epoch ms when this invite expires. Derives from portal.magic_link_ttl_hours. */
    expires_at_ms: integer("expires_at_ms").notNull(),
    /**
     * UTC epoch ms when the invite was first redeemed.
     * Null until used. Set on redemption; subsequent attempts are rejected.
     */
    used_at_ms: integer("used_at_ms"),
    /** UTC epoch ms when the invite was created. */
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_contact: index("brand_dna_invites_contact_idx").on(
      t.contact_id,
      t.created_at_ms,
    ),
    by_token: index("brand_dna_invites_token_idx").on(t.token_hash),
  }),
);

export type BrandDnaInviteRow = typeof brand_dna_invites.$inferSelect;
export type BrandDnaInviteInsert = typeof brand_dna_invites.$inferInsert;

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * SB-6a: single-use login tokens for SaaS subscribers. Issued by the
 * `invoice.payment_succeeded` webhook on first successful cycle, and on
 * demand by the `/get-started/welcome` "send me my login" action.
 *
 * `token_hash` = SHA-256 of the raw 32-byte URL-safe-base64 token; the
 * raw token only ever appears in the email body. Redeem flips
 * `user.role` prospect→client on first success (see
 * `lib/auth/subscriber-magic-link.ts#redeemSubscriberMagicLink`).
 */
export const subscriber_magic_link_tokens = sqliteTable(
  "subscriber_magic_link_tokens",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id").notNull(),
    token_hash: text("token_hash").notNull().unique(),
    issued_for: text("issued_for").notNull().default("subscriber_login"),
    expires_at_ms: integer("expires_at_ms").notNull(),
    consumed_at_ms: integer("consumed_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_user: index("subscriber_magic_link_tokens_user_idx").on(
      t.user_id,
      t.created_at_ms,
    ),
    by_token_hash: index("subscriber_magic_link_tokens_token_hash_idx").on(
      t.token_hash,
    ),
  }),
);

export type SubscriberMagicLinkTokenRow =
  typeof subscriber_magic_link_tokens.$inferSelect;
export type SubscriberMagicLinkTokenInsert =
  typeof subscriber_magic_link_tokens.$inferInsert;

import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const DISCOUNT_TIERS = ["session", "production"] as const;
export type DiscountTier = (typeof DISCOUNT_TIERS)[number];

export const discountCodes = sqliteTable(
  "discount_codes",
  {
    id: text("id").primaryKey(),
    candidate_id: text("candidate_id").notNull(),
    code: text("code").notNull(),
    tier: text("tier", { enum: DISCOUNT_TIERS }).notNull(),
    original_price_cents: integer("original_price_cents").notNull(),
    expires_at_ms: integer("expires_at_ms").notNull(),
    redeemed_at_ms: integer("redeemed_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    unique_code: uniqueIndex("discount_codes_code_unique").on(t.code),
    by_candidate: index("discount_codes_candidate_idx").on(t.candidate_id),
    by_expiry: index("discount_codes_expiry_idx").on(t.expires_at_ms),
  }),
);

export type DiscountCodeRow = typeof discountCodes.$inferSelect;
export type DiscountCodeInsert = typeof discountCodes.$inferInsert;

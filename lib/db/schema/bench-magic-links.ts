import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const bench_magic_links = sqliteTable(
  "bench_magic_links",
  {
    id: text("id").primaryKey(),
    candidate_id: text("candidate_id").notNull(),
    ott_hash: text("ott_hash").notNull().unique(),
    issued_for: text("issued_for").notNull().default("bench_access"),
    expires_at_ms: integer("expires_at_ms").notNull(),
    consumed_at_ms: integer("consumed_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_ott_hash: index("bench_magic_links_ott_hash_idx").on(t.ott_hash),
    by_candidate: index("bench_magic_links_candidate_idx").on(
      t.candidate_id,
      t.created_at_ms,
    ),
  }),
);

export type BenchMagicLinkRow = typeof bench_magic_links.$inferSelect;
export type BenchMagicLinkInsert = typeof bench_magic_links.$inferInsert;

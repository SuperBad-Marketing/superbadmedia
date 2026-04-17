import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { blogPosts } from "./blog-posts";

/**
 * Content Engine — SEO ranking snapshot per published blog post (CE-1).
 * Weekly SerpAPI re-queries as default. Optional GSC data for medium+
 * tiers. Tracks position trends: entry, current, peak, direction.
 */
export const RANKING_SOURCES = ["serpapi", "gsc"] as const;
export type RankingSource = (typeof RANKING_SOURCES)[number];

export const rankingSnapshots = sqliteTable(
  "ranking_snapshots",
  {
    id: text("id").primaryKey(),
    blog_post_id: text("blog_post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    position: integer("position"),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    ctr: text("ctr"),
    source: text("source", { enum: RANKING_SOURCES }).notNull(),
    snapshot_date_ms: integer("snapshot_date_ms").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_post: index("ranking_snapshots_post_idx").on(t.blog_post_id),
    by_date: index("ranking_snapshots_date_idx").on(
      t.blog_post_id,
      t.snapshot_date_ms,
    ),
  }),
);

export type RankingSnapshotRow = typeof rankingSnapshots.$inferSelect;
export type RankingSnapshotInsert = typeof rankingSnapshots.$inferInsert;

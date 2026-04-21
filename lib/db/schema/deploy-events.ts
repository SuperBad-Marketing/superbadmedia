import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const DEPLOY_EVENT_STATUSES = [
  "deploying",
  "ready",
  "failed",
] as const;

export type DeployEventStatus = (typeof DEPLOY_EVENT_STATUSES)[number];

/**
 * Vercel deploy webhook target. Feeds the anomaly diagnoser's
 * "recent deploy" context for cost-spike root-cause analysis.
 * Schema per `docs/specs/cost-usage-observatory.md` §4.1.
 */
export const deploy_events = sqliteTable(
  "deploy_events",
  {
    id: text("id").primaryKey(),
    commit_sha: text("commit_sha").notNull(),
    deployed_at_ms: integer("deployed_at_ms").notNull(),
    status: text("status", { enum: DEPLOY_EVENT_STATUSES }).notNull(),
    preview_url: text("preview_url"),
  },
  (t) => ({
    by_deployed: index("deploy_events_deployed_idx").on(t.deployed_at_ms),
  }),
);

export type DeployEventRow = typeof deploy_events.$inferSelect;
export type DeployEventInsert = typeof deploy_events.$inferInsert;

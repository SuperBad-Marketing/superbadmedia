import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const ACTOR_TYPES = ["public", "admin", "customer"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const hidden_egg_fires = sqliteTable(
  "hidden_egg_fires",
  {
    id: text("id").primaryKey(),
    egg_id: text("egg_id").notNull(),
    actor_type: text("actor_type", { enum: ACTOR_TYPES }).notNull(),
    user_id: text("user_id").references(() => user.id, { onDelete: "set null" }),
    visitor_id: text("visitor_id"),
    fired_at_ms: integer("fired_at_ms").notNull(),
    trigger_evidence: text("trigger_evidence", { mode: "json" }).notNull(),
    session_id: text("session_id"),
    outcome: text("outcome"),
  },
  (t) => ({
    by_egg_user: index("hef_egg_user_idx").on(t.egg_id, t.user_id),
    by_egg_visitor: index("hef_egg_visitor_idx").on(t.egg_id, t.visitor_id),
    by_fired: index("hef_fired_idx").on(t.fired_at_ms),
  }),
);

export type HiddenEggFireRow = typeof hidden_egg_fires.$inferSelect;
export type HiddenEggFireInsert = typeof hidden_egg_fires.$inferInsert;

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const COCKPIT_BRIEF_SLOTS = ["morning", "midday", "evening"] as const;

export type CockpitBriefSlot = (typeof COCKPIT_BRIEF_SLOTS)[number];

export const COCKPIT_BRIEF_TRIGGERS = ["cron", "material_event"] as const;

export type CockpitBriefTrigger = (typeof COCKPIT_BRIEF_TRIGGERS)[number];

export const cockpit_briefs = sqliteTable(
  "cockpit_briefs",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id").notNull(),
    slot: text("slot", { enum: COCKPIT_BRIEF_SLOTS }).notNull(),
    brief_date: text("brief_date").notNull(),
    generated_at_ms: integer("generated_at_ms").notNull(),
    trigger: text("trigger", { enum: COCKPIT_BRIEF_TRIGGERS }).notNull(),
    trigger_event: text("trigger_event"),
    prose: text("prose").notNull(),
    signals_snapshot: text("signals_snapshot", { mode: "json" }).notNull(),
    model_version: text("model_version").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_user_date: index("cockpit_briefs_user_date_idx").on(
      t.user_id,
      t.brief_date,
    ),
    unique_slot: index("cockpit_briefs_unique_slot_idx").on(
      t.user_id,
      t.slot,
      t.brief_date,
    ),
  }),
);

export type CockpitBriefRow = typeof cockpit_briefs.$inferSelect;

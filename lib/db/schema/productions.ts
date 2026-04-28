import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { contacts } from "./contacts";

export const PRODUCTION_STATUSES = [
  "idea",
  "scheduled",
  "shot",
  "in_edit",
  "published",
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const PIPELINE_STATUSES = PRODUCTION_STATUSES.filter(
  (s) => s !== "idea",
);
export type PipelineStatus = Exclude<ProductionStatus, "idea">;

export const productions = sqliteTable(
  "productions",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    subject_name: text("subject_name"),
    subject_type: text("subject_type"),
    initial_thought: text("initial_thought"),
    status: text("status", { enum: PRODUCTION_STATUSES })
      .notNull()
      .default("idea"),

    // Auto-generated angles from LLM on capture
    generated_angles_json: text("generated_angles_json", { mode: "json" }),

    // Story fields (populated when promoted to pipeline)
    narrative_angle: text("narrative_angle"),
    key_moments_json: text("key_moments_json", { mode: "json" }),
    voiceover_hook: text("voiceover_hook"),
    shot_list_json: text("shot_list_json", { mode: "json" }),
    gear_notes: text("gear_notes"),
    release_checklist_json: text("release_checklist_json", { mode: "json" }),

    // Short-form clips tracking
    clips_json: text("clips_json", { mode: "json" }),

    // Logistics
    shoot_date: text("shoot_date"),
    location: text("location"),
    company_id: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    contact_id: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),

    // Publish info
    published_url: text("published_url"),
    thumbnail_url: text("thumbnail_url"),

    // Timestamps
    sort_order: integer("sort_order").notNull().default(0),
    promoted_at_ms: integer("promoted_at_ms"),
    published_at_ms: integer("published_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_status: index("prod_status_idx").on(t.status),
    by_created: index("prod_created_idx").on(t.created_at_ms),
    by_company: index("prod_company_idx").on(t.company_id),
    by_shoot: index("prod_shoot_idx").on(t.shoot_date),
  }),
);

export type ProductionRow = typeof productions.$inferSelect;
export type ProductionInsert = typeof productions.$inferInsert;

export const productionChatMessages = sqliteTable(
  "production_chat_messages",
  {
    id: text("id").primaryKey(),
    production_id: text("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] as const }).notNull(),
    content: text("content").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_production: index("pcm_production_idx").on(
      t.production_id,
      t.created_at_ms,
    ),
  }),
);

export type ProductionChatMessageRow =
  typeof productionChatMessages.$inferSelect;
export type ProductionChatMessageInsert =
  typeof productionChatMessages.$inferInsert;

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const PILLAR_SLUGS = [
  "agency_wont_say",
  "shooting_small_business",
  "marketing_doesnt_work",
  "uncomfortable_truth",
  "if_i_were_brand",
  "overheard_in_marketing",
] as const;
export type PillarSlug = (typeof PILLAR_SLUGS)[number];

export const SCRIPT_FORMATS = ["short", "mid"] as const;
export type ScriptFormat = (typeof SCRIPT_FORMATS)[number];

export const SCRIPT_STATUSES = [
  "generated",
  "approved",
  "skipped",
  "filmed",
  "published",
] as const;
export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];

export const PACK_STATUSES = [
  "draft",
  "ready",
  "filming",
  "completed",
] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

export const ENERGY_LEVELS = ["low_battery", "default", "feeling_it"] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

// ── Pillar definitions (code-level config, not DB rows) ──

export interface PillarDef {
  slug: PillarSlug;
  label: string;
  description: string;
  tone: string;
  purpose: "personality" | "authority" | "personality_authority";
}

export const PILLARS: readonly PillarDef[] = [
  {
    slug: "agency_wont_say",
    label: "Things your agency won't say",
    description:
      "Industry honesty. Why retainers work the way they do, what agencies actually spend your budget on.",
    tone: "Slightly confrontational, measured",
    purpose: "authority",
  },
  {
    slug: "shooting_small_business",
    label: "What I see shooting small business",
    description:
      "Observations from trial shoots and client work. Patterns only someone behind the camera notices.",
    tone: "Warm, observational",
    purpose: "personality_authority",
  },
  {
    slug: "marketing_doesnt_work",
    label: "Marketing that doesn't work",
    description:
      "Specific tactics that are widely recommended and mostly useless. Canva templates, posting three times a day.",
    tone: "Dry, slightly exasperated",
    purpose: "authority",
  },
  {
    slug: "uncomfortable_truth",
    label: "The uncomfortable truth about [X]",
    description:
      "Broader business realities. What marketing actually costs, why cheap photography is expensive.",
    tone: "Direct, occasionally spicy",
    purpose: "authority",
  },
  {
    slug: "if_i_were_brand",
    label: "If I were [brand]",
    description:
      "Unsolicited strategy breakdowns for aspirational clients. Full campaign concepts for real businesses.",
    tone: "Animated, conviction, leaning forward",
    purpose: "personality_authority",
  },
  {
    slug: "overheard_in_marketing",
    label: "Overheard in marketing",
    description:
      "Deadpan observations about the absurdity of the industry and business culture. Not advice — just noticing things.",
    tone: "Bone-dry, almost thrown away",
    purpose: "personality",
  },
] as const;

export function pillarBySlug(slug: PillarSlug): PillarDef {
  return PILLARS.find((p) => p.slug === slug)!;
}

// ── Session packs ──

export const talkingHeadSessionPacks = sqliteTable(
  "talking_head_session_packs",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: PACK_STATUSES }).notNull().default("draft"),
    energy_level: text("energy_level", { enum: ENERGY_LEVELS })
      .notNull()
      .default("default"),
    target_date: text("target_date"),
    script_count: integer("script_count").notNull().default(4),
    source_braindump_id: text("source_braindump_id"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_status: index("th_packs_status_idx").on(t.status, t.created_at_ms),
  }),
);

export type SessionPackRow = typeof talkingHeadSessionPacks.$inferSelect;
export type SessionPackInsert = typeof talkingHeadSessionPacks.$inferInsert;

// ── Scripts ──

export const talkingHeadScripts = sqliteTable(
  "talking_head_scripts",
  {
    id: text("id").primaryKey(),
    session_pack_id: text("session_pack_id").notNull(),
    pillar_slug: text("pillar_slug", { enum: PILLAR_SLUGS }).notNull(),
    format: text("format", { enum: SCRIPT_FORMATS }).notNull(),
    status: text("status", { enum: SCRIPT_STATUSES })
      .notNull()
      .default("generated"),
    title: text("title").notNull(),
    hook: text("hook").notNull(),
    estimated_duration_sec: integer("estimated_duration_sec").notNull(),
    script_json: text("script_json", { mode: "json" }).notNull(),
    edit_brief_json: text("edit_brief_json", { mode: "json" }),
    publish_meta_json: text("publish_meta_json", { mode: "json" }),
    energy_level: text("energy_level", { enum: ENERGY_LEVELS })
      .notNull()
      .default("default"),
    signal_source: text("signal_source"),
    source_braindump_id: text("source_braindump_id"),
    sort_order: integer("sort_order").notNull().default(0),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_pack: index("th_scripts_pack_idx").on(
      t.session_pack_id,
      t.sort_order,
    ),
    by_status: index("th_scripts_status_idx").on(t.status),
    by_braindump: index("th_scripts_braindump_idx").on(t.source_braindump_id),
  }),
);

export type ScriptRow = typeof talkingHeadScripts.$inferSelect;
export type ScriptInsert = typeof talkingHeadScripts.$inferInsert;

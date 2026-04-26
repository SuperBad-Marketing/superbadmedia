import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { briefs } from "./briefs";

export const STORYBOARD_STATUSES = [
  "generating",
  "ready",
  "failed",
] as const;
export type StoryboardStatus = (typeof STORYBOARD_STATUSES)[number];

export const SHOT_TYPES = [
  "wide",
  "medium",
  "close_up",
  "detail",
  "aerial",
  "pov",
] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

export const CAMERA_MOVEMENTS = [
  "static",
  "pan",
  "tilt",
  "track",
  "handheld",
  "crane",
  "drone",
] as const;
export type CameraMovement = (typeof CAMERA_MOVEMENTS)[number];

export interface StoryboardScene {
  number: number;
  description: string;
  shot_type: ShotType;
  camera_movement: CameraMovement;
  audio_notes: string;
  duration_seconds: number;
  mood_note: string;
}

export interface ShotlistGroup {
  group_number: number;
  location: string;
  setup_description: string;
  equipment_notes: string;
  estimated_minutes: number;
  scenes: {
    scene_number: number;
    shot_type: ShotType;
    description: string;
  }[];
}

export interface StoryboardChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp_ms: number;
  changes_summary?: string;
}

export const brief_storyboards = sqliteTable(
  "brief_storyboards",
  {
    id: text("id").primaryKey(),
    brief_id: text("brief_id")
      .notNull()
      .references(() => briefs.id, { onDelete: "cascade" }),
    status: text("status", { enum: STORYBOARD_STATUSES })
      .notNull()
      .default("generating"),
    scenes_json: text("scenes_json", { mode: "json" })
      .$type<StoryboardScene[]>(),
    shotlist_json: text("shotlist_json", { mode: "json" })
      .$type<ShotlistGroup[]>(),
    chat_history_json: text("chat_history_json", { mode: "json" })
      .$type<StoryboardChatMessage[]>()
      .default([]),
    error_message: text("error_message"),
    generated_at_ms: integer("generated_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    unique_brief: uniqueIndex("brief_storyboards_brief_idx").on(t.brief_id),
  }),
);

export type BriefStoryboardRow = typeof brief_storyboards.$inferSelect;
export type BriefStoryboardInsert = typeof brief_storyboards.$inferInsert;

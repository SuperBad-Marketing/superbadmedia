import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const CALENDAR_BOOKING_TYPES = [
  "intro_funnel_shoot",
  "followup_conversation",
  "marketing_site_booking",
] as const;
export type CalendarBookingType = (typeof CALENDAR_BOOKING_TYPES)[number];

export const calendar_bookings = sqliteTable(
  "calendar_bookings",
  {
    id: text("id").primaryKey(),
    booking_type: text("booking_type", {
      enum: CALENDAR_BOOKING_TYPES,
    }).notNull(),

    start_at_ms: integer("start_at_ms").notNull(),
    end_at_ms: integer("end_at_ms").notNull(),

    subject_ref_table: text("subject_ref_table").notNull(),
    subject_ref_id: text("subject_ref_id").notNull(),

    status: text("status", { enum: ["active", "cancelled"] })
      .notNull()
      .default("active"),
    metadata_json: text("metadata_json", { mode: "json" }),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_type_start: index("cb_type_start_idx").on(t.booking_type, t.start_at_ms),
    by_ref: index("cb_ref_idx").on(t.subject_ref_table, t.subject_ref_id),
  }),
);

export const calendar_config = sqliteTable("calendar_config", {
  id: text("id").primaryKey().default("singleton"),

  timezone: text("timezone").notNull().default("Australia/Melbourne"),
  business_hours_json: text("business_hours_json", { mode: "json" }).notNull(),
  blackout_dates_json: text("blackout_dates_json", { mode: "json" }),

  intro_funnel_advance_notice_business_days: integer(
    "intro_funnel_advance_notice_business_days",
  )
    .notNull()
    .default(5),
  intro_funnel_per_week_cap: integer("intro_funnel_per_week_cap")
    .notNull()
    .default(3),

  updated_at_ms: integer("updated_at_ms").notNull(),
});

export type CalendarBookingRow = typeof calendar_bookings.$inferSelect;
export type CalendarBookingInsert = typeof calendar_bookings.$inferInsert;
export type CalendarConfigRow = typeof calendar_config.$inferSelect;

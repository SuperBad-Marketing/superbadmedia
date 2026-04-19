import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { intro_funnel_submissions } from "./intro-funnel-submissions";
import { intro_funnel_payments } from "./intro-funnel-payments";
import { deals } from "./deals";

export const BOOKING_STATUSES = [
  "booked",
  "rescheduled",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_CANCELLED_BY = ["customer", "superbad"] as const;
export type BookingCancelledBy = (typeof BOOKING_CANCELLED_BY)[number];

export const intro_funnel_bookings = sqliteTable(
  "intro_funnel_bookings",
  {
    id: text("id").primaryKey(),
    submission_id: text("submission_id")
      .notNull()
      .references(() => intro_funnel_submissions.id, { onDelete: "cascade" }),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    payment_id: text("payment_id")
      .notNull()
      .references(() => intro_funnel_payments.id, { onDelete: "cascade" }),

    slot_start_at_ms: integer("slot_start_at_ms").notNull(),
    slot_end_at_ms: integer("slot_end_at_ms").notNull(),

    status: text("status", { enum: BOOKING_STATUSES })
      .notNull()
      .default("booked"),

    reschedule_count: integer("reschedule_count").notNull().default(0),

    cancelled_at_ms: integer("cancelled_at_ms"),
    cancelled_by: text("cancelled_by", { enum: BOOKING_CANCELLED_BY }),
    cancelled_reason_code: text("cancelled_reason_code"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_submission: index("ifb_submission_idx").on(t.submission_id),
    by_deal: index("ifb_deal_idx").on(t.deal_id),
    by_slot: index("ifb_slot_idx").on(t.slot_start_at_ms),
  }),
);

export type IntroFunnelBookingRow = typeof intro_funnel_bookings.$inferSelect;
export type IntroFunnelBookingInsert =
  typeof intro_funnel_bookings.$inferInsert;

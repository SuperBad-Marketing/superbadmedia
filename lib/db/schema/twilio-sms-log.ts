import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { intro_funnel_submissions } from "./intro-funnel-submissions";
import { deals } from "./deals";

export const SMS_DIRECTIONS = ["outbound", "inbound"] as const;
export type SmsDirection = (typeof SMS_DIRECTIONS)[number];

export const SMS_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "failed",
  "undelivered",
  "received",
] as const;
export type SmsStatus = (typeof SMS_STATUSES)[number];

export const twilio_sms_log = sqliteTable(
  "twilio_sms_log",
  {
    id: text("id").primaryKey(),
    submission_id: text("submission_id").references(
      () => intro_funnel_submissions.id,
      { onDelete: "set null" },
    ),
    deal_id: text("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),

    direction: text("direction", { enum: SMS_DIRECTIONS }).notNull(),
    twilio_message_sid: text("twilio_message_sid").notNull().unique(),
    from_number: text("from_number").notNull(),
    to_number: text("to_number").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: SMS_STATUSES }).notNull(),

    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_submission: index("tsl_submission_idx").on(t.submission_id),
    by_deal: index("tsl_deal_idx").on(t.deal_id),
    by_sid: index("tsl_sid_idx").on(t.twilio_message_sid),
  }),
);

export type TwilioSmsLogRow = typeof twilio_sms_log.$inferSelect;
export type TwilioSmsLogInsert = typeof twilio_sms_log.$inferInsert;

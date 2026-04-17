import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { outreachDrafts } from "./outreach-drafts";

/**
 * Authoritative send record. Written after `sendEmail()` succeeds.
 * Tracks engagement for the tier evaluator (spec §11).
 *
 * Owner: Lead Generation spec §4.3.
 * Consumers: engagement tier evaluator, metrics panel, Daily Cockpit.
 */

export const OUTREACH_BOUNCE_KINDS = ["hard", "soft", "complaint"] as const;
export type OutreachBounceKind = (typeof OUTREACH_BOUNCE_KINDS)[number];

export const outreachSends = sqliteTable(
  "outreach_sends",
  {
    id: text("id").primaryKey(),
    draft_id: text("draft_id")
      .notNull()
      .references(() => outreachDrafts.id),
    sequence_id: text("sequence_id").notNull(),
    deal_id: text("deal_id").notNull(),

    resend_message_id: text("resend_message_id").notNull().unique(),
    sent_at: integer("sent_at", { mode: "timestamp_ms" }).notNull(),

    // Engagement signals from Resend webhooks
    first_opened_at: integer("first_opened_at", { mode: "timestamp_ms" }),
    open_count: integer("open_count").notNull().default(0),
    first_open_dwell_sec: integer("first_open_dwell_sec"),
    first_clicked_at: integer("first_clicked_at", { mode: "timestamp_ms" }),
    click_count: integer("click_count").notNull().default(0),
    replied_at: integer("replied_at", { mode: "timestamp_ms" }),
    bounced_at: integer("bounced_at", { mode: "timestamp_ms" }),
    bounce_kind: text("bounce_kind", { enum: OUTREACH_BOUNCE_KINDS }),
    unsubscribed_at: integer("unsubscribed_at", { mode: "timestamp_ms" }),

    // Engagement tier (computed after cooloff; rolls forward on new events)
    // 1=click, 2=full open, 3=sub-60s open, 4=none
    engagement_tier: integer("engagement_tier"),
  },
  (t) => ({
    by_sequence: index("outreach_sends_sequence_idx").on(
      t.sequence_id,
      t.sent_at,
    ),
    by_deal: index("outreach_sends_deal_idx").on(t.deal_id),
    by_resend: index("outreach_sends_resend_idx").on(t.resend_message_id),
  }),
);

export type OutreachSendRow = typeof outreachSends.$inferSelect;
export type OutreachSendInsert = typeof outreachSends.$inferInsert;

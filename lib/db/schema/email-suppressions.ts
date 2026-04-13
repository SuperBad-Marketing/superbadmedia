import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Email suppression list — addresses that must not receive outreach or
 * sequence emails. Populated by Resend webhooks (B3), manual admin action,
 * and the unsubscribe flow (SP-8).
 *
 * `canSendTo()` in `lib/channels/email/can-send-to.ts` queries this table
 * before any send. `classification` = null means globally suppressed across
 * all non-transactional classifications.
 *
 * Owner: A7. Consumer: B3 (Resend webhooks), SP-8 (unsubscribe flow).
 */
export const EMAIL_SUPPRESSION_KINDS = [
  "bounce",
  "complaint",
  "unsubscribe",
  "manual",
] as const;

export type EmailSuppressionKind = (typeof EMAIL_SUPPRESSION_KINDS)[number];

export const email_suppressions = sqliteTable(
  "email_suppressions",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    kind: text("kind", { enum: EMAIL_SUPPRESSION_KINDS }).notNull(),
    classification: text("classification"),
    reason: text("reason"),
    suppressed_at_ms: integer("suppressed_at_ms").notNull(),
    created_by: text("created_by"),
  },
  (t) => ({
    by_email: index("email_suppressions_email_idx").on(
      t.email,
      t.suppressed_at_ms,
    ),
    by_kind: index("email_suppressions_kind_idx").on(t.kind, t.suppressed_at_ms),
  }),
);

export type EmailSuppressionRow = typeof email_suppressions.$inferSelect;
export type EmailSuppressionInsert = typeof email_suppressions.$inferInsert;

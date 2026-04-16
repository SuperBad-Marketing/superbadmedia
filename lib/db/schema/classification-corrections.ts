import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { messages } from "./messages";

/**
 * Shared corrections table for all three Unified Inbox classifiers
 * (router, notifier, signal_noise). Each correction is a few-shot
 * example that the LLM reads on subsequent classifications.
 *
 * Per spec §5.1 + discipline #54: one table, not three.
 */
export const CLASSIFIER_TYPES = [
  "router",
  "notifier",
  "signal_noise",
] as const;
export type ClassifierType = (typeof CLASSIFIER_TYPES)[number];

export const CORRECTION_SOURCES = [
  "explicit_reroute",
  "engagement_implicit",
  "keep_pinned",
] as const;
export type CorrectionSource = (typeof CORRECTION_SOURCES)[number];

export const classification_corrections = sqliteTable(
  "classification_corrections",
  {
    id: text("id").primaryKey(),
    message_id: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    classifier: text("classifier", { enum: CLASSIFIER_TYPES }).notNull(),
    original_classification: text("original_classification").notNull(),
    corrected_classification: text("corrected_classification").notNull(),
    correction_source: text("correction_source", {
      enum: CORRECTION_SOURCES,
    }).notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_message: index("classification_corrections_message_idx").on(
      t.message_id,
    ),
    by_classifier: index("classification_corrections_classifier_idx").on(
      t.classifier,
      t.created_at_ms,
    ),
  }),
);

export type ClassificationCorrectionRow =
  typeof classification_corrections.$inferSelect;
export type ClassificationCorrectionInsert =
  typeof classification_corrections.$inferInsert;

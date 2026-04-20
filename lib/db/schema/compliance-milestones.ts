import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const COMPLIANCE_MILESTONE_KINDS = [
  "bas_filed",
  "eofy_filed",
] as const;
export type ComplianceMilestoneKind =
  (typeof COMPLIANCE_MILESTONE_KINDS)[number];

export const compliance_milestones = sqliteTable("compliance_milestones", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: COMPLIANCE_MILESTONE_KINDS }).notNull(),
  period_label: text("period_label").notNull(),
  filed_at_ms: integer("filed_at_ms").notNull(),
  note: text("note"),
});

export type ComplianceMilestoneRow =
  typeof compliance_milestones.$inferSelect;
export type ComplianceMilestoneInsert =
  typeof compliance_milestones.$inferInsert;

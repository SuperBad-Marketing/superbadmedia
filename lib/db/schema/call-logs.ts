import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { deals } from "./deals";

export const CALL_TEMPLATE_TYPES = [
  "contacted",
  "conversation",
  "trial_shoot_pre",
  "trial_shoot_post",
  "quoted",
  "negotiating",
] as const;
export type CallTemplateType = (typeof CALL_TEMPLATE_TYPES)[number];

export const CALL_STATUSES = ["prep", "active", "debrief", "complete"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_TEMPERATURES = ["hot", "warm", "cool", "cold"] as const;
export type CallTemperature = (typeof CALL_TEMPERATURES)[number];

export const call_logs = sqliteTable(
  "call_logs",
  {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    contact_id: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    stage_at_time: text("stage_at_time").notNull(),
    template_type: text("template_type", { enum: CALL_TEMPLATE_TYPES }).notNull(),
    status: text("status", { enum: CALL_STATUSES }).notNull().default("prep"),
    temperature: text("temperature", { enum: CALL_TEMPERATURES }),
    agreed_next_step: text("agreed_next_step"),
    follow_up_date_ms: integer("follow_up_date_ms"),
    blockers: text("blockers"),
    sections_data: text("sections_data", { mode: "json" }),
    llm_briefing: text("llm_briefing", { mode: "json" }),
    llm_custom_questions: text("llm_custom_questions", { mode: "json" }),
    llm_synthesis: text("llm_synthesis", { mode: "json" }),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
    completed_at_ms: integer("completed_at_ms"),
  },
  (t) => ({
    by_deal: index("call_logs_deal_idx").on(t.deal_id),
    by_company: index("call_logs_company_idx").on(t.company_id),
    by_status: index("call_logs_status_idx").on(t.status),
  }),
);

export type CallLogRow = typeof call_logs.$inferSelect;
export type CallLogInsert = typeof call_logs.$inferInsert;

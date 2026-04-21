import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { QUOTE_BUILDER_HANDLERS } from "./quote-builder";
import { INVOICING_HANDLERS } from "@/lib/invoicing/handlers";
import { SAAS_SUBSCRIPTION_HANDLERS } from "./saas-subscription-usage-reset";
import { SAAS_TIER_CHANGE_HANDLERS } from "./saas-subscription-tier-downgrade-apply";
import { SAAS_DATA_LOSS_HANDLERS } from "./saas-data-loss-warning";
import { INBOX_SUBSCRIPTION_RENEW_HANDLERS } from "./inbox-graph-subscription-renew";
import { INBOX_HYGIENE_HANDLERS } from "./inbox-hygiene-purge";
import { INBOX_DRAFT_HANDLERS } from "./inbox-draft-generate";
import { INBOX_TICKET_AUTO_RESOLVE_HANDLERS } from "./inbox-ticket-auto-resolve";
import { INBOX_DIGEST_HANDLERS } from "./inbox-digest";
import { ONBOARDING_NUDGE_HANDLERS } from "./onboarding-nudges";
import { CONTENT_KEYWORD_RESEARCH_HANDLERS } from "./content-keyword-research";
import { CONTENT_GENERATE_DRAFT_HANDLERS } from "./content-generate-draft";
import { CONTENT_FAN_OUT_HANDLERS } from "./content-fan-out";
import { CONTENT_NEWSLETTER_SEND_HANDLERS } from "./content-newsletter-send";
import { CONTENT_RANKING_SNAPSHOT_HANDLERS } from "./content-ranking-snapshot";
import { CONTENT_OUTREACH_MATCH_HANDLERS } from "./content-outreach-match";
import { LEAD_GEN_DAILY_SEARCH_HANDLERS } from "./lead-gen-daily-search";
import { LEAD_GEN_SEQUENCE_HANDLERS } from "./lead-gen-sequence";
import { CLIENT_DATA_EXPORT_HANDLERS } from "./client-data-export";
import { CASE_SNIPPET_HANDLERS } from "./case-snippet";
import { INTRO_FUNNEL_ABANDON_HANDLERS } from "./intro-funnel-abandon";
import { INTRO_FUNNEL_BOOKING_REMINDER_HANDLERS } from "./intro-funnel-booking-reminder";
import { INTRO_FUNNEL_REFLECTION_REMINDER_HANDLERS } from "./intro-funnel-reflection-reminder";
import { SIX_WEEK_PLAN_GENERATE_HANDLERS } from "./six-week-plan-generate";
import { SIX_WEEK_PLAN_MIGRATION_HANDLERS } from "./six-week-plan-migration";
import { SIX_WEEK_PLAN_REVISION_QUEUE_HANDLERS } from "./six-week-plan-revision-queue";
import { SIX_WEEK_PLAN_EXPIRY_EMAIL_HANDLERS } from "./six-week-plan-expiry-email";
import { SIX_WEEK_PLAN_NON_CONVERTER_ARCHIVE_HANDLERS } from "./six-week-plan-non-converter-archive";
import { CONTEXT_ENGINE_HANDLERS } from "./context-engine";
import { DELIVERABLE_APPROVAL_REMINDER_HANDLERS } from "./deliverable-approval-reminder";
import { TASK_DIGEST_HANDLERS } from "./task-morning-digest";
import { HIRING_DISCOVERY_HANDLERS } from "./hiring-discovery";
import { HIRING_APPLY_HANDLERS } from "./hiring-apply";
import { HIRING_INVITE_HANDLERS } from "./hiring-invite";
import { HIRING_FOLLOWUP_CHECK_HANDLERS } from "./hiring-followup-check";
import { HIRING_TRIAL_HANDLERS } from "./hiring-trial";
import { HIRING_ARCHIVE_REFLECTION_HANDLERS } from "./hiring-archive-reflection";
import { HIRING_ROLE_BRIEF_REGENERATE_HANDLERS } from "./hiring-role-brief-regenerate";
import { HIRING_BENCH_PAUSE_ENDING_HANDLERS } from "./hiring-bench-pause-ending";
import { FINANCE_SNAPSHOT_HANDLERS } from "./finance-snapshot";
import { FINANCE_OBSERVATORY_ROLLUP_HANDLERS } from "./finance-observatory-rollup";
import { FINANCE_STRIPE_FEE_ROLLUP_HANDLERS } from "./finance-stripe-fee-rollup";
import { FINANCE_RECURRING_EXPENSE_BOOK_HANDLERS } from "./finance-recurring-expense-book";
import { FINANCE_NARRATIVE_HANDLERS } from "./finance-narrative";
import { FINANCE_EXPORT_GENERATE_HANDLERS } from "./finance-export-generate";
import { FINANCE_EXPORT_RETENTION_PURGE_HANDLERS } from "./finance-export-retention-purge";
import { AMBIENT_COPY_GENERATE_HANDLERS } from "./ambient-copy-generate";
import { MILESTONE_SPOTTER_SCAN_HANDLERS } from "./milestone-spotter-scan";
import { HIDDEN_EGG_FIRE_CLEANUP_HANDLERS } from "./hidden-egg-fire-cleanup";
import { RIDDLE_ANSWER_FALLBACK_BUDGET_MONITOR_HANDLERS } from "./riddle-answer-fallback-budget-monitor";
import { COST_ANOMALY_DETECTOR_HARD_HANDLERS } from "./cost-anomaly-detector-hard";
import { COST_ANOMALY_DETECTOR_RATE_HANDLERS } from "./cost-anomaly-detector-rate";
import { COST_ANOMALY_DETECTOR_LEARNED_HANDLERS } from "./cost-anomaly-detector-learned";
import { COST_ANOMALY_DIAGNOSE_HANDLERS } from "./cost-anomaly-diagnose";
import { WEEKLY_DIGEST_SEND_HANDLERS } from "./weekly-digest-send";
import { COCKPIT_BRIEF_REGENERATE_HANDLERS } from "./cockpit-brief-regenerate";

/**
 * Single dispatch map consumed by `lib/scheduled-tasks/worker.ts`.
 *
 * Each feature area contributes its own `HandlerMap` block; this index
 * merges them into one. QB-1 seeds the Quote Builder block; downstream
 * specs (Branded Invoicing, Content Engine, etc.) add theirs by
 * registering a `*_HANDLERS` export and spreading it in below.
 *
 * Worker treats any missing handler for a pending task type as a hard
 * failure (`no handler for {type}`) — the registry is authoritative.
 */
export const HANDLER_REGISTRY: HandlerMap = {
  ...QUOTE_BUILDER_HANDLERS,
  ...INVOICING_HANDLERS,
  ...SAAS_SUBSCRIPTION_HANDLERS,
  ...SAAS_TIER_CHANGE_HANDLERS,
  ...SAAS_DATA_LOSS_HANDLERS,
  ...INBOX_SUBSCRIPTION_RENEW_HANDLERS,
  ...INBOX_HYGIENE_HANDLERS,
  ...INBOX_DRAFT_HANDLERS,
  ...INBOX_TICKET_AUTO_RESOLVE_HANDLERS,
  ...INBOX_DIGEST_HANDLERS,
  ...ONBOARDING_NUDGE_HANDLERS,
  ...CONTENT_KEYWORD_RESEARCH_HANDLERS,
  ...CONTENT_GENERATE_DRAFT_HANDLERS,
  ...CONTENT_FAN_OUT_HANDLERS,
  ...CONTENT_NEWSLETTER_SEND_HANDLERS,
  ...CONTENT_RANKING_SNAPSHOT_HANDLERS,
  ...CONTENT_OUTREACH_MATCH_HANDLERS,
  ...LEAD_GEN_DAILY_SEARCH_HANDLERS,
  ...LEAD_GEN_SEQUENCE_HANDLERS,
  ...CLIENT_DATA_EXPORT_HANDLERS,
  ...CASE_SNIPPET_HANDLERS,
  ...INTRO_FUNNEL_ABANDON_HANDLERS,
  ...INTRO_FUNNEL_BOOKING_REMINDER_HANDLERS,
  ...INTRO_FUNNEL_REFLECTION_REMINDER_HANDLERS,
  ...SIX_WEEK_PLAN_GENERATE_HANDLERS,
  ...SIX_WEEK_PLAN_MIGRATION_HANDLERS,
  ...SIX_WEEK_PLAN_REVISION_QUEUE_HANDLERS,
  ...SIX_WEEK_PLAN_EXPIRY_EMAIL_HANDLERS,
  ...SIX_WEEK_PLAN_NON_CONVERTER_ARCHIVE_HANDLERS,
  ...CONTEXT_ENGINE_HANDLERS,
  ...DELIVERABLE_APPROVAL_REMINDER_HANDLERS,
  ...TASK_DIGEST_HANDLERS,
  ...HIRING_DISCOVERY_HANDLERS,
  ...HIRING_APPLY_HANDLERS,
  ...HIRING_INVITE_HANDLERS,
  ...HIRING_FOLLOWUP_CHECK_HANDLERS,
  ...HIRING_TRIAL_HANDLERS,
  ...HIRING_ARCHIVE_REFLECTION_HANDLERS,
  ...HIRING_ROLE_BRIEF_REGENERATE_HANDLERS,
  ...HIRING_BENCH_PAUSE_ENDING_HANDLERS,
  ...FINANCE_SNAPSHOT_HANDLERS,
  ...FINANCE_OBSERVATORY_ROLLUP_HANDLERS,
  ...FINANCE_STRIPE_FEE_ROLLUP_HANDLERS,
  ...FINANCE_RECURRING_EXPENSE_BOOK_HANDLERS,
  ...FINANCE_NARRATIVE_HANDLERS,
  ...FINANCE_EXPORT_GENERATE_HANDLERS,
  ...FINANCE_EXPORT_RETENTION_PURGE_HANDLERS,
  ...AMBIENT_COPY_GENERATE_HANDLERS,
  ...MILESTONE_SPOTTER_SCAN_HANDLERS,
  ...HIDDEN_EGG_FIRE_CLEANUP_HANDLERS,
  ...RIDDLE_ANSWER_FALLBACK_BUDGET_MONITOR_HANDLERS,
  ...COST_ANOMALY_DETECTOR_HARD_HANDLERS,
  ...COST_ANOMALY_DETECTOR_RATE_HANDLERS,
  ...COST_ANOMALY_DETECTOR_LEARNED_HANDLERS,
  ...COST_ANOMALY_DIAGNOSE_HANDLERS,
  ...WEEKLY_DIGEST_SEND_HANDLERS,
  ...COCKPIT_BRIEF_REGENERATE_HANDLERS,
};

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema/settings";

/**
 * Typed settings registry. Single source of truth for every key the
 * platform reads via `settings.get()`. Mirrors `docs/settings-registry.md`.
 *
 * Adding a key:
 *   1. Add a row to `docs/settings-registry.md`.
 *   2. Add the row to the seed migration.
 *   3. Add the key + schema here.
 *   4. Add a consumer; feature code MUST use `settings.get()`, never literals.
 *
 * Renames require a migration touching every consumer.
 */

// Shared schema fragments
const decimal = z.coerce.number();
const integer = z.coerce.number().int();
const boolean = z.union([z.boolean(), z.enum(["true", "false"])]).transform(
  (v) => (typeof v === "boolean" ? v : v === "true"),
);
const str = z.string();

const registry = {
  // Finance (11)
  "finance.gst_rate": decimal,
  "finance.income_tax_rate": decimal,
  "finance.bas_reminder_days_ahead": integer,
  "finance.eofy_reminder_days_ahead": integer,
  "finance.overdue_invoice_threshold_days": integer,
  "finance.outstanding_invoices_threshold_aud": integer,
  "finance.snapshot_time_local": str,
  "finance.projection_horizon_days": integer,
  "finance.stage_age_decay_halflife_days": integer,
  "finance.recurring_review_debounce_hours": integer,
  "finance.export_retention_days": integer,

  // Wizards (6)
  "wizards.expiry_days": integer,
  "wizards.resume_nudge_hours": integer,
  "wizards.admin_cockpit_banner_days": integer,
  "wizards.help_escalation_failure_count": integer,
  "wizards.step_retry_max": integer,
  "wizards.critical_flight_wizards": z
    .string()
    .transform((v) => JSON.parse(v) as string[]),
  "wizards.dns_verify_poll_interval_ms": integer,
  "wizards.async_check_timeout_ms": integer,
  "wizards.webhook_probe_timeout_ms": integer,
  "wizards.verify_timeout_ms": integer,

  // Plan (10)
  "plan.portal_access_days_post_shoot": integer,
  "plan.chat_calls_per_day_non_converter": integer,
  "plan.revision_note_min_chars": integer,
  "plan.observations_min_chars": integer,
  "plan.regen_soft_warning_threshold": integer,
  "plan.pdf_cache_hours": integer,
  "plan.self_review_retry_on_fail": integer,
  "plan.extend_portal_days_on_manual_override": integer,
  "plan.expiry_email_days_before_archive": integer,
  "plan.refresh_review_block_escalation_hours": integer,

  // Portal (5)
  "portal.non_converter_archive_days": integer,
  "portal.chat_calls_per_day_pre_retainer": integer,
  "portal.chat_calls_per_day_retainer": integer,
  "portal.magic_link_ttl_hours": integer,
  "portal.session_cookie_ttl_days": integer,

  // Subscriber auth (SB-6a, 1)
  "subscriber.magic_link_ttl_hours": integer,

  // Intro Funnel (1)
  "intro_funnel.reflection_delay_hours_after_deliverables": integer,

  // Hiring (28)
  "hiring.discovery.llm_run_cadence": z.enum([
    "weekly",
    "fortnightly",
    "monthly",
    "off",
  ]),
  "hiring.discovery.llm_max_cost_aud_per_run": decimal,
  "hiring.discovery.llm_candidates_per_run": integer,
  "hiring.discovery.weekly_cost_warn_threshold_aud": decimal,
  "hiring.discovery.vimeo_enabled": boolean,
  "hiring.discovery.behance_enabled": boolean,
  "hiring.discovery.ig_on_demand_enabled": boolean,
  "hiring.discovery.llm_agent_enabled": boolean,
  "hiring.discovery.sourced_review_window_days": integer,
  "hiring.discovery.auto_invite_score_threshold": decimal,
  "hiring.invite.auto_send_enabled": boolean,
  "hiring.invite.auto_send_confidence_threshold": decimal,
  "hiring.invite.ft_auto_send_confidence_threshold": decimal,
  "hiring.invite.daily_send_cap_per_role": integer,
  "hiring.invite.per_candidate_throttle_days": integer,
  "hiring.invite.cross_role_max_per_candidate_per_year": integer,
  "hiring.apply.followup_reply_wait_days": integer,
  "hiring.apply.rate_bands": z.string().transform((v) => JSON.parse(v)),
  "hiring.trial.delivery_deadline_days": integer,
  "hiring.trial.delivery_grace_days": integer,
  "hiring.trial.default_budget_cap_hours": integer,
  "hiring.brief.archive_retune_threshold": integer,
  "hiring.brief.regen_on_bench_entry": boolean,
  "hiring.bench.pause_ending_warn_days": integer,
  "hiring.staleness.sourced_days": integer,
  "hiring.staleness.invited_days": integer,
  "hiring.staleness.applied_days": integer,
  "hiring.staleness.screened_days": integer,

  // Email adapter (4 — A7 pre-reqs)
  "email.quiet_window_start_hour": integer,
  "email.quiet_window_end_hour": integer,
  "email.drift_check_threshold": decimal,
  "email.drift_retry_count": integer,

  // Alerts (3 — B1 pre-reqs)
  "alerts.anthropic_daily_cap_aud": decimal,
  "alerts.stripe_fee_anomaly_multiplier": decimal,
  "alerts.resend_bounce_rate_threshold": decimal,

  // Legal (2 — B3)
  "legal.dsr_email": str,
  "legal.dsr_response_days": integer,

  // Sales Pipeline (7 — SP-3)
  "pipeline.stale_thresholds.lead_days": integer,
  "pipeline.stale_thresholds.contacted_days": integer,
  "pipeline.stale_thresholds.conversation_days": integer,
  "pipeline.stale_thresholds.trial_shoot_days": integer,
  "pipeline.stale_thresholds.quoted_days": integer,
  "pipeline.stale_thresholds.negotiating_days": integer,
  "pipeline.snooze_default_days": integer,
  "pipeline.stripe_webhook_dispatch_enabled": boolean,
  "pipeline.resend_webhook_dispatch_enabled": boolean,
  "pipeline.sd_three_wons_last_fired_ms": integer,

  // Quote Builder (4 — QB-1 + QB-4b)
  "quote.default_expiry_days": integer,
  "quote.setup_fee_monthly_saas": integer,
  "quote.reminder_days": integer,
  "quote.intro_paragraph_redraft_hourly_cap": integer,

  // Branded Invoicing (2 — BI-1)
  "invoice.review_window_days": integer,
  "invoice.overdue_reminder_days": integer,

  // SaaS Subscription Billing (3 — SB-2b, SB-7, SB-9)
  "billing.saas.monthly_setup_fee_cents": integer,
  "saas.usage_warn_threshold_percent": integer,
  "saas.data_loss_warning_days": integer,
  "saas.headline_window_days": integer,
  "saas.near_cap_threshold": decimal,

  // Unified Inbox — Graph API sync (3 — UI-1)
  "inbox.graph_sync_interval_seconds": integer,
  "inbox.graph_subscription_ttl_hours": integer,
  "inbox.graph_subscription_renew_buffer_hours": integer,

  // Unified Inbox — support ticket auto-resolve (1 — UI-10)
  "inbox.ticket_auto_resolve_idle_days": integer,

  // Unified Inbox — history import (1 — UI-12)
  "inbox.history_import_months": integer,

  // Unified Inbox — morning digest (3 — UI-13)
  "inbox.digest_hour": integer,
  "inbox.digest_silent_window_hours": integer,
  "inbox.digest_no_send_on_zero": boolean,
} as const;

export type SettingsKey = keyof typeof registry;
export type SettingValue<K extends SettingsKey> = z.infer<
  (typeof registry)[K]
>;

export const SETTINGS_KEYS = Object.keys(registry) as SettingsKey[];

// In-memory cache — invalidated on write via `settings.set()`.
const cache = new Map<SettingsKey, unknown>();

async function read<K extends SettingsKey>(key: K): Promise<SettingValue<K>> {
  if (cache.has(key)) {
    return cache.get(key) as SettingValue<K>;
  }
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  if (rows.length === 0) {
    throw new Error(
      `[settings] key not found: ${key}. Add it to docs/settings-registry.md + the seed migration + lib/settings.ts.`,
    );
  }
  const parsed = registry[key].safeParse(rows[0].value);
  if (!parsed.success) {
    throw new Error(
      `[settings] key ${key} has invalid stored value: ${parsed.error.message}`,
    );
  }
  const value = parsed.data as SettingValue<K>;
  cache.set(key, value);
  return value;
}

async function set<K extends SettingsKey>(
  key: K,
  value: string,
): Promise<void> {
  await db
    .update(settings)
    .set({ value, updated_at_ms: Date.now() })
    .where(eq(settings.key, key));
  cache.delete(key);
}

function invalidateCache(): void {
  cache.clear();
}

export const settingsRegistry = {
  get: read,
  set,
  invalidateCache,
  keys: SETTINGS_KEYS,
};

// Default export mirrors the `settings.get()` call-site shape referenced
// throughout the specs and AUTONOMY_PROTOCOL.md §G4.
export default settingsRegistry;

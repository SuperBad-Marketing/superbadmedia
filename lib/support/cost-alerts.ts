/**
 * Cost-alert checks. Called from scheduled tasks or on-demand to detect
 * when Anthropic / Stripe / Resend spend has crossed a threshold and
 * notify Andy via transactional email.
 *
 * All thresholds read from settings.get() — no literals in autonomy-
 * sensitive code (G4). Gates:
 *   - alerts.anthropic_daily_cap_aud
 *   - alerts.stripe_fee_anomaly_multiplier
 *   - alerts.resend_bounce_rate_threshold
 *
 * Owner: B1.
 */
import { sql } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import settingsRegistry from "@/lib/settings";
import { sendEmail } from "@/lib/channels/email";

export interface CostAlertResult {
  anthropic: { fired: boolean; spend: number; cap: number };
}

/**
 * Check Anthropic daily spend against the configured cap.
 * Fires a transactional alert email to Andy when the cap is crossed.
 *
 * @param dbOverride - optional DB override for tests
 * @param sendEmailOverride - optional sendEmail override for tests
 */
export async function checkAnthropicDailyCap(
  dbOverride?: typeof defaultDb,
  sendEmailOverride?: typeof sendEmail,
): Promise<CostAlertResult["anthropic"]> {
  const db = dbOverride ?? defaultDb;
  const mailer = sendEmailOverride ?? sendEmail;

  const cap = await settingsRegistry.get("alerts.anthropic_daily_cap_aud");

  const startOfDayMs = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  })();

  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${external_call_log.estimated_cost_aud}), 0)`,
    })
    .from(external_call_log)
    .where(
      sql`${external_call_log.job} LIKE ${"anthropic:%"} AND ${external_call_log.created_at_ms} >= ${startOfDayMs}`,
    );

  const spend = rows[0]?.total ?? 0;

  if (spend >= cap) {
    await mailer({
      to: process.env.EMAIL_FROM ?? "andy@superbadmedia.com.au",
      subject: `[Alert] Anthropic daily cap hit — $${spend.toFixed(2)} AUD`,
      body: `<p>Anthropic spend today has reached <strong>$${spend.toFixed(2)} AUD</strong>, which meets or exceeds the cap of <strong>$${cap.toFixed(2)} AUD</strong>.</p><p>The autonomous loop is still running. Review spend in the Observatory or flip <code>llm_calls_enabled</code> off to pause LLM calls.</p>`,
      classification: "transactional",
      purpose: "cost_alert:anthropic_daily_cap",
    });
  }

  return { fired: spend >= cap, spend, cap };
}

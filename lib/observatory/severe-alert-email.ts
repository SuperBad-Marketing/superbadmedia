/**
 * Sends an immediate transactional email to Andy when a severe-tier
 * cost anomaly fires. Called by each detector when it creates a new
 * severe anomaly.
 *
 * Spec: `docs/specs/cost-usage-observatory.md` §3.3.
 * Owner: COB-9 (Wave 21).
 */
import type { CostAnomalyRow } from "@/lib/db/schema/cost-anomalies";

const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? "andy@superbadmedia.com.au";

function formatAud(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildSubject(anomaly: CostAnomalyRow): string {
  if (anomaly.detector === "rate") {
    return `[SEVERE] Rate limit triggered: ${anomaly.job}`;
  }
  return `[SEVERE] Cost ceiling breached: ${anomaly.job} — $${formatAud(anomaly.observed_value)}`;
}

function buildBody(anomaly: CostAnomalyRow): string {
  const band = anomaly.expected_band as Record<string, unknown> | null;
  const bandLabel =
    band && typeof band.daily_ceiling_aud === "number"
      ? `$${formatAud(band.daily_ceiling_aud)}`
      : band && typeof band.per_call_ceiling_aud === "number"
        ? `$${formatAud(band.per_call_ceiling_aud)}`
        : "expected band";

  const time = new Date(anomaly.first_fired_at_ms).toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    dateStyle: "medium",
    timeStyle: "short",
  });

  let headline: string;
  if (anomaly.detector === "rate") {
    headline = `Rate limit triggered on <strong>${anomaly.job}</strong>. ${anomaly.fire_count} fires. Possible loop.`;
  } else {
    headline = `Hard ceiling breached on <strong>${anomaly.job}</strong>: $${formatAud(anomaly.observed_value)} vs ${bandLabel} ceiling.`;
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px 0;">
      <p style="font-size: 15px; color: #1a1a1a; line-height: 1.5; margin: 0 0 16px;">${headline}</p>
      <p style="font-size: 13px; color: #666; margin: 0 0 24px;">Fired at ${time} (Melbourne).</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://superbadmedia.com.au"}/lite/observatory/anomalies/${anomaly.id}"
         style="display: inline-block; background: #dc2626; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
        Investigate
      </a>
    </div>
  `.trim();
}

export async function sendSevereAlertEmail(
  anomaly: CostAnomalyRow,
): Promise<{ sent: boolean }> {
  const { sendEmail } = await import("@/lib/channels/email/send");
  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject: buildSubject(anomaly),
    body: buildBody(anomaly),
    classification: "transactional",
    purpose: "severe_cost_anomaly_alert",
  });

  return { sent: result.sent };
}

/**
 * Sends an immediate transactional email to Andy when a severe-tier
 * cost anomaly fires. Called by each detector when it creates a new
 * severe anomaly.
 *
 * Spec: `docs/specs/cost-usage-observatory.md` §3.3.
 * Owner: COB-9 (Wave 21).
 */
import type { CostAnomalyRow } from "@/lib/db/schema/cost-anomalies";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "andy@superbadmedia.com.au";

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

  return `<p style="font-size: 15px; color: #e8e0d0; line-height: 1.65; margin: 0 0 16px;">${headline}</p>
<p style="font-size: 13px; color: rgba(253,245,230,0.4); margin: 0 0 24px;">Fired at ${time} (Melbourne).</p>
<a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://superbadmedia.com.au"}/lite/observatory/anomalies/${anomaly.id}"
   style="display: inline-block; background: #B22848; color: #FDF5E6; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
  Investigate
</a>`;
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

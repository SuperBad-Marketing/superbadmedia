import type { TierSubscriberRow } from "./queries/tier-health";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "andy@superbadmedia.com.au";

function formatAud(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildSubject(subscriber: TierSubscriberRow, tierName: string): string {
  return `Negative margin: ${subscriber.company_name} (${tierName}) — -$${formatAud(Math.abs(subscriber.margin_aud))}`;
}

function buildBody(subscriber: TierSubscriberRow, tierName: string): string {
  const driversHtml = subscriber.top_jobs
    .map(
      (j) =>
        `<tr><td style="padding:4px 12px 4px 0;font-family:monospace;font-size:13px;color:#333;">${j.job}</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-size:13px;color:#333;">$${formatAud(j.cost_aud)}</td></tr>`,
    )
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px 0;">
      <p style="font-size:15px;color:#1a1a1a;line-height:1.5;margin:0 0 16px;">
        <strong>${subscriber.company_name}</strong> on the ${tierName} tier is running at negative margin this month.
      </p>
      <table style="border-collapse:collapse;margin:0 0 16px;">
        <tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#666;">Revenue</td><td style="font-family:monospace;font-size:13px;color:#333;">$${formatAud(subscriber.monthly_revenue_aud)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#666;">Cost</td><td style="font-family:monospace;font-size:13px;color:#333;">$${formatAud(subscriber.total_cost_aud)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#666;">Margin</td><td style="font-family:monospace;font-size:13px;color:#dc2626;font-weight:600;">-$${formatAud(Math.abs(subscriber.margin_aud))}</td></tr>
      </table>
      ${
        subscriber.top_jobs.length > 0
          ? `<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin:16px 0 8px;">Top cost drivers</h3>
             <table style="border-collapse:collapse;">${driversHtml}</table>`
          : ""
      }
      <p style="font-size:13px;color:#666;margin:24px 0 0;">
        Options: cap conversation usage · renegotiate to custom arrangement · accept as goodwill.
      </p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://superbadmedia.com.au"}/lite/observatory"
         style="display:inline-block;margin-top:16px;background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
        View in Observatory
      </a>
    </div>
  `.trim();
}

export async function sendNegativeMarginEmail(
  subscriber: TierSubscriberRow,
  tierName: string,
): Promise<{ sent: boolean }> {
  const { sendEmail } = await import("@/lib/channels/email/send");
  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject: buildSubject(subscriber, tierName),
    body: buildBody(subscriber, tierName),
    classification: "transactional",
    purpose: "negative_margin_alert",
  });

  return { sent: result.sent };
}

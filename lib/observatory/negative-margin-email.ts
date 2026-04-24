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
        `<tr><td style="padding:4px 12px 4px 0;font-family:monospace;font-size:13px;color:rgba(253,245,230,0.5);">${j.job}</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-size:13px;color:#e8e0d0;">$${formatAud(j.cost_aud)}</td></tr>`,
    )
    .join("");

  return `<p style="font-size:15px;color:#e8e0d0;line-height:1.65;margin:0 0 16px;">
  <strong style="color:#FDF5E6;">${subscriber.company_name}</strong> on the ${tierName} tier is running at negative margin this month.
</p>
<table style="border-collapse:collapse;margin:0 0 16px;">
  <tr><td style="padding:4px 12px 4px 0;font-size:13px;color:rgba(253,245,230,0.4);">Revenue</td><td style="font-family:monospace;font-size:13px;color:#e8e0d0;">$${formatAud(subscriber.monthly_revenue_aud)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-size:13px;color:rgba(253,245,230,0.4);">Cost</td><td style="font-family:monospace;font-size:13px;color:#e8e0d0;">$${formatAud(subscriber.total_cost_aud)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-size:13px;color:rgba(253,245,230,0.4);">Margin</td><td style="font-family:monospace;font-size:13px;color:#F28C52;font-weight:600;">-$${formatAud(Math.abs(subscriber.margin_aud))}</td></tr>
</table>
${
  subscriber.top_jobs.length > 0
    ? `<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(253,245,230,0.35);margin:16px 0 8px;">Top cost drivers</h3>
       <table style="border-collapse:collapse;">${driversHtml}</table>`
    : ""
}
<p style="font-size:13px;color:rgba(253,245,230,0.4);margin:24px 0 0;">
  Options: cap conversation usage · renegotiate to custom arrangement · accept as goodwill.
</p>
<a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://superbadmedia.com.au"}/lite/observatory"
   style="display:inline-block;margin-top:16px;background:#B22848;color:#FDF5E6;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.5px;">
  View in Observatory
</a>`;
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

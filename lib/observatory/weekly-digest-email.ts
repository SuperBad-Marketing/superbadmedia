import { getMtdSummary, getActiveAnomalies, getTopJobs } from "./queries/dashboard";
import { getTierHealth } from "./queries/tier-health";
import settings from "@/lib/settings";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "andy@superbadmedia.com.au";

function formatAud(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Posture = "green" | "amber" | "red";

function getPosture(mtdTotal: number, thresholds: Array<number | null>): Posture {
  const active = thresholds.filter((t): t is number => t != null && t > 0).sort((a, b) => a - b);
  if (active.length === 0) return "green";
  if (mtdTotal >= active[active.length - 1]) return "red";
  if (mtdTotal >= active[0]) return "amber";
  return "green";
}

const SUBJECT_POOL: Record<Posture, string[]> = {
  green: [
    "the observatory report — all quiet",
    "your week in numbers — nothing caught fire",
    "sunday cost check — the bands held",
  ],
  amber: [
    "the observatory report — a few things to note",
    "weekly costs — drifting, not alarming",
  ],
  red: [
    "the observatory report — needs your attention",
    "weekly costs — above the line you drew",
  ],
};

const OPENER_POOL = [
  "Here's what the platform cost this week. Most of it was expected.",
  "Weekly numbers. Nothing dramatic unless the section headings suggest otherwise.",
  "The observatory ran its sweep. Here's the summary.",
  "Another week of external calls. The highlights, such as they are.",
  (date: string) => `Cost check for the week ending ${date}. Read time: under a minute.`,
];

const CLOSER_POOL = [
  "That's the week. The observatory is still watching.",
  "End of report. See you next Sunday.",
  "Numbers don't lie. They do occasionally drift, though.",
  "Next digest lands same time next week unless you turn it off.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weekEndDate(): string {
  return new Date().toLocaleDateString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function buildWeeklyDigest(): Promise<{
  subject: string;
  body: string;
} | null> {
  const enabled = await settings.get("observatory.weekly_digest_enabled");
  if (enabled === false) return null;

  const [mtd, anomalies, topJobs, tiers] = await Promise.all([
    getMtdSummary(),
    getActiveAnomalies(),
    getTopJobs(),
    getTierHealth(),
  ]);

  const posture = getPosture(mtd.total_aud, mtd.thresholds);
  const subject = pick(SUBJECT_POOL[posture]);

  const dateStr = weekEndDate();
  const openerTemplate = pick(OPENER_POOL);
  const opener =
    typeof openerTemplate === "function"
      ? openerTemplate(dateStr)
      : openerTemplate;
  const closer = pick(CLOSER_POOL);

  const activeThresholds = mtd.thresholds
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  const projectionNote =
    mtd.projection_aud > 0 && activeThresholds.length > 0
      ? `Projection: $${formatAud(mtd.projection_aud)} at current pace.`
      : "";

  const top5 = topJobs.slice(0, 5);
  const topJobsHtml =
    top5.length > 0
      ? top5
          .map(
            (j) =>
              `<tr><td style="padding:4px 12px 4px 0;font-family:monospace;font-size:13px;color:#333;">${j.job}</td><td style="padding:4px 0;text-align:right;font-family:monospace;font-size:13px;color:#333;">$${formatAud(j.total_aud)}</td></tr>`,
          )
          .join("")
      : `<tr><td style="padding:4px 0;font-size:13px;color:#999;">No job data this week.</td></tr>`;

  const tierHtml =
    tiers.length > 0
      ? tiers
          .map((t) => {
            const dot =
              t.health === "red"
                ? "#dc2626"
                : t.health === "amber"
                  ? "#d97706"
                  : "#16a34a";
            return `<p style="margin:0 0 4px;font-size:13px;color:#333;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};margin-right:6px;vertical-align:middle;"></span>${t.tier_name}: ${t.subscriber_count} subs, ${t.percent_underwater}% underwater, avg margin $${formatAud(t.avg_margin_per_subscriber)}</p>`;
          })
          .join("")
      : `<p style="font-size:13px;color:#999;">No SaaS tiers configured.</p>`;

  const anomalyCount = anomalies.length;
  const anomalyHtml =
    anomalyCount > 0
      ? `<p style="font-size:13px;color:#333;">${anomalyCount} open anomal${anomalyCount === 1 ? "y" : "ies"}. Check the observatory for details.</p>`
      : `<p style="font-size:13px;color:#999;">None this week.</p>`;

  const body = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px 0;">
      <p style="font-size:15px;color:#1a1a1a;line-height:1.5;margin:0 0 20px;">${opener}</p>

      <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin:24px 0 8px;">The number</h3>
      <p style="font-size:22px;font-weight:600;color:#1a1a1a;margin:0;">$${formatAud(mtd.total_aud)} <span style="font-size:13px;font-weight:400;color:#666;">MTD (day ${mtd.days_elapsed}/${mtd.days_in_month})</span></p>
      ${projectionNote ? `<p style="font-size:13px;color:#666;margin:4px 0 0;">${projectionNote}</p>` : ""}

      <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin:24px 0 8px;">Tier check</h3>
      ${tierHtml}

      <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin:24px 0 8px;">Top jobs</h3>
      <table style="border-collapse:collapse;">${topJobsHtml}</table>

      <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin:24px 0 8px;">Anomalies</h3>
      ${anomalyHtml}

      <p style="font-size:13px;color:#999;margin:32px 0 0;border-top:1px solid #eee;padding-top:16px;">${closer}</p>
    </div>
  `.trim();

  return { subject, body };
}

export async function sendWeeklyDigestEmail(): Promise<{ sent: boolean }> {
  const digest = await buildWeeklyDigest();
  if (!digest) return { sent: false };

  const { sendEmail } = await import("@/lib/channels/email/send");
  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject: digest.subject,
    body: digest.body,
    classification: "transactional",
    purpose: "weekly_cost_digest",
  });

  return { sent: result.sent };
}

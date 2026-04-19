import type { WeekPlan } from "@/lib/ai/prompts/six-week-plan/weeks";
import { brand } from "@/lib/design-tokens";

export interface PlanPdfInput {
  businessName: string;
  planIntro: string;
  weeks: WeekPlan[];
  approvedAtMs: number;
}

export function planPdfFilename(businessName: string, approvedAtMs: number): string {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date(approvedAtMs);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `SuperBad-Six-Week-Plan-${slug}-${yyyy}-${mm}-${dd}.pdf`;
}

function formatMonthYear(ms: number): string {
  const d = new Date(ms);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  infrastructure: "Infrastructure",
  content: "Content",
  distribution: "Distribution",
  conversion: "Conversion",
  measurement: "Measurement",
};

const EFFORT_LABELS: Record<string, string> = {
  quick: "Quick",
  half_day: "Half day",
  full_day: "Full day",
  multi_day: "Multi-day",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderWeekHtml(week: WeekPlan): string {
  const tasksHtml = week.tasks
    .map(
      (t) => `
      <div style="margin-bottom: 8px; padding-left: 12px; border-left: 2px solid ${brand.orange};">
        <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px;">
          <strong style="font-size: 13px; color: ${brand.cream};">${escapeHtml(t.title)}</strong>
          <span style="font-size: 10px; color: ${brand.orange}; text-transform: uppercase; letter-spacing: 0.5px;">${CATEGORY_LABELS[t.category] ?? t.category}</span>
          <span style="font-size: 10px; color: #807F73;">${EFFORT_LABELS[t.effort_estimate] ?? t.effort_estimate}</span>
        </div>
        <p style="font-size: 12px; color: #807F73; margin: 0;">${escapeHtml(t.detail)}</p>
      </div>`,
    )
    .join("\n");

  const anglesHtml = week.content_angles
    .map(
      (a) => `
      <div style="margin-bottom: 6px;">
        <span style="display: inline-block; background: #332F2A; padding: 2px 6px; border-radius: 3px; font-size: 10px; color: ${brand.pink}; margin-right: 6px;">${escapeHtml(a.shoot_asset_ref)}</span>
        <span style="font-size: 12px; color: #D4D2C2;">${escapeHtml(a.description)}</span>
      </div>`,
    )
    .join("\n");

  const channelsHtml = week.channel_mix
    .map(
      (ch) =>
        `<span style="display: inline-block; background: #332F2A; padding: 3px 10px; border-radius: 12px; font-size: 11px; color: ${brand.cream}; margin-right: 6px; margin-bottom: 4px;">${escapeHtml(ch)}</span>`,
    )
    .join("");

  return `
    <div style="page-break-inside: avoid; margin-bottom: 28px;">
      <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${brand.orange}; font-weight: bold;">Week ${week.week_number}</span>
        <span style="font-size: 16px; font-weight: 600; color: ${brand.cream};">${escapeHtml(week.theme)}</span>
      </div>
      <p style="font-size: 13px; color: #D4D2C2; line-height: 1.6; margin-bottom: 12px;">${escapeHtml(week.why_this_week)}</p>

      ${week.content_angles.length > 0 ? `
        <div style="margin-bottom: 12px;">
          <h4 style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #807F73; margin-bottom: 6px;">Content Angles</h4>
          ${anglesHtml}
        </div>
      ` : ""}

      ${week.channel_mix.length > 0 ? `
        <div style="margin-bottom: 12px;">
          <h4 style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #807F73; margin-bottom: 6px;">Channels</h4>
          <div>${channelsHtml}</div>
        </div>
      ` : ""}

      <div style="margin-bottom: 12px;">
        <h4 style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #807F73; margin-bottom: 6px;">Tasks</h4>
        ${tasksHtml}
      </div>

      <div style="background: #252320; padding: 14px; border-radius: 6px;">
        <div style="margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 600; color: ${brand.orange};">Success signal</span>
          <p style="font-size: 12px; color: #D4D2C2; margin: 2px 0 0;">${escapeHtml(week.success_signal)}</p>
        </div>
        <div>
          <span style="font-size: 11px; font-weight: 600; color: #807F73;">Fallback</span>
          <p style="font-size: 12px; color: #807F73; margin: 2px 0 0;">${escapeHtml(week.fallback)}</p>
        </div>
      </div>
    </div>
  `;
}

export function buildPlanPdfHtml(input: PlanPdfInput): string {
  const { businessName, planIntro, weeks, approvedAtMs } = input;
  const monthYear = formatMonthYear(approvedAtMs);

  const weeksHtml = weeks.map(renderWeekHtml).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: ${brand.charcoal};
      color: ${brand.cream};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .cover {
      width: 210mm;
      height: 297mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 40mm;
      page-break-after: always;
      position: relative;
    }
    .cover .mark {
      position: absolute;
      top: 30mm;
      left: 40mm;
      font-size: 14px;
      font-weight: bold;
      color: ${brand.red};
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .cover .business-name {
      font-size: 42px;
      font-weight: 800;
      line-height: 1.1;
      color: ${brand.cream};
      margin-bottom: 16px;
    }
    .cover .date-line {
      font-size: 14px;
      color: #807F73;
      margin-bottom: 6px;
    }
    .cover .subtitle {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #807F73;
    }

    .content-page {
      padding: 22mm 28mm 28mm;
      position: relative;
    }

    .closing {
      width: 210mm;
      height: 297mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-before: always;
    }
    .closing .sprinkle {
      font-size: 22px;
      font-weight: 600;
      color: ${brand.cream};
      text-align: center;
      max-width: 400px;
      line-height: 1.4;
      margin-bottom: 24px;
    }
    .closing .mark {
      font-size: 12px;
      font-weight: bold;
      color: ${brand.red};
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    @media print {
      .page-footer {
        position: fixed;
        bottom: 12mm;
        left: 28mm;
        right: 28mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 9px;
      }
      .page-footer .mark { color: ${brand.red}; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
      .page-footer .page-num { color: #807F73; }
    }
  </style>
</head>
<body>

  <!-- Cover page -->
  <div class="cover">
    <div class="mark">SuperBad</div>
    <div class="business-name">${escapeHtml(businessName)}</div>
    <div class="date-line">Strategy dated ${escapeHtml(monthYear)}</div>
    <div class="subtitle">Six-Week Plan</div>
  </div>

  <!-- Plan content -->
  <div class="content-page">
    <p style="font-size: 15px; line-height: 1.6; color: ${brand.cream}; margin-bottom: 32px;">
      ${escapeHtml(planIntro)}
    </p>
    ${weeksHtml}
  </div>

  <!-- Closing page -->
  <div class="closing">
    <div class="sprinkle">This plan belongs to you.<br/>So does the nerve to run it.</div>
    <div class="mark">SuperBad</div>
  </div>

  <!-- Footer for intermediate pages -->
  <div class="page-footer">
    <span class="mark">SuperBad</span>
    <span class="page-num"></span>
  </div>

</body>
</html>`;
}

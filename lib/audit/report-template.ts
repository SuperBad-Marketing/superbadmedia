import type { CategoryScore, OverallScore } from "./scoring";
import type { CategoryExplanations } from "./explanations";

export interface AuditReportInput {
  businessName: string;
  date: string;
  overall: OverallScore;
  categories: CategoryScore[];
  explanations: CategoryExplanations;
  recommendations: Record<string, string>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gradeColour(grade: string): string {
  if (grade.startsWith("A")) return "#2d6a4f";
  if (grade.startsWith("B")) return "#b5651d";
  if (grade.startsWith("C")) return "#d4740e";
  return "#c1121f";
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    advertising: "Advertising Presence",
    social: "Social Presence",
    website: "Website Quality",
    reputation: "Online Reputation",
    content: "Content Activity",
  };
  return labels[cat] ?? cat;
}

export function buildAuditReportHtml(input: AuditReportInput): string {
  const { businessName, date, overall, categories, explanations, recommendations } = input;

  const categoryRows = categories
    .map((c) => {
      const colour = c.available ? gradeColour(c.grade) : "#888";
      const explanation = escapeHtml(explanations[c.category] ?? "");
      const rec = recommendations[c.category]
        ? `<p style="margin:4px 0 0 0;color:#555;font-size:11px;">${escapeHtml(recommendations[c.category])}</p>`
        : "";
      return `
        <tr>
          <td style="padding:12px 8px;border-bottom:1px solid #e8e4df;">
            <strong>${escapeHtml(categoryLabel(c.category))}</strong>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e8e4df;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:${colour};">${escapeHtml(c.grade)}</span>
            <span style="font-size:12px;color:#888;margin-left:4px;">${c.score}/100</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:4px 8px 16px 8px;font-size:13px;color:#444;line-height:1.5;">
            ${explanation}${rec}
          </td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 18mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2a2a2a; background: #faf8f5; line-height: 1.6; }
  .page { page-break-after: always; padding: 40px 0; }
  .page:last-child { page-break-after: avoid; }
  .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 700px; text-align: center; }
  .mark { font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: #888; margin-bottom: 60px; }
  .cover h1 { font-size: 36px; font-weight: 300; margin-bottom: 12px; }
  .cover .company { font-size: 24px; color: #555; margin-bottom: 8px; }
  .cover .date { font-size: 14px; color: #999; }
  .overall { text-align: center; margin: 40px 0; }
  .overall .grade { font-size: 72px; font-weight: 700; }
  .overall .summary { font-size: 16px; color: #555; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; }
  .cta-page { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 600px; text-align: center; }
  .cta-page h2 { font-size: 24px; font-weight: 300; margin-bottom: 16px; }
  .cta-page .email { font-size: 16px; color: #555; }
</style>
</head>
<body>
  <!-- Page 1: Cover -->
  <div class="page cover">
    <div class="mark">SUPERBAD</div>
    <h1>Marketing Audit</h1>
    <div class="company">${escapeHtml(businessName)}</div>
    <div class="date">${escapeHtml(date)}</div>
  </div>

  <!-- Page 2: Scorecard -->
  <div class="page">
    <div class="overall">
      <div class="grade" style="color:${gradeColour(overall.grade)};">${escapeHtml(overall.grade)}</div>
      <div class="summary">Overall score: ${overall.score}/100</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #2a2a2a;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Category</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #2a2a2a;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Grade</th>
        </tr>
      </thead>
      <tbody>
        ${categoryRows}
      </tbody>
    </table>
  </div>

  <!-- Page 3: Soft CTA -->
  <div class="page cta-page">
    <h2>Want to talk through this?</h2>
    <div class="email">andy@superbadmedia.com.au</div>
  </div>
</body>
</html>`;
}

export function auditPdfFilename(businessName: string): string {
  const slug = businessName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `SuperBad-Marketing-Audit-${slug}.pdf`;
}

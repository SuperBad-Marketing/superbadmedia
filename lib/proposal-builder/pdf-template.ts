/**
 * Proposal PDF template — self-contained HTML for Puppeteer render.
 *
 * A4 portrait, brand charcoal background, cream text. Each section type
 * has its own layout handler. The HTML is inline-styled (no external CSS)
 * so it renders identically in any headless Chrome.
 */

import type { ProposalRow } from "@/lib/db/schema/proposals";
import type {
  ProposalSection,
  CoverSection,
  OpportunitySection,
  ConceptSection,
  EcosystemSection,
  AdvantagesSection,
  InvestmentSection,
  NextStepsSection,
  TextBlockSection,
  TwoColumnSection,
} from "./content-shape";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND = {
  charcoal: "#1A1A18",
  cream: "#FDF5E6",
  red: "#B22848",
  pink: "#F4A0B0",
  orange: "#F28C52",
  darkSurface: "#252320",
  midSurface: "#332F2A",
  mutedText: "#807F73",
};

function renderCover(s: CoverSection): string {
  const d = s.data;
  const detailsHtml = d.details
    .filter((x) => x.value)
    .map(
      (x) => `
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="font-size:9px;letter-spacing:2px;color:${BRAND.mutedText};text-transform:uppercase;">${esc(x.label)}</div>
        <div style="font-size:13px;color:${BRAND.cream};">${esc(x.value)}</div>
      </div>`,
    )
    .join("");

  return `
    <div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;min-height:100vh;padding:60px 50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:40px;">SUPERBAD MARKETING</div>
      <div style="font-size:10px;letter-spacing:2px;color:${BRAND.mutedText};text-transform:uppercase;margin-bottom:8px;">PILOT EPISODE PROPOSAL</div>
      <h1 style="font-size:42px;font-weight:800;color:${BRAND.cream};line-height:1.05;margin:0 0 8px 0;letter-spacing:-0.5px;">${esc(d.title)}</h1>
      ${d.subtitle ? `<p style="font-size:16px;color:${BRAND.pink};line-height:1.4;margin:0 0 40px 0;">${esc(d.subtitle)}</p>` : '<div style="margin-bottom:40px;"></div>'}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px 48px;margin-bottom:auto;">${detailsHtml}</div>
      <div style="margin-top:60px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-size:9px;letter-spacing:2px;color:${BRAND.mutedText};text-transform:uppercase;">PREPARED BY</div>
          <div style="font-size:13px;color:${BRAND.cream};margin-top:4px;">${esc(d.prepared_by)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;letter-spacing:2px;color:${BRAND.mutedText};text-transform:uppercase;">DATE</div>
          <div style="font-size:13px;color:${BRAND.cream};margin-top:4px;">${esc(d.date)}</div>
        </div>
      </div>
      <div style="margin-top:24px;font-size:9px;color:${BRAND.mutedText};text-align:center;">
        SuperBad Marketing · Melbourne, Australia
      </div>
      ${d.confidentiality_line ? `<div style="margin-top:8px;font-size:8px;color:${BRAND.mutedText};text-align:center;text-transform:uppercase;letter-spacing:1.5px;">${esc(d.confidentiality_line)}</div>` : ""}
    </div>`;
}

function renderOpportunity(s: OpportunitySection): string {
  const d = s.data;
  const statsHtml = d.stats
    .filter((x) => x.value)
    .map(
      (x) => `
      <div style="text-align:center;">
        <div style="font-size:28px;font-weight:800;color:${BRAND.cream};letter-spacing:-0.5px;">${esc(x.value)}</div>
        <div style="font-size:10px;color:${BRAND.mutedText};margin-top:4px;line-height:1.3;">${esc(x.label)}</div>
      </div>`,
    )
    .join("");

  return `
    <div style="page-break-after:always;padding:50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:6px;">SUPERBAD MARKETING</div>
      <h2 style="font-size:28px;font-weight:800;color:${BRAND.cream};margin:0 0 4px 0;">${esc(d.heading)}</h2>
      ${d.subheading ? `<p style="font-size:13px;color:${BRAND.pink};margin:0 0 28px 0;">${esc(d.subheading)}</p>` : '<div style="margin-bottom:28px;"></div>'}
      <div style="display:grid;grid-template-columns:repeat(${Math.min(d.stats.length, 4)},1fr);gap:20px;padding:20px 0;border-top:1px solid ${BRAND.midSurface};border-bottom:1px solid ${BRAND.midSurface};margin-bottom:28px;">
        ${statsHtml}
      </div>
      <h3 style="font-size:16px;font-weight:700;color:${BRAND.cream};margin:0 0 8px 0;">${esc(d.problem_heading)}</h3>
      <p style="font-size:12px;color:${BRAND.cream};line-height:1.6;margin:0 0 24px 0;opacity:0.85;">${esc(d.problem_body)}</p>
      <h3 style="font-size:16px;font-weight:700;color:${BRAND.cream};margin:0 0 8px 0;">${esc(d.insight_heading)}</h3>
      <p style="font-size:12px;color:${BRAND.cream};line-height:1.6;margin:0 0 24px 0;opacity:0.85;">${esc(d.insight_body)}</p>
      ${d.pull_quote ? `<blockquote style="border-left:3px solid ${BRAND.red};padding:12px 20px;margin:20px 0 0 0;font-style:italic;font-size:14px;color:${BRAND.pink};line-height:1.5;">${esc(d.pull_quote)}</blockquote>` : ""}
    </div>`;
}

function renderConcept(s: ConceptSection): string {
  const d = s.data;
  const isItems = d.what_it_is
    .filter(Boolean)
    .map((x) => `<li style="margin-bottom:6px;">${esc(x)}</li>`)
    .join("");
  const isntItems = d.what_it_isnt
    .filter(Boolean)
    .map((x) => `<li style="margin-bottom:6px;">${esc(x)}</li>`)
    .join("");

  return `
    <div style="page-break-after:always;padding:50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:6px;">SUPERBAD MARKETING</div>
      <h2 style="font-size:28px;font-weight:800;color:${BRAND.cream};margin:0 0 4px 0;">${esc(d.heading)}</h2>
      ${d.subheading ? `<p style="font-size:13px;color:${BRAND.pink};margin:0 0 28px 0;">${esc(d.subheading)}</p>` : '<div style="margin-bottom:28px;"></div>'}
      <h3 style="font-size:20px;font-weight:700;color:${BRAND.cream};margin:0 0 10px 0;">${esc(d.concept_title)}</h3>
      <p style="font-size:12px;color:${BRAND.cream};line-height:1.6;margin:0 0 24px 0;opacity:0.85;">${esc(d.concept_description)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:24px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:${BRAND.cream};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">What it is</div>
          <ul style="margin:0;padding-left:16px;font-size:12px;color:${BRAND.cream};line-height:1.5;opacity:0.85;">${isItems}</ul>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:${BRAND.cream};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">What it isn't</div>
          <ul style="margin:0;padding-left:16px;font-size:12px;color:${BRAND.cream};line-height:1.5;opacity:0.85;">${isntItems}</ul>
        </div>
      </div>
      ${d.extras_heading ? `<h3 style="font-size:16px;font-weight:700;color:${BRAND.cream};margin:20px 0 8px 0;">${esc(d.extras_heading)}</h3>` : ""}
      ${d.extras_body ? `<p style="font-size:12px;color:${BRAND.cream};line-height:1.6;opacity:0.85;">${esc(d.extras_body)}</p>` : ""}
    </div>`;
}

function renderEcosystem(s: EcosystemSection): string {
  const d = s.data;
  const layersHtml = d.layers
    .map(
      (layer, i) => `
      <div style="background:${i % 2 === 0 ? BRAND.darkSurface : BRAND.midSurface};border-radius:8px;padding:16px 20px;text-align:center;">
        <div style="font-size:9px;letter-spacing:2px;color:${BRAND.mutedText};text-transform:uppercase;margin-bottom:8px;">${esc(layer.label)}</div>
        <div style="font-size:12px;color:${BRAND.cream};line-height:1.5;">${layer.items.filter(Boolean).map(esc).join(" · ")}</div>
      </div>
      ${i < d.layers.length - 1 ? `<div style="text-align:center;color:${BRAND.red};font-size:18px;padding:4px 0;">↓</div>` : ""}`,
    )
    .join("");

  return `
    <div style="page-break-after:always;padding:50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:6px;">SUPERBAD MARKETING</div>
      <h2 style="font-size:28px;font-weight:800;color:${BRAND.cream};margin:0 0 4px 0;">${esc(d.heading)}</h2>
      ${d.subheading ? `<p style="font-size:13px;color:${BRAND.pink};margin:0 0 28px 0;">${esc(d.subheading)}</p>` : '<div style="margin-bottom:28px;"></div>'}
      <div style="display:flex;flex-direction:column;gap:0;">${layersHtml}</div>
      ${d.footnote ? `<p style="font-size:11px;color:${BRAND.mutedText};text-align:center;margin-top:24px;font-style:italic;">${esc(d.footnote)}</p>` : ""}
    </div>`;
}

function renderAdvantages(s: AdvantagesSection): string {
  const d = s.data;
  const advHtml = d.advantages
    .filter((a) => a.title)
    .map(
      (a, i) => `
      <div style="padding:16px 0;${i > 1 ? "border-top:1px solid " + BRAND.midSurface + ";" : ""}">
        <div style="font-size:9px;color:${BRAND.red};font-weight:700;margin-bottom:6px;">${String(i + 1).padStart(2, "0")}</div>
        <div style="font-size:14px;font-weight:700;color:${BRAND.cream};margin-bottom:6px;">${esc(a.title)}</div>
        <p style="font-size:11px;color:${BRAND.cream};line-height:1.5;margin:0;opacity:0.8;">${esc(a.body)}</p>
      </div>`,
    )
    .join("");

  return `
    <div style="page-break-after:always;padding:50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:6px;">SUPERBAD MARKETING</div>
      <h2 style="font-size:28px;font-weight:800;color:${BRAND.cream};margin:0 0 4px 0;">${esc(d.heading)}</h2>
      ${d.subheading ? `<p style="font-size:13px;color:${BRAND.pink};margin:0 0 28px 0;">${esc(d.subheading)}</p>` : '<div style="margin-bottom:28px;"></div>'}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 40px;">${advHtml}</div>
    </div>`;
}

function renderInvestment(s: InvestmentSection): string {
  const d = s.data;
  const optionsHtml = d.options
    .map((opt) => {
      const items = opt.line_items
        .filter(Boolean)
        .map(
          (li) =>
            `<div style="font-size:11px;color:${BRAND.cream};opacity:0.85;padding:4px 0;border-bottom:1px solid ${BRAND.midSurface};">• ${esc(li)}</div>`,
        )
        .join("");

      return `
        <div style="background:${BRAND.darkSurface};border-radius:8px;padding:24px;${opt.recommended ? "border:1px solid " + BRAND.red + ";" : "border:1px solid " + BRAND.midSurface + ";"}">
          ${opt.recommended ? `<div style="font-size:9px;letter-spacing:2px;color:${BRAND.red};text-transform:uppercase;margin-bottom:12px;">RECOMMENDED</div>` : ""}
          <div style="font-size:16px;font-weight:700;color:${BRAND.cream};margin-bottom:16px;">${esc(opt.name)}</div>
          ${items}
          ${opt.market_value ? `<div style="font-size:11px;color:${BRAND.mutedText};margin-top:16px;">Market value: ${esc(opt.market_value)}</div>` : ""}
          <div style="font-size:9px;letter-spacing:2px;color:${BRAND.mutedText};text-transform:uppercase;margin-top:8px;">PILOT PRICE</div>
          <div style="font-size:28px;font-weight:800;color:${BRAND.cream};margin-top:4px;">${esc(opt.price)}${opt.price_suffix ? `<span style="font-size:14px;font-weight:400;color:${BRAND.mutedText};margin-left:4px;">${esc(opt.price_suffix)}</span>` : ""}</div>
        </div>`;
    })
    .join("");

  return `
    <div style="page-break-after:always;padding:50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:6px;">SUPERBAD MARKETING</div>
      <h2 style="font-size:28px;font-weight:800;color:${BRAND.cream};margin:0 0 4px 0;">${esc(d.heading)}</h2>
      ${d.subheading ? `<p style="font-size:13px;color:${BRAND.pink};margin:0 0 12px 0;">${esc(d.subheading)}</p>` : ""}
      ${d.intro ? `<p style="font-size:12px;color:${BRAND.cream};line-height:1.6;margin:0 0 24px 0;opacity:0.85;">${esc(d.intro)}</p>` : '<div style="margin-bottom:24px;"></div>'}
      <div style="display:grid;grid-template-columns:repeat(${Math.min(d.options.length, 2)},1fr);gap:20px;">${optionsHtml}</div>
      ${d.ad_spend_note ? `<div style="background:${BRAND.midSurface};border-radius:8px;padding:16px 20px;margin-top:20px;"><div style="font-size:11px;font-weight:700;color:${BRAND.cream};margin-bottom:4px;">Recommended Ad Spend</div><div style="font-size:11px;color:${BRAND.cream};opacity:0.8;">${esc(d.ad_spend_note)}</div></div>` : ""}
    </div>`;
}

function renderNextSteps(s: NextStepsSection): string {
  const d = s.data;
  const stepsHtml = d.steps
    .filter((x) => x.title)
    .map(
      (step, i) => `
      <div style="display:flex;gap:16px;padding:14px 0;${i > 0 ? "border-top:1px solid " + BRAND.midSurface + ";" : ""}">
        <div style="font-size:20px;font-weight:800;color:${BRAND.red};min-width:28px;">${String(i + 1).padStart(2, "0")}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:${BRAND.cream};">${esc(step.title)}</div>
          ${step.description ? `<div style="font-size:11px;color:${BRAND.cream};opacity:0.75;margin-top:4px;line-height:1.4;">${esc(step.description)}</div>` : ""}
        </div>
      </div>`,
    )
    .join("");

  return `
    <div style="padding:50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:6px;">SUPERBAD MARKETING</div>
      <h2 style="font-size:28px;font-weight:800;color:${BRAND.cream};margin:0 0 28px 0;">NEXT STEPS</h2>
      ${stepsHtml}
      ${d.about_heading ? `<div style="margin-top:32px;padding-top:20px;border-top:1px solid ${BRAND.midSurface};"><div style="font-size:11px;font-weight:700;color:${BRAND.cream};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${esc(d.about_heading)}</div>${d.about_body ? `<p style="font-size:11px;color:${BRAND.cream};line-height:1.6;margin:0;opacity:0.8;">${esc(d.about_body)}</p>` : ""}</div>` : ""}
      ${d.cta_line || d.cta_email ? `<div style="margin-top:28px;text-align:center;"><div style="font-size:14px;font-weight:700;color:${BRAND.cream};">${d.cta_line ? esc(d.cta_line) : ""}</div>${d.cta_email ? `<div style="font-size:12px;color:${BRAND.pink};margin-top:6px;">${esc(d.cta_email)}${d.cta_url ? ` · ${esc(d.cta_url)}` : ""}</div>` : ""}</div>` : ""}
    </div>`;
}

function renderTextBlock(s: TextBlockSection): string {
  const d = s.data;
  return `
    <div style="page-break-after:always;padding:50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:6px;">SUPERBAD MARKETING</div>
      <h2 style="font-size:28px;font-weight:800;color:${BRAND.cream};margin:0 0 4px 0;">${esc(d.heading)}</h2>
      ${d.subheading ? `<p style="font-size:13px;color:${BRAND.pink};margin:0 0 28px 0;">${esc(d.subheading)}</p>` : '<div style="margin-bottom:28px;"></div>'}
      <p style="font-size:12px;color:${BRAND.cream};line-height:1.7;margin:0;opacity:0.85;white-space:pre-wrap;">${esc(d.body)}</p>
    </div>`;
}

function renderTwoColumn(s: TwoColumnSection): string {
  const d = s.data;
  const leftHtml = d.left_items
    .filter(Boolean)
    .map(
      (x) =>
        `<div style="font-size:12px;color:${BRAND.cream};opacity:0.85;padding:5px 0;">• ${esc(x)}</div>`,
    )
    .join("");
  const rightHtml = d.right_items
    .filter(Boolean)
    .map(
      (x) =>
        `<div style="font-size:12px;color:${BRAND.cream};opacity:0.85;padding:5px 0;">• ${esc(x)}</div>`,
    )
    .join("");

  return `
    <div style="page-break-after:always;padding:50px;">
      <div style="font-size:10px;letter-spacing:3px;color:${BRAND.red};text-transform:uppercase;margin-bottom:6px;">SUPERBAD MARKETING</div>
      <h2 style="font-size:28px;font-weight:800;color:${BRAND.cream};margin:0 0 4px 0;">${esc(d.heading)}</h2>
      ${d.subheading ? `<p style="font-size:13px;color:${BRAND.pink};margin:0 0 28px 0;">${esc(d.subheading)}</p>` : '<div style="margin-bottom:28px;"></div>'}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:${BRAND.cream};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">${esc(d.left_heading)}</div>
          ${leftHtml}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:${BRAND.cream};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">${esc(d.right_heading)}</div>
          ${rightHtml}
        </div>
      </div>
    </div>`;
}

function renderSection(section: ProposalSection): string {
  switch (section.type) {
    case "cover":
      return renderCover(section);
    case "opportunity":
      return renderOpportunity(section);
    case "concept":
      return renderConcept(section);
    case "ecosystem":
      return renderEcosystem(section);
    case "advantages":
      return renderAdvantages(section);
    case "investment":
      return renderInvestment(section);
    case "next_steps":
      return renderNextSteps(section);
    case "text_block":
      return renderTextBlock(section);
    case "two_column":
      return renderTwoColumn(section);
  }
}

export function buildProposalPdfHtml(
  proposal: ProposalRow,
  sections: ProposalSection[],
): string {
  const sectionsHtml = sections.map(renderSection).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: ${BRAND.charcoal};
    color: ${BRAND.cream};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
</style>
</head>
<body>${sectionsHtml}</body>
</html>`;
}

export function proposalFilename(clientName: string, number: string): string {
  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `SuperBad-Proposal-${slug}-${number}.pdf`;
}

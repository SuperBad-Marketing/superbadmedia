/**
 * Brand Pack PDF template, self-contained HTML for Puppeteer rendering.
 *
 * Pages:
 *   1. Cover, brand name, "Brand Pack", SuperBad mark, date
 *   2. Identity Summary, first impression + prose portrait excerpt
 *   3. Colour Palette, 5 role-colours with hex + usage
 *   4. Typography, primary / secondary / accent fonts with specimens
 *   5. Content Pillars, 4-5 pillars with descriptions
 *   6. Brand Voice Guide, tone, do's/don'ts, example phrases
 *   7. Digital Presence Audit, enrichment snapshot (conditional)
 *   8. Back Cover, SuperBad branding + tagline
 *
 * Dark charcoal (#1A1A18) background, cream text, editorial feel.
 * Google Fonts loaded via @import. Each page uses page-break-after.
 *
 * Owner: BDA-PACK.
 */

import type { BrandPackData } from "./generate";

// ── Helpers ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1A1A18" : "#FDF5E6";
}

// ── Brand tokens ───────────────────────────────────────────────────────

const B = {
  charcoal: "#1A1A18",
  cream: "#FDF5E6",
  red: "#B22848",
  pink: "#F4A0B0",
  orange: "#F28C52",
  surface: "#252320",
  surfaceMid: "#332F2A",
  muted: "#807F73",
  subtle: "#5A584F",
};

// ── Font import URL ────────────────────────────────────────────────────

function fontImportUrl(data: BrandPackData): string {
  const families = [
    "Black+Han+Sans",
    "Righteous",
    "Playfair+Display:wght@400;500;600;700",
    "DM+Sans:wght@300;400;500;600;700",
  ];

  // Add the recommended fonts
  const recommended = [data.primaryFont.name, data.secondaryFont.name];
  if (data.accentFont) recommended.push(data.accentFont.name);
  for (const name of recommended) {
    const encoded = name.replace(/\s+/g, "+");
    families.push(`${encoded}:wght@300;400;500;600;700`);
  }

  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
}

// ── Page footer ────────────────────────────────────────────────────────

function pageFooter(pageNum: number): string {
  return `
    <div style="position:absolute;bottom:40px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-family:'Righteous',sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${B.subtle};">SUPERBAD</span>
      <span style="font-family:'DM Sans',sans-serif;font-size:10px;color:${B.subtle};">${pageNum}</span>
    </div>`;
}

// ── Page 1: Cover ──────────────────────────────────────────────────────

function renderCover(data: BrandPackData): string {
  return `
  <div class="page" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
    <div style="font-family:'Righteous',sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${B.subtle};margin-bottom:100px;">SUPERBAD</div>
    <div style="font-family:'Black Han Sans',sans-serif;font-size:56px;color:${B.cream};line-height:1.05;letter-spacing:-1px;margin-bottom:20px;">${esc(data.subjectName)}</div>
    <div style="font-family:'Righteous',sans-serif;font-size:16px;letter-spacing:4px;text-transform:uppercase;color:${B.red};">Brand Pack</div>
    <div style="position:absolute;bottom:56px;display:flex;flex-direction:column;align-items:center;gap:8px;">
      <span style="font-family:'DM Sans',sans-serif;font-size:11px;color:${B.muted};">Prepared by SuperBad Marketing</span>
      <span style="font-family:'DM Sans',sans-serif;font-size:11px;color:${B.subtle};">${esc(data.generatedDate)}</span>
    </div>
  </div>`;
}

// ── Page 2: Identity Summary ───────────────────────────────────────────

function renderIdentitySummary(data: BrandPackData): string {
  const portraitParagraphs = data.prosePortraitExcerpt
    ? data.prosePortraitExcerpt
        .split(/\n\n+/)
        .filter((p) => p.trim().length > 0)
        .map(
          (p) =>
            `<p style="font-family:'Playfair Display',serif;font-size:14px;line-height:1.85;color:${B.cream};opacity:0.8;margin-bottom:16px;">${esc(p.trim())}</p>`,
        )
        .join("")
    : "";

  return `
  <div class="page">
    <div class="section-label">01 ·Identity</div>
    ${
      data.firstImpression
        ? `<div style="font-family:'Playfair Display',serif;font-size:28px;font-weight:500;line-height:1.35;color:${B.cream};margin-bottom:48px;max-width:480px;">&ldquo;${esc(data.firstImpression)}&rdquo;</div>`
        : ""
    }
    ${
      portraitParagraphs
        ? `<div style="border-top:1px solid ${B.surfaceMid};padding-top:32px;max-width:500px;">
            <div style="font-family:'Righteous',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${B.muted};margin-bottom:20px;">FROM YOUR BRAND DNA</div>
            ${portraitParagraphs}
          </div>`
        : ""
    }
    ${pageFooter(2)}
  </div>`;
}

// ── Page 3: Colour Palette ─────────────────────────────────────────────

function renderColourPalette(data: BrandPackData): string {
  const c = data.colours;
  const entries = [
    { role: "Primary", ...c.primary },
    { role: "Secondary", ...c.secondary },
    { role: "Accent", ...c.accent },
    { role: "Neutral", ...c.neutral },
    { role: "Background", ...c.background },
  ];

  const swatches = entries
    .map(
      (entry) => `
      <div style="flex:1;min-width:120px;">
        <div style="background:${esc(entry.hex)};height:110px;border-radius:10px;margin-bottom:14px;display:flex;align-items:flex-end;padding:12px;border:1px solid rgba(253,245,230,0.06);">
          <span style="font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:${contrastText(entry.hex)};letter-spacing:0.5px;">${esc(entry.hex)}</span>
        </div>
        <div style="font-family:'Righteous',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${B.muted};margin-bottom:4px;">${esc(entry.role)}</div>
        <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:500;color:${B.cream};margin-bottom:6px;">${esc(entry.name)}</div>
        <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:${B.muted};line-height:1.5;">${esc(entry.usage)}</div>
      </div>`,
    )
    .join("");

  const grades = data.colourGrades
    .map(
      (g) => `
      <div style="flex:1;min-width:50px;text-align:center;">
        <div style="background:${esc(g.hex)};height:44px;border-radius:6px;margin-bottom:6px;border:1px solid rgba(253,245,230,0.04);"></div>
        <div style="font-family:'DM Sans',sans-serif;font-size:9px;color:${B.muted};font-weight:500;">${esc(g.hex)}</div>
        <div style="font-family:'DM Sans',sans-serif;font-size:8px;color:${B.subtle};margin-top:2px;">${esc(g.label)}</div>
      </div>`,
    )
    .join("");

  return `
  <div class="page">
    <div class="section-label">02 ·Colour</div>
    <div class="section-title">Brand Palette</div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:48px;">
      ${swatches}
    </div>
    <div style="border-top:1px solid ${B.surfaceMid};padding-top:28px;">
      <div style="font-family:'Righteous',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${B.muted};margin-bottom:16px;">COLOUR GRADES</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${grades}
      </div>
    </div>
    ${pageFooter(3)}
  </div>`;
}

// ── Page 4: Typography ─────────────────────────────────────────────────

function renderTypography(data: BrandPackData): string {
  const fonts = [
    { label: "Primary Typeface", font: data.primaryFont },
    { label: "Secondary Typeface", font: data.secondaryFont },
    ...(data.accentFont
      ? [{ label: "Accent Typeface", font: data.accentFont }]
      : []),
  ];

  const cards = fonts
    .map(
      ({ label, font }) => `
      <div style="margin-bottom:44px;">
        <div style="font-family:'Righteous',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${B.muted};margin-bottom:14px;">${esc(label)}</div>
        <div style="font-family:'${esc(font.name)}',sans-serif;font-size:38px;font-weight:400;line-height:1.2;color:${B.cream};margin-bottom:10px;">
          ${esc(font.name)}
        </div>
        <div style="font-family:'${esc(font.name)}',sans-serif;font-size:16px;font-weight:300;color:${B.muted};line-height:1.7;margin-bottom:8px;">
          Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn
        </div>
        <div style="font-family:'${esc(font.name)}',sans-serif;font-size:13px;color:${B.subtle};line-height:1.6;margin-bottom:10px;">
          0123456789 &amp; @ # $ % ! ?
        </div>
        <div style="font-family:'DM Sans',sans-serif;font-size:12px;color:${B.muted};line-height:1.5;max-width:460px;">
          <span style="font-weight:600;color:${B.pink};">${esc(font.category)}</span> , ${esc(font.reason)}
        </div>
      </div>`,
    )
    .join("");

  return `
  <div class="page">
    <div class="section-label">03 ·Typography</div>
    <div class="section-title">Typefaces</div>
    ${cards}
    ${pageFooter(4)}
  </div>`;
}

// ── Page 5: Content Pillars ────────────────────────────────────────────

function renderContentPillars(data: BrandPackData): string {
  if (!data.contentPillars || data.contentPillars.length === 0) return "";

  const pillars = data.contentPillars
    .map(
      (p, i) => `
      <div style="padding:24px 0;${i > 0 ? `border-top:1px solid ${B.surfaceMid};` : ""}">
        <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:10px;">
          <span style="font-family:'Righteous',sans-serif;font-size:10px;color:${B.red};font-weight:400;">${String(i + 1).padStart(2, "0")}</span>
          <span style="font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:${B.cream};">${esc(p.name)}</span>
        </div>
        <p style="font-family:'DM Sans',sans-serif;font-size:13px;color:${B.cream};opacity:0.75;line-height:1.7;margin:0;padding-left:36px;max-width:480px;">${esc(p.description)}</p>
      </div>`,
    )
    .join("");

  return `
  <div class="page">
    <div class="section-label">04 ·Content</div>
    <div class="section-title">Content Pillars</div>
    <p style="font-family:'DM Sans',sans-serif;font-size:13px;color:${B.muted};margin-bottom:32px;max-width:480px;line-height:1.6;">
      The recurring themes that anchor your content strategy. Every post, article, or campaign should trace back to one of these.
    </p>
    ${pillars}
    ${pageFooter(5)}
  </div>`;
}

// ── Page 6: Brand Voice Guide ──────────────────────────────────────────

function renderBrandVoice(data: BrandPackData): string {
  if (!data.brandVoice || !data.brandVoice.tone) return "";

  const doItems = (data.brandVoice.doList ?? [])
    .map(
      (item) =>
        `<div style="padding:8px 0;font-family:'DM Sans',sans-serif;font-size:12px;color:${B.cream};opacity:0.85;line-height:1.5;display:flex;gap:10px;align-items:flex-start;">
          <span style="color:${B.orange};font-size:14px;flex-shrink:0;margin-top:1px;">+</span>
          <span>${esc(item)}</span>
        </div>`,
    )
    .join("");

  const dontItems = (data.brandVoice.dontList ?? [])
    .map(
      (item) =>
        `<div style="padding:8px 0;font-family:'DM Sans',sans-serif;font-size:12px;color:${B.cream};opacity:0.85;line-height:1.5;display:flex;gap:10px;align-items:flex-start;">
          <span style="color:${B.red};font-size:14px;flex-shrink:0;margin-top:1px;">&times;</span>
          <span>${esc(item)}</span>
        </div>`,
    )
    .join("");

  const phrases = (data.brandVoice.examplePhrases ?? [])
    .map(
      (phrase) =>
        `<div style="padding:10px 16px;background:${B.surface};border-radius:8px;border-left:2px solid ${B.red};margin-bottom:10px;">
          <p style="font-family:'Playfair Display',serif;font-style:italic;font-size:14px;color:${B.cream};line-height:1.6;margin:0;">&ldquo;${esc(phrase)}&rdquo;</p>
        </div>`,
    )
    .join("");

  return `
  <div class="page">
    <div class="section-label">05 ·Voice</div>
    <div class="section-title">Brand Voice Guide</div>
    <p style="font-family:'Playfair Display',serif;font-size:15px;color:${B.cream};line-height:1.8;margin-bottom:36px;max-width:500px;opacity:0.85;">
      ${esc(data.brandVoice.tone)}
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:36px;">
      <div>
        <div style="font-family:'Righteous',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${B.orange};margin-bottom:12px;">DO</div>
        ${doItems}
      </div>
      <div>
        <div style="font-family:'Righteous',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${B.red};margin-bottom:12px;">DON'T</div>
        ${dontItems}
      </div>
    </div>
    ${
      phrases
        ? `<div style="border-top:1px solid ${B.surfaceMid};padding-top:24px;">
            <div style="font-family:'Righteous',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${B.muted};margin-bottom:16px;">HOW YOU SOUND</div>
            ${phrases}
          </div>`
        : ""
    }
    ${pageFooter(6)}
  </div>`;
}

// ── Page 7: Digital Presence Audit (conditional) ───────────────────────

function renderDigitalPresence(data: BrandPackData, pageNum: number): string {
  if (!data.enrichmentSnapshot || data.enrichmentSnapshot.facts.length === 0) {
    return "";
  }

  const facts = data.enrichmentSnapshot.facts
    .map(
      (fact, i) => `
      <div style="display:flex;gap:20px;align-items:flex-start;padding:20px 0;${i > 0 ? `border-top:1px solid ${B.surfaceMid};` : ""}">
        <span style="font-family:'Righteous',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${B.pink};white-space:nowrap;min-width:100px;padding-top:3px;">${esc(fact.label)}</span>
        <p style="font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.6;color:${B.cream};opacity:0.8;margin:0;">${esc(fact.observation)}</p>
      </div>`,
    )
    .join("");

  return `
  <div class="page">
    <div class="section-label">06 ·Digital Presence</div>
    <div class="section-title">What We Found</div>
    <p style="font-family:'Playfair Display',serif;font-style:italic;font-size:15px;color:${B.cream};opacity:0.6;margin-bottom:40px;max-width:440px;line-height:1.7;">
      Not a judgement. Just what&rsquo;s out there right now.
    </p>
    <div style="max-width:560px;">
      ${facts}
    </div>
    ${pageFooter(pageNum)}
  </div>`;
}

// ── Page 8: Back Cover ─────────────────────────────────────────────────

function renderBackCover(): string {
  return `
  <div class="page last-page" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
    <div style="font-family:'Black Han Sans',sans-serif;font-size:48px;color:${B.cream};letter-spacing:-1px;margin-bottom:20px;">SuperBad</div>
    <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:16px;color:${B.pink};line-height:1.6;max-width:360px;margin-bottom:48px;">
      Marketing for people who&rsquo;d rather be doing something else.
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;align-items:center;">
      <span style="font-family:'DM Sans',sans-serif;font-size:12px;color:${B.muted};">superbadmedia.com.au</span>
      <span style="font-family:'DM Sans',sans-serif;font-size:12px;color:${B.muted};">andy@superbadmedia.com.au</span>
    </div>
  </div>`;
}

// ── Main export ────────────────────────────────────────────────────────

export function buildBrandPackHtml(data: BrandPackData): string {
  const fontUrl = fontImportUrl(data);

  const hasDigitalPresence =
    data.enrichmentSnapshot && data.enrichmentSnapshot.facts.length > 0;
  const digitalPresencePageNum = hasDigitalPresence ? 7 : 0;

  const pages = [
    renderCover(data),
    renderIdentitySummary(data),
    renderColourPalette(data),
    renderTypography(data),
    renderContentPillars(data),
    renderBrandVoice(data),
    hasDigitalPresence
      ? renderDigitalPresence(data, digitalPresencePageNum)
      : "",
    renderBackCover(),
  ]
    .filter((p) => p.length > 0)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('${fontUrl}');

  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: ${B.cream};
    background: ${B.charcoal};
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 56px;
    page-break-after: always;
    position: relative;
    background: ${B.charcoal};
  }

  .last-page {
    page-break-after: avoid;
  }

  .section-label {
    font-family: 'Righteous', sans-serif;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: ${B.red};
    margin-bottom: 8px;
  }

  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 500;
    color: ${B.cream};
    margin-bottom: 36px;
    line-height: 1.3;
  }
</style>
</head>
<body>
${pages}
</body>
</html>`;
}

export function brandPackFilename(subjectName: string): string {
  const slug = subjectName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `SuperBad-Brand-Pack-${slug}.pdf`;
}

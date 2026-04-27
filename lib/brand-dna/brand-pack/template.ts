/**
 * Brand Pack PDF template — self-contained HTML for Puppeteer rendering.
 *
 * Pages:
 *   1. Cover — brand name, "Brand Pack", SuperBad mark
 *   2. Typography — primary / secondary / accent fonts with specimens
 *   3. Colour palette — 5 role-colours with hex + usage
 *   4. Colour grades — tint/shade ramp
 *   5. Creative direction — photography, tone, visual don'ts
 *   6. Prose portrait excerpt
 *   7. Back cover — soft CTA
 *
 * Owner: BDA-PACK.
 */

import type { BrandPackData } from "./generate";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fontImportUrl(data: BrandPackData): string {
  const families = [data.primaryFont.name, data.secondaryFont.name];
  if (data.accentFont) families.push(data.accentFont.name);
  const params = families
    .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

export function buildBrandPackHtml(data: BrandPackData): string {
  const fontUrl = fontImportUrl(data);
  const c = data.colours;

  const fontSections = [
    { label: "Primary Typeface", font: data.primaryFont },
    { label: "Secondary Typeface", font: data.secondaryFont },
    ...(data.accentFont
      ? [{ label: "Accent Typeface", font: data.accentFont }]
      : []),
  ];

  const fontCards = fontSections
    .map(
      ({ label, font }) => `
      <div style="margin-bottom:48px;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:12px;">${esc(label)}</div>
        <div style="font-family:'${esc(font.name)}',sans-serif;font-size:42px;font-weight:400;line-height:1.2;margin-bottom:8px;">
          ${esc(font.name)}
        </div>
        <div style="font-family:'${esc(font.name)}',sans-serif;font-size:18px;font-weight:300;color:#555;line-height:1.6;margin-bottom:6px;">
          Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz
        </div>
        <div style="font-family:'${esc(font.name)}',sans-serif;font-size:14px;color:#555;line-height:1.6;margin-bottom:6px;">
          0123456789 &amp; @ # $ % ! ?
        </div>
        <div style="font-size:13px;color:#777;line-height:1.5;max-width:500px;">
          <span style="font-weight:600;color:#1a1a1a;">${esc(font.category)}</span> — ${esc(font.reason)}
        </div>
      </div>`,
    )
    .join("");

  const colourEntries = [
    { role: "Primary", ...c.primary },
    { role: "Secondary", ...c.secondary },
    { role: "Accent", ...c.accent },
    { role: "Neutral", ...c.neutral },
    { role: "Background", ...c.background },
  ];

  const colourCards = colourEntries
    .map(
      (entry) => `
      <div style="flex:1;min-width:140px;">
        <div style="background:${esc(entry.hex)};height:120px;border-radius:8px;margin-bottom:12px;display:flex;align-items:flex-end;padding:10px;">
          <span style="font-size:12px;font-weight:600;color:${contrastText(entry.hex)};">${esc(entry.hex)}</span>
        </div>
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:4px;">${esc(entry.role)}</div>
        <div style="font-size:15px;font-weight:500;color:#1a1a1a;margin-bottom:4px;">${esc(entry.name)}</div>
        <div style="font-size:12px;color:#777;line-height:1.4;">${esc(entry.usage)}</div>
      </div>`,
    )
    .join("");

  const gradeSwatches = data.colourGrades
    .map(
      (g) => `
      <div style="flex:1;min-width:60px;text-align:center;">
        <div style="background:${esc(g.hex)};height:56px;border-radius:6px;margin-bottom:6px;border:1px solid rgba(0,0,0,0.06);"></div>
        <div style="font-size:10px;color:#888;font-weight:500;">${esc(g.hex)}</div>
        <div style="font-size:9px;color:#aaa;margin-top:2px;">${esc(g.label)}</div>
      </div>`,
    )
    .join("");

  const dontsList = data.visualDonts
    .map(
      (d) =>
        `<div style="padding:12px 0;border-bottom:1px solid #e8e4df;font-size:14px;color:#444;line-height:1.5;">✕ ${esc(d)}</div>`,
    )
    .join("");

  const portraitParagraphs = data.prosePortraitExcerpt
    ? data.prosePortraitExcerpt
        .split(/\n\n+/)
        .map(
          (p) =>
            `<p style="margin-bottom:16px;font-size:14px;line-height:1.8;color:#2a2a2a;">${esc(p.trim())}</p>`,
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="${fontUrl}">
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    background: #faf6ef;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 60px 56px;
    page-break-after: always;
    position: relative;
  }
  .page:last-child { page-break-after: avoid; }
  .page-number {
    position: absolute;
    bottom: 32px;
    right: 56px;
    font-size: 10px;
    color: #bbb;
    letter-spacing: 1px;
  }
  .section-label {
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 32px;
  }
  .section-title {
    font-size: 28px;
    font-weight: 300;
    color: #1a1a1a;
    margin-bottom: 40px;
    line-height: 1.3;
  }
</style>
</head>
<body>

  <!-- Page 1: Cover -->
  <div class="page" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:#1a1a1a;">
    <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#666;margin-bottom:80px;">SUPERBAD</div>
    <div style="font-size:48px;font-weight:300;color:#faf6ef;margin-bottom:16px;line-height:1.2;">${esc(data.subjectName)}</div>
    <div style="font-size:18px;font-weight:300;color:#888;letter-spacing:2px;text-transform:uppercase;">Brand Pack</div>
    <div style="position:absolute;bottom:48px;font-size:11px;color:#555;">Prepared by SuperBad Marketing</div>
  </div>

  <!-- Page 2: Typography -->
  <div class="page">
    <div class="section-label">01 — Typography</div>
    <div class="section-title">Typefaces</div>
    ${fontCards}
  </div>

  <!-- Page 3: Colour Palette -->
  <div class="page">
    <div class="section-label">02 — Colour</div>
    <div class="section-title">Brand Palette</div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;">
      ${colourCards}
    </div>
    <div class="page-number">03</div>
  </div>

  <!-- Page 4: Colour Grades -->
  <div class="page">
    <div class="section-label">02 — Colour</div>
    <div class="section-title">Colour Grades</div>
    <p style="font-size:13px;color:#777;margin-bottom:32px;max-width:480px;">
      Tints and shades for consistent application across digital and print surfaces.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${gradeSwatches}
    </div>
    <div class="page-number">04</div>
  </div>

  <!-- Page 5: Creative Direction -->
  <div class="page">
    <div class="section-label">03 — Creative Direction</div>
    <div class="section-title">Photography &amp; Imagery</div>
    <p style="font-size:15px;color:#2a2a2a;line-height:1.8;margin-bottom:48px;max-width:520px;">
      ${esc(data.photographyDirection)}
    </p>

    <div style="margin-bottom:48px;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:16px;">Tone of Voice</div>
      <p style="font-size:15px;color:#2a2a2a;line-height:1.8;max-width:520px;">
        ${esc(data.toneOfVoice)}
      </p>
    </div>

    <div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:16px;">Visual Don'ts</div>
      ${dontsList}
    </div>
    <div class="page-number">05</div>
  </div>

  <!-- Page 6: Prose Portrait Excerpt -->
  ${
    portraitParagraphs
      ? `<div class="page">
    <div class="section-label">04 — Brand Portrait</div>
    <div class="section-title">Who You Are</div>
    <div style="max-width:500px;">
      ${portraitParagraphs}
      <p style="font-size:12px;color:#aaa;margin-top:24px;font-style:italic;">Excerpt from Brand DNA profile.</p>
    </div>
    <div class="page-number">06</div>
  </div>`
      : ""
  }

  <!-- Back Cover -->
  <div class="page" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:#1a1a1a;">
    <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#666;margin-bottom:60px;">SUPERBAD</div>
    <div style="font-size:22px;font-weight:300;color:#faf6ef;margin-bottom:16px;">Questions about your brand pack?</div>
    <div style="font-size:15px;color:#888;">andy@superbadmedia.com.au</div>
  </div>

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

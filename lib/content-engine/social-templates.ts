/**
 * Content Engine — social image template library (spec §5.2 template path).
 *
 * Pure HTML-string builders (same pattern as `lib/quote-builder/pdf-template.ts`).
 * Each template accepts Brand DNA visual tokens + blog content and returns
 * self-contained HTML for Puppeteer screenshot rendering.
 *
 * Template library is code-versioned, not database-stored (spec §5.2).
 *
 * Owner: CE-5.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface BrandVisualTokens {
  /** Primary brand colour (hex). Defaults to SuperBad brand-red. */
  primaryColor: string;
  /** Secondary/accent colour (hex). */
  accentColor: string;
  /** Background colour (hex). */
  backgroundColor: string;
  /** Text colour (hex). */
  textColor: string;
  /** Brand name for attribution. */
  brandName: string;
  /** Optional logo URL. */
  logoUrl?: string;
}

export interface TemplateInput {
  /** Blog post title — used as headline. */
  headline: string;
  /** Short excerpt or key quote. */
  body: string;
  /** Brand visual tokens. */
  tokens: BrandVisualTokens;
  /** Optional URL for attribution. */
  url?: string;
}

export interface CarouselTemplateInput extends TemplateInput {
  slides: Array<{
    headline: string;
    body: string;
    slideNumber: number;
  }>;
}

export type TemplateId =
  | "quote-card"
  | "stat-highlight"
  | "listicle-card"
  | "branded-hero"
  | "carousel-slide";

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Platform → default single-image dimensions. */
export const PLATFORM_DIMENSIONS: Record<string, ImageDimensions> = {
  instagram: { width: 1080, height: 1080 },
  "instagram-portrait": { width: 1080, height: 1350 },
  linkedin: { width: 1200, height: 627 },
  x: { width: 1200, height: 675 },
  facebook: { width: 1200, height: 630 },
};

// ── Template registry ────────────────────────────────────────────────────────

/**
 * Render a named template to self-contained HTML.
 */
export function renderTemplate(
  templateId: TemplateId,
  input: TemplateInput,
  dimensions: ImageDimensions,
): string {
  switch (templateId) {
    case "quote-card":
      return quoteCardTemplate(input, dimensions);
    case "stat-highlight":
      return statHighlightTemplate(input, dimensions);
    case "listicle-card":
      return listicleCardTemplate(input, dimensions);
    case "branded-hero":
      return brandedHeroTemplate(input, dimensions);
    case "carousel-slide":
      return carouselSlideTemplate(input, dimensions);
  }
}

/**
 * Render a carousel (multiple slides) — returns an array of HTML strings.
 */
export function renderCarouselTemplate(
  input: CarouselTemplateInput,
  dimensions: ImageDimensions,
): string[] {
  return input.slides.map((slide) =>
    carouselSlideTemplate(
      {
        headline: slide.headline,
        body: slide.body,
        tokens: input.tokens,
        url: input.url,
      },
      dimensions,
      slide.slideNumber,
      input.slides.length,
    ),
  );
}

// ── Template implementations ─────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baseWrapper(
  content: string,
  tokens: BrandVisualTokens,
  dims: ImageDimensions,
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${dims.width}px;
    height: ${dims.height}px;
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    background: ${tokens.backgroundColor};
    color: ${tokens.textColor};
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    width: 100%;
    height: 100%;
    padding: 60px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
  }
  .accent-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 8px;
    height: 100%;
    background: ${tokens.primaryColor};
  }
  .headline {
    font-size: ${dims.width >= 1080 ? 48 : 36}px;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 24px;
    color: ${tokens.textColor};
  }
  .body-text {
    font-size: ${dims.width >= 1080 ? 24 : 20}px;
    line-height: 1.5;
    opacity: 0.85;
  }
  .brand-tag {
    position: absolute;
    bottom: 30px;
    right: 40px;
    font-size: 16px;
    font-weight: 600;
    color: ${tokens.primaryColor};
    opacity: 0.7;
  }
  .logo {
    position: absolute;
    bottom: 30px;
    left: 40px;
    height: 32px;
    opacity: 0.8;
  }
</style>
</head>
<body>
${content}
</body>
</html>`;
}

/** Quote card — large pull-quote with accent bar. Best for key insights. */
function quoteCardTemplate(
  input: TemplateInput,
  dims: ImageDimensions,
): string {
  const body = input.body.length > 200
    ? input.body.slice(0, 197) + "..."
    : input.body;

  return baseWrapper(
    `<div class="card">
  <div class="accent-bar"></div>
  <div style="padding-left: 32px;">
    <div class="body-text" style="font-size: ${dims.width >= 1080 ? 36 : 28}px; font-style: italic; line-height: 1.4;">
      &ldquo;${escapeHtml(body)}&rdquo;
    </div>
    <div style="margin-top: 32px; font-size: 20px; font-weight: 600; color: ${input.tokens.primaryColor};">
      ${escapeHtml(input.headline)}
    </div>
  </div>
  <div class="brand-tag">${escapeHtml(input.tokens.brandName)}</div>
</div>`,
    input.tokens,
    dims,
  );
}

/** Stat highlight — big number or stat with context. For data-driven posts. */
function statHighlightTemplate(
  input: TemplateInput,
  dims: ImageDimensions,
): string {
  return baseWrapper(
    `<div class="card" style="text-align: center; align-items: center;">
  <div style="font-size: ${dims.width >= 1080 ? 96 : 72}px; font-weight: 800; color: ${input.tokens.primaryColor}; line-height: 1;">
    ${escapeHtml(input.headline)}
  </div>
  <div class="body-text" style="margin-top: 32px; max-width: 80%;">
    ${escapeHtml(input.body)}
  </div>
  <div class="brand-tag">${escapeHtml(input.tokens.brandName)}</div>
</div>`,
    input.tokens,
    dims,
  );
}

/** Listicle card — numbered key point. Good for "X things you need to know" posts. */
function listicleCardTemplate(
  input: TemplateInput,
  dims: ImageDimensions,
): string {
  return baseWrapper(
    `<div class="card">
  <div class="accent-bar"></div>
  <div style="padding-left: 32px;">
    <div class="headline">${escapeHtml(input.headline)}</div>
    <div class="body-text">${escapeHtml(input.body)}</div>
  </div>
  <div class="brand-tag">${escapeHtml(input.tokens.brandName)}</div>
</div>`,
    input.tokens,
    dims,
  );
}

/** Branded hero — title-forward with gradient accent. Default fallback. */
function brandedHeroTemplate(
  input: TemplateInput,
  dims: ImageDimensions,
): string {
  return baseWrapper(
    `<div class="card" style="background: linear-gradient(135deg, ${input.tokens.backgroundColor} 0%, ${input.tokens.accentColor}22 100%);">
  <div class="headline" style="font-size: ${dims.width >= 1080 ? 56 : 42}px;">
    ${escapeHtml(input.headline)}
  </div>
  <div class="body-text" style="max-width: 80%;">
    ${escapeHtml(input.body)}
  </div>
  ${input.tokens.logoUrl ? `<img class="logo" src="${escapeHtml(input.tokens.logoUrl)}" alt="" />` : ""}
  <div class="brand-tag">${escapeHtml(input.tokens.brandName)}</div>
</div>`,
    input.tokens,
    dims,
  );
}

/** Carousel slide — numbered with progress indicator. Instagram carousels. */
function carouselSlideTemplate(
  input: TemplateInput,
  dims: ImageDimensions,
  slideNumber = 1,
  totalSlides = 1,
): string {
  return baseWrapper(
    `<div class="card">
  <div class="accent-bar"></div>
  <div style="position: absolute; top: 30px; right: 40px; font-size: 18px; font-weight: 600; color: ${input.tokens.primaryColor}; opacity: 0.6;">
    ${slideNumber} / ${totalSlides}
  </div>
  <div style="padding-left: 32px;">
    <div class="headline">${escapeHtml(input.headline)}</div>
    <div class="body-text">${escapeHtml(input.body)}</div>
  </div>
  <div class="brand-tag">${escapeHtml(input.tokens.brandName)}</div>
</div>`,
    input.tokens,
    dims,
  );
}

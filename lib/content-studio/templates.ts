import type { ContentType, AspectRatio } from "@/lib/db/schema/content-studio";
import type { ColourPalette } from "./motion/types";
import type { MotionLayoutConfig } from "./motion/layouts";
import { DEFAULT_LAYOUT } from "./motion/layouts";

export interface RenderOptions {
  fontFaces?: string;
  palette?: ColourPalette;
  layout?: MotionLayoutConfig;
}

export interface TemplateDef {
  id: string;
  name: string;
  contentType: ContentType;
  copySlots: string[];
  renderHtml: (
    copy: Record<string, string>,
    ratio: AspectRatio,
    options?: RenderOptions,
  ) => string;
}

const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 630 },
  portrait_3x4: { width: 1080, height: 1440 },
  portrait_4x5: { width: 1080, height: 1350 },
  landscape_16x9: { width: 1920, height: 1080 },
};

export function getDimensions(ratio: AspectRatio) {
  return ASPECT_DIMENSIONS[ratio];
}

function scaleForRatio(ratio: AspectRatio): number {
  const { width, height } = ASPECT_DIMENSIONS[ratio];
  const widthScale = width / 1080;
  const aspect = width / height;
  if (aspect > 1.5) return widthScale * 0.65;
  if (aspect > 1.3) return widthScale * 0.85;
  if (aspect < 0.7) return widthScale * 1.15;
  if (aspect < 0.85) return widthScale * 1.05;
  return widthScale;
}

const DEFAULT_FONT_FACES = `
  @font-face { font-family: 'Display'; src: local('Inter'); font-weight: 900; }
  @font-face { font-family: 'Body'; src: local('Inter'); font-weight: 400; }
  @font-face { font-family: 'Label'; src: local('Inter'); font-weight: 600; }
`;

const DEFAULT_PALETTE: ColourPalette = {
  id: "default-dark",
  name: "Default Dark",
  source: "brand",
  background: "#1A1A18",
  primary: "#B22848",
  accent: "#F28C52",
  text: "#FDF5E6",
};

function baseStyles(ratio: AspectRatio, options?: RenderOptions) {
  const { width, height } = ASPECT_DIMENSIONS[ratio];
  const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
  const p = options?.palette ?? DEFAULT_PALETTE;
  const layout = options?.layout ?? DEFAULT_LAYOUT;
  const s = scaleForRatio(ratio);

  const headlineSize = Math.round(80 * s * layout.headlineScale);
  const detailSize = Math.round(48 * s * layout.detailScale);
  const brandSize = Math.round(16 * s);
  const subtextSize = Math.round(20 * s);
  const taglineSize = Math.round(20 * s);
  const footerSize = Math.round(12 * s);
  const padX = Math.round(48 * s * layout.paddingScale);
  const padY = Math.round(60 * s * layout.paddingScale);
  const gap = Math.round(layout.elementGap * s);
  const dividerWidth = Math.round(48 * s);

  const justifyContent =
    layout.verticalPosition <= 30
      ? "flex-start"
      : layout.verticalPosition >= 70
        ? "flex-end"
        : "center";
  const textAlign = layout.textAlign;
  const alignItems =
    textAlign === "center"
      ? "center"
      : textAlign === "right"
        ? "flex-end"
        : "flex-start";
  const dividerMargin =
    textAlign === "center"
      ? `0 auto ${gap}px`
      : textAlign === "right"
        ? `0 0 ${gap}px auto`
        : `0 0 ${gap}px 0`;

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ${ff}
    body {
      width: ${width}px; height: ${height}px;
      background: ${p.background};
      display: flex; flex-direction: column;
      justify-content: ${justifyContent}; align-items: ${alignItems};
      font-family: 'Body', sans-serif;
      color: ${p.text};
      overflow: hidden;
      position: relative;
    }
    .gradient-overlay {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse 70% 50% at 50% 30%, ${p.primary}1f, transparent 60%);
    }
    .content {
      position: relative; z-index: 1;
      text-align: ${textAlign};
      padding: ${padY}px ${padX}px;
      width: 100%;
      max-width: ${layout.contentWidth}%;
    }
    .brand-label {
      font-family: 'Label'; font-size: ${brandSize}px;
      letter-spacing: 4px; text-transform: uppercase;
      color: ${p.primary}; margin-bottom: ${gap}px;
    }
    .headline {
      font-family: 'Display'; font-weight: 900;
      color: ${p.text};
      font-size: ${headlineSize}px;
      line-height: ${layout.lineHeight};
      letter-spacing: ${layout.letterSpacing}px;
      margin-bottom: ${gap}px;
    }
    .divider {
      width: ${dividerWidth}px; height: 3px;
      background: linear-gradient(90deg, ${p.accent}, ${p.primary});
      margin: ${dividerMargin};
      border-radius: 2px;
    }
    .detail {
      font-family: 'Display'; font-weight: 900;
      color: ${p.primary};
      font-size: ${detailSize}px;
      margin-bottom: ${gap}px;
    }
    .subtext {
      font-family: 'Label'; font-size: ${subtextSize}px;
      letter-spacing: 3px; text-transform: uppercase;
      color: #8A8A80; margin-bottom: ${gap}px;
    }
    .tagline {
      font-family: 'Body'; font-style: italic;
      font-size: ${taglineSize}px;
      color: ${p.accent}; margin-top: ${gap}px;
    }
    .footer {
      position: absolute; bottom: ${padY}px;
      left: 0; right: 0; text-align: center;
      font-family: 'Label'; font-size: ${footerSize}px;
      letter-spacing: 3px; text-transform: uppercase;
      color: ${p.text}40;
    }
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const announcementBold: TemplateDef = {
  id: "announcement-bold",
  name: "Bold Announcement",
  contentType: "announcement",
  copySlots: ["headline", "detail", "subtext", "tagline"],
  renderHtml(copy, ratio, options) {
    return `<!DOCTYPE html><html><head><style>${baseStyles(ratio, options)}</style></head><body>
      <div class="gradient-overlay"></div>
      <div class="content">
        <div class="brand-label">SuperBad</div>
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="divider"></div>
        <div class="detail">${escapeHtml(copy.detail || "")}</div>
        <div class="subtext">${escapeHtml(copy.subtext || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

const announcementMinimal: TemplateDef = {
  id: "announcement-minimal",
  name: "Minimal Announcement",
  contentType: "announcement",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const p = options?.palette ?? DEFAULT_PALETTE;
    const headlineAccent = mixAccent(p);
    return `<!DOCTYPE html><html><head><style>${baseStyles(ratio, options)}
      .headline { color: ${headlineAccent}; }
    </style></head><body>
      <div class="gradient-overlay"></div>
      <div class="content">
        <div class="brand-label">SuperBad</div>
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="detail">${escapeHtml(copy.detail || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

const antiMotivation: TemplateDef = {
  id: "anti-motivation-typography",
  name: "Anti-Motivation Typography",
  contentType: "anti_motivation",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    return `<!DOCTYPE html><html><head><style>${baseStyles(ratio, options)}
      .headline { letter-spacing: -3px; }
    </style></head><body>
      <div class="gradient-overlay"></div>
      <div class="content">
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="divider"></div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

const tipsValue: TemplateDef = {
  id: "tips-value",
  name: "Value Post",
  contentType: "tips",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const bodyDetailSize = Math.round(22 * s);
    return `<!DOCTYPE html><html><head><style>${baseStyles(ratio, options)}
      .detail { color: ${p.text}; font-family: 'Body'; font-weight: 400; font-size: ${bodyDetailSize}px; line-height: 1.6; letter-spacing: 0; }
    </style></head><body>
      <div class="gradient-overlay"></div>
      <div class="content">
        <div class="brand-label">SuperBad</div>
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="divider"></div>
        <div class="detail">${escapeHtml(copy.detail || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

const testimonialQuote: TemplateDef = {
  id: "testimonial-quote",
  name: "Testimonial Quote",
  contentType: "testimonial",
  copySlots: ["headline", "detail", "subtext"],
  renderHtml(copy, ratio, options) {
    const p = options?.palette ?? DEFAULT_PALETTE;
    const headlineAccent = mixAccent(p);
    const s = scaleForRatio(ratio);
    const layout = options?.layout ?? DEFAULT_LAYOUT;
    const quoteSize = Math.round(40 * s * layout.headlineScale);
    const attributionSize = Math.round(16 * s);
    return `<!DOCTYPE html><html><head><style>${baseStyles(ratio, options)}
      .headline { font-family: 'Body'; font-style: italic; font-weight: 400; letter-spacing: 0; line-height: 1.4; font-size: ${quoteSize}px; }
      .detail { font-family: 'Label'; font-size: ${attributionSize}px; letter-spacing: 2px; text-transform: uppercase; color: ${headlineAccent}; }
    </style></head><body>
      <div class="gradient-overlay"></div>
      <div class="content">
        <div class="brand-label">SuperBad</div>
        <div class="headline">&ldquo;${escapeHtml(copy.headline || "")}&rdquo;</div>
        <div class="divider"></div>
        <div class="detail">&mdash; ${escapeHtml(copy.detail || "")}</div>
        <div class="subtext">${escapeHtml(copy.subtext || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

const behindTheScenes: TemplateDef = {
  id: "bts-caption",
  name: "Behind the Scenes",
  contentType: "behind_the_scenes",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    const s = scaleForRatio(ratio);
    const layout = options?.layout ?? DEFAULT_LAYOUT;
    const captionSize = Math.round(36 * s * layout.headlineScale);
    return `<!DOCTYPE html><html><head><style>${baseStyles(ratio, options)}
      .headline { font-family: 'Body'; font-weight: 400; letter-spacing: 0; line-height: 1.5; font-size: ${captionSize}px; }
    </style></head><body>
      <div class="gradient-overlay"></div>
      <div class="content">
        <div class="brand-label">Behind the scenes</div>
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

const portfolioShowcase: TemplateDef = {
  id: "portfolio-showcase",
  name: "Portfolio Showcase",
  contentType: "portfolio",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const p = options?.palette ?? DEFAULT_PALETTE;
    return `<!DOCTYPE html><html><head><style>${baseStyles(ratio, options)}
      .brand-label { color: ${p.accent}; }
    </style></head><body>
      <div class="gradient-overlay"></div>
      <div class="content">
        <div class="brand-label">Recent work</div>
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="divider"></div>
        <div class="subtext">${escapeHtml(copy.detail || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

function mixAccent(palette: ColourPalette): string {
  if (palette.id === "default-dark" || palette.source === "brand") {
    return "#F4A0B0";
  }
  return palette.accent;
}

/* ------------------------------------------------------------------ */
/* Announcement — Statement Stripe                                     */
/* ------------------------------------------------------------------ */

const announcementStripe: TemplateDef = {
  id: "announcement-stripe",
  name: "Statement Stripe",
  contentType: "announcement",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(72 * s);
    const detailSize = Math.round(22 * s);
    const taglineSize = Math.round(18 * s);
    const footerSize = Math.round(12 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(60 * s);
    const stripeTop = Math.round(height * 0.34);
    const stripeH = Math.round(height * 0.22);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .stripe { position: absolute; left: 0; right: 0; top: ${stripeTop}px; height: ${stripeH}px; background: ${p.primary}; }
      .headline { position: absolute; left: ${padX}px; top: ${stripeTop + Math.round(stripeH * 0.18)}px; font-family: 'Display'; font-weight: 900; font-size: ${headlineSize}px; line-height: 1.05; color: ${p.background}; z-index: 2; max-width: ${Math.round(width * 0.85)}px; }
      .detail { position: absolute; left: ${padX}px; top: ${stripeTop + stripeH + Math.round(32 * s)}px; font-family: 'Body'; font-size: ${detailSize}px; color: ${p.text}cc; max-width: ${Math.round(width * 0.65)}px; line-height: 1.5; }
      .tagline { position: absolute; left: ${padX}px; bottom: ${padY + Math.round(28 * s)}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; left: 0; right: 0; text-align: center; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="stripe"></div>
      <div class="headline">${escapeHtml(copy.headline || "")}</div>
      <div class="detail">${escapeHtml(copy.detail || "")}</div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Anti-Motivation — Void                                              */
/* ------------------------------------------------------------------ */

const antiMotivationVoid: TemplateDef = {
  id: "anti-motivation-void",
  name: "Anti-Motivation Void",
  contentType: "anti_motivation",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(32 * s);
    const taglineSize = Math.round(14 * s);
    const footerSize = Math.round(10 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(48 * s);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .content { position: absolute; bottom: ${padY}px; left: ${padX}px; max-width: 55%; }
      .headline { font-family: 'Display'; font-weight: 900; font-size: ${headlineSize}px; line-height: 1.2; letter-spacing: -1px; margin-bottom: ${Math.round(12 * s)}px; }
      .tagline { font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .dot { position: absolute; top: ${Math.round(height * 0.15)}px; right: ${Math.round(width * 0.15)}px; width: ${Math.round(6 * s)}px; height: ${Math.round(6 * s)}px; background: ${p.primary}; border-radius: 50%; }
      .footer { position: absolute; top: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="dot"></div>
      <div class="content">
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Tips — Numbered List                                                */
/* ------------------------------------------------------------------ */

const tipsNumbered: TemplateDef = {
  id: "tips-numbered",
  name: "Numbered List",
  contentType: "tips",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(56 * s);
    const itemSize = Math.round(20 * s);
    const numSize = Math.round(14 * s);
    const taglineSize = Math.round(16 * s);
    const footerSize = Math.round(12 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(60 * s);
    const gap = Math.round(18 * s);

    const items = (copy.detail || "").split(/[.·•]\s*/).filter(Boolean);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .content { position: absolute; top: ${padY}px; left: ${padX}px; right: ${padX}px; }
      .label { font-family: 'Label'; font-size: ${numSize}px; letter-spacing: 4px; text-transform: uppercase; color: ${p.primary}; margin-bottom: ${gap}px; }
      .headline { font-family: 'Display'; font-weight: 900; font-size: ${headlineSize}px; line-height: 1.1; margin-bottom: ${Math.round(36 * s)}px; }
      .divider { width: ${Math.round(48 * s)}px; height: 3px; background: linear-gradient(90deg, ${p.accent}, ${p.primary}); border-radius: 2px; margin-bottom: ${Math.round(32 * s)}px; }
      .item { display: flex; align-items: baseline; gap: ${Math.round(16 * s)}px; margin-bottom: ${gap}px; }
      .num { font-family: 'Label'; font-size: ${numSize}px; color: ${p.accent}; letter-spacing: 1px; flex-shrink: 0; min-width: ${Math.round(24 * s)}px; }
      .item-text { font-family: 'Body'; font-size: ${itemSize}px; color: ${p.text}cc; line-height: 1.5; }
      .tagline { position: absolute; bottom: ${padY + Math.round(28 * s)}px; left: ${padX}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; left: 0; right: 0; text-align: center; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="content">
        <div class="label">SuperBad</div>
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="divider"></div>
        ${items.map((item, i) => `<div class="item"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="item-text">${escapeHtml(item.trim())}</span></div>`).join("")}
      </div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Tips — Headline Only                                                */
/* ------------------------------------------------------------------ */

const tipsHeadlineOnly: TemplateDef = {
  id: "tips-headline-only",
  name: "Single Takeaway",
  contentType: "tips",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(96 * s);
    const taglineSize = Math.round(18 * s);
    const footerSize = Math.round(12 * s);
    const padX = Math.round(60 * s);
    const padY = Math.round(60 * s);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; display: flex; align-items: center; justify-content: center; }
      .content { padding: 0 ${padX}px; text-align: center; max-width: 90%; }
      .headline { font-family: 'Display'; font-weight: 900; font-size: ${headlineSize}px; line-height: 1.05; letter-spacing: -2px; }
      .accent-line { width: ${Math.round(80 * s)}px; height: 4px; background: ${p.primary}; margin: ${Math.round(24 * s)}px auto 0; border-radius: 2px; }
      .tagline { position: absolute; bottom: ${padY}px; left: 0; right: 0; text-align: center; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY - Math.round(20 * s)}px; left: 0; right: 0; text-align: center; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="content">
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="accent-line"></div>
      </div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Testimonial — Card                                                  */
/* ------------------------------------------------------------------ */

const testimonialCard: TemplateDef = {
  id: "testimonial-card",
  name: "Testimonial Card",
  contentType: "testimonial",
  copySlots: ["headline", "detail", "subtext"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const quoteSize = Math.round(34 * s);
    const nameSize = Math.round(16 * s);
    const roleSize = Math.round(13 * s);
    const footerSize = Math.round(12 * s);
    const cardPad = Math.round(48 * s);
    const outerPad = Math.round(64 * s);
    const cardW = Math.round(width * 0.78);
    const cardH = Math.round(height * 0.55);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.primary}22; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; display: flex; align-items: center; justify-content: center; }
      .card { width: ${cardW}px; min-height: ${cardH}px; background: ${p.background}; border-radius: ${Math.round(16 * s)}px; padding: ${cardPad}px; display: flex; flex-direction: column; justify-content: center; position: relative; }
      .quote-mark { font-family: 'Display'; font-size: ${Math.round(160 * s)}px; color: ${p.primary}18; position: absolute; top: ${Math.round(-20 * s)}px; left: ${Math.round(24 * s)}px; line-height: 1; }
      .quote { font-family: 'Body'; font-style: italic; font-size: ${quoteSize}px; line-height: 1.4; margin-bottom: ${Math.round(28 * s)}px; position: relative; z-index: 1; }
      .divider { width: ${Math.round(32 * s)}px; height: 2px; background: ${p.accent}; margin-bottom: ${Math.round(16 * s)}px; }
      .name { font-family: 'Label'; font-size: ${nameSize}px; letter-spacing: 2px; text-transform: uppercase; color: ${mixAccent(p)}; }
      .role { font-family: 'Body'; font-size: ${roleSize}px; color: ${p.text}80; margin-top: ${Math.round(4 * s)}px; }
      .corner-label { position: absolute; top: ${outerPad}px; left: ${outerPad}px; font-family: 'Label'; font-size: ${Math.round(10 * s)}px; letter-spacing: 4px; text-transform: uppercase; color: ${p.text}60; }
      .footer { position: absolute; bottom: ${Math.round(40 * s)}px; left: 0; right: 0; text-align: center; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="corner-label">Client feedback</div>
      <div class="card">
        <div class="quote-mark">&ldquo;</div>
        <div class="quote">${escapeHtml(copy.headline || "")}</div>
        <div class="divider"></div>
        <div class="name">${escapeHtml(copy.detail || "")}</div>
        <div class="role">${escapeHtml(copy.subtext || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Testimonial — Oversized Quote                                       */
/* ------------------------------------------------------------------ */

const testimonialOversized: TemplateDef = {
  id: "testimonial-oversized",
  name: "Oversized Quote",
  contentType: "testimonial",
  copySlots: ["headline", "detail", "subtext"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const quoteSize = Math.round(36 * s);
    const nameSize = Math.round(14 * s);
    const roleSize = Math.round(12 * s);
    const footerSize = Math.round(12 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(60 * s);
    const giantSize = Math.round(height * 1.1);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .giant { position: absolute; top: ${Math.round(-height * 0.3)}px; right: ${Math.round(-width * 0.1)}px; font-family: 'Display'; font-size: ${giantSize}px; color: ${p.primary}0a; line-height: 0.8; pointer-events: none; }
      .content { position: absolute; bottom: ${padY}px; left: ${padX}px; max-width: 70%; z-index: 1; }
      .quote { font-family: 'Body'; font-style: italic; font-size: ${quoteSize}px; line-height: 1.4; margin-bottom: ${Math.round(24 * s)}px; }
      .divider { width: ${Math.round(32 * s)}px; height: 2px; background: ${p.accent}; margin-bottom: ${Math.round(16 * s)}px; }
      .name { font-family: 'Label'; font-size: ${nameSize}px; letter-spacing: 2px; text-transform: uppercase; color: ${mixAccent(p)}; }
      .role { font-family: 'Body'; font-size: ${roleSize}px; color: ${p.text}80; margin-top: ${Math.round(4 * s)}px; }
      .footer { position: absolute; top: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="giant">&rdquo;</div>
      <div class="content">
        <div class="quote">&ldquo;${escapeHtml(copy.headline || "")}&rdquo;</div>
        <div class="divider"></div>
        <div class="name">${escapeHtml(copy.detail || "")}</div>
        <div class="role">${escapeHtml(copy.subtext || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Behind the Scenes — Timestamp                                       */
/* ------------------------------------------------------------------ */

const btsTimestamp: TemplateDef = {
  id: "bts-timestamp",
  name: "BTS Timestamp",
  contentType: "behind_the_scenes",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(44 * s);
    const codeSize = Math.round(13 * s);
    const taglineSize = Math.round(16 * s);
    const footerSize = Math.round(12 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(48 * s);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .timecode { position: absolute; top: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${codeSize}px; letter-spacing: 2px; color: ${p.primary}; }
      .rec { display: inline-block; width: ${Math.round(6 * s)}px; height: ${Math.round(6 * s)}px; background: ${p.primary}; border-radius: 50%; margin-right: ${Math.round(8 * s)}px; }
      .content { position: absolute; bottom: ${padY}px; left: ${padX}px; max-width: 70%; }
      .label { font-family: 'Label'; font-size: ${codeSize}px; letter-spacing: 4px; text-transform: uppercase; color: ${p.text}60; margin-bottom: ${Math.round(12 * s)}px; }
      .headline { font-family: 'Body'; font-weight: 400; font-size: ${headlineSize}px; line-height: 1.3; margin-bottom: ${Math.round(16 * s)}px; }
      .tagline { font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .grid-line { position: absolute; background: ${p.text}08; }
      .grid-h { left: 0; right: 0; height: 1px; }
      .grid-v { top: 0; bottom: 0; width: 1px; }
      .footer { position: absolute; bottom: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="grid-line grid-h" style="top: 33.33%"></div>
      <div class="grid-line grid-h" style="top: 66.66%"></div>
      <div class="grid-line grid-v" style="left: 33.33%"></div>
      <div class="grid-line grid-v" style="left: 66.66%"></div>
      <div class="timecode"><span class="rec"></span>05:47:22</div>
      <div class="content">
        <div class="label">Behind the scenes</div>
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Behind the Scenes — Raw Log                                         */
/* ------------------------------------------------------------------ */

const btsRaw: TemplateDef = {
  id: "bts-raw",
  name: "BTS Raw",
  contentType: "behind_the_scenes",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(48 * s);
    const monoSize = Math.round(11 * s);
    const taglineSize = Math.round(16 * s);
    const footerSize = Math.round(12 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(60 * s);
    const lineH = Math.round(20 * s);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      @font-face { font-family: 'Mono'; src: local('Courier New'), local('monospace'); font-weight: 400; }
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .log-lines { position: absolute; top: ${padY}px; left: ${padX}px; right: ${padX}px; }
      .log-line { font-family: 'Mono', monospace; font-size: ${monoSize}px; color: ${p.text}20; line-height: ${lineH}px; white-space: nowrap; overflow: hidden; }
      .log-line.active { color: ${p.primary}80; }
      .content { position: absolute; bottom: ${padY}px; left: ${padX}px; max-width: 75%; z-index: 1; }
      .headline { font-family: 'Display'; font-weight: 900; font-size: ${headlineSize}px; line-height: 1.15; margin-bottom: ${Math.round(16 * s)}px; }
      .tagline { font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="log-lines">
        <div class="log-line">[06:12:04] client.brief.received — waiting for review</div>
        <div class="log-line">[06:12:18] assets.uploaded — 47 files, 2.3GB</div>
        <div class="log-line">[06:15:33] shoot.schedule.confirmed — tomorrow 07:00</div>
        <div class="log-line active">[06:15:34] status.changed → in_production</div>
        <div class="log-line">[06:22:01] team.notified — 3 members</div>
        <div class="log-line">[06:30:00] gear.checklist.complete</div>
      </div>
      <div class="content">
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Portfolio — Split                                                    */
/* ------------------------------------------------------------------ */

const portfolioSplit: TemplateDef = {
  id: "portfolio-split",
  name: "Portfolio Split",
  contentType: "portfolio",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(64 * s);
    const detailSize = Math.round(16 * s);
    const taglineSize = Math.round(16 * s);
    const footerSize = Math.round(12 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(60 * s);
    const splitPoint = Math.round(width * 0.42);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .left-zone { position: absolute; left: 0; top: 0; bottom: 0; width: ${splitPoint}px; background: ${p.primary}; display: flex; flex-direction: column; justify-content: flex-end; padding: ${padY}px ${padX}px; }
      .right-zone { position: absolute; left: ${splitPoint}px; top: 0; bottom: 0; right: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: ${padY}px ${padX}px; }
      .label { font-family: 'Label'; font-size: ${Math.round(10 * s)}px; letter-spacing: 4px; text-transform: uppercase; color: ${p.background}80; margin-bottom: ${Math.round(12 * s)}px; }
      .headline { font-family: 'Display'; font-weight: 900; font-size: ${headlineSize}px; line-height: 1.05; color: ${p.background}; }
      .detail { font-family: 'Label'; font-size: ${detailSize}px; letter-spacing: 2px; text-transform: uppercase; color: ${p.text}80; margin-bottom: ${Math.round(16 * s)}px; }
      .tagline { font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="left-zone">
        <div class="label">Recent work</div>
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
      </div>
      <div class="right-zone">
        <div class="detail">${escapeHtml(copy.detail || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Portfolio — Editorial                                               */
/* ------------------------------------------------------------------ */

const portfolioEditorial: TemplateDef = {
  id: "portfolio-editorial",
  name: "Portfolio Editorial",
  contentType: "portfolio",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(88 * s);
    const detailSize = Math.round(15 * s);
    const taglineSize = Math.round(14 * s);
    const footerSize = Math.round(12 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(60 * s);
    const ruleOffset = Math.round(height * 0.62);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .issue { position: absolute; top: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${Math.round(10 * s)}px; letter-spacing: 4px; text-transform: uppercase; color: ${p.text}40; }
      .headline { position: absolute; top: ${padY}px; left: ${padX}px; max-width: 85%; font-family: 'Display'; font-weight: 900; font-size: ${headlineSize}px; line-height: 0.95; letter-spacing: -3px; }
      .rule { position: absolute; left: ${padX}px; right: ${padX}px; top: ${ruleOffset}px; height: 1px; background: ${p.text}18; }
      .meta { position: absolute; top: ${ruleOffset + Math.round(20 * s)}px; left: ${padX}px; display: flex; gap: ${Math.round(32 * s)}px; }
      .meta-item { font-family: 'Label'; font-size: ${detailSize}px; letter-spacing: 1px; text-transform: uppercase; color: ${p.text}60; }
      .tagline { position: absolute; bottom: ${padY}px; left: ${padX}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}40; }
    </style></head><body>
      <div class="issue">No. 01</div>
      <div class="headline">${escapeHtml(copy.headline || "")}</div>
      <div class="rule"></div>
      <div class="meta">
        ${(copy.detail || "").split(/[·•,]\s*/).filter(Boolean).map((item) => `<span class="meta-item">${escapeHtml(item.trim())}</span>`).join("")}
      </div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

export const ALL_TEMPLATES: TemplateDef[] = [
  announcementBold,
  announcementMinimal,
  announcementStripe,
  antiMotivation,
  antiMotivationVoid,
  tipsValue,
  tipsNumbered,
  tipsHeadlineOnly,
  testimonialQuote,
  testimonialCard,
  testimonialOversized,
  behindTheScenes,
  btsTimestamp,
  btsRaw,
  portfolioShowcase,
  portfolioSplit,
  portfolioEditorial,
];

export function getTemplate(id: string): TemplateDef | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesForType(type: ContentType): TemplateDef[] {
  return ALL_TEMPLATES.filter((t) => t.contentType === type);
}

export function pickTemplateForBrief(
  brief: string,
  suggestedType?: ContentType,
): TemplateDef {
  if (suggestedType) {
    const matches = getTemplatesForType(suggestedType);
    if (matches.length > 0) return matches[0];
  }
  return announcementBold;
}

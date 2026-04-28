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

/* ================================================================== */
/* SCROLL-STOPPERS — graphic-designer compositions                     */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* Knockout — full-bleed primary, headline punched out in background   */
/* ------------------------------------------------------------------ */

const announcementKnockout: TemplateDef = {
  id: "announcement-knockout",
  name: "Knockout",
  contentType: "announcement",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(140 * s);
    const detailSize = Math.round(18 * s);
    const taglineSize = Math.round(16 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(48 * s);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.primary}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; }
      .headline {
        position: absolute; top: 50%; left: ${padX}px; right: ${padX}px;
        transform: translateY(-55%);
        font-family: 'Display'; font-weight: 900;
        font-size: ${headlineSize}px; line-height: 0.9; letter-spacing: -4px;
        color: ${p.background};
        mix-blend-mode: normal;
      }
      .ghost {
        position: absolute; top: 50%; left: ${padX}px; right: ${padX}px;
        transform: translateY(-55%);
        font-family: 'Display'; font-weight: 900;
        font-size: ${headlineSize}px; line-height: 0.9; letter-spacing: -4px;
        color: transparent;
        -webkit-text-stroke: 1px ${p.background}30;
        pointer-events: none; z-index: 0;
        margin-left: ${Math.round(8 * s)}px; margin-top: ${Math.round(6 * s)}px;
      }
      .detail { position: absolute; bottom: ${padY + Math.round(32 * s)}px; left: ${padX}px; font-family: 'Body'; font-size: ${detailSize}px; color: ${p.text}cc; max-width: 60%; line-height: 1.5; }
      .tagline { position: absolute; bottom: ${padY + Math.round(32 * s)}px; right: ${padX}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.text}80; text-align: right; }
      .footer { position: absolute; bottom: ${padY}px; left: 0; right: 0; text-align: center; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}30; }
    </style></head><body>
      <div class="ghost">${escapeHtml(copy.headline || "")}</div>
      <div class="headline">${escapeHtml(copy.headline || "")}</div>
      <div class="detail">${escapeHtml(copy.detail || "")}</div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Stacked Type — each word is a full-width block, alternating colour  */
/* ------------------------------------------------------------------ */

const antiMotivationStacked: TemplateDef = {
  id: "anti-motivation-stacked",
  name: "Stacked Type",
  contentType: "anti_motivation",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const taglineSize = Math.round(16 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(36 * s);
    const padY = Math.round(48 * s);

    const words = (copy.headline || "").replace(/\n/g, " ").split(/\s+/).filter(Boolean);
    const maxWordSize = Math.round((height * 0.82) / Math.max(words.length, 1));
    const wordSize = Math.min(maxWordSize, Math.round(160 * s));

    const wordHtml = words.map((word, i) => {
      const isAccent = i % 3 === 1;
      const bg = isAccent ? p.primary : "transparent";
      const color = isAccent ? p.text : p.text;
      const align = i % 2 === 0 ? "left" : "right";
      return `<div style="font-family:'Display';font-weight:900;font-size:${wordSize}px;line-height:0.92;letter-spacing:-3px;color:${color};background:${bg};text-align:${align};padding:0 ${padX}px;text-transform:uppercase;">${escapeHtml(word)}</div>`;
    }).join("");

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; display: flex; flex-direction: column; justify-content: center; }
      .tagline { position: absolute; bottom: ${padY}px; left: ${padX}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}30; }
    </style></head><body>
      ${wordHtml}
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Redacted — text with blacked-out words, one word revealed in red    */
/* ------------------------------------------------------------------ */

const antiMotivationRedacted: TemplateDef = {
  id: "anti-motivation-redacted",
  name: "Redacted",
  contentType: "anti_motivation",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(72 * s);
    const taglineSize = Math.round(18 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(56 * s);
    const padY = Math.round(56 * s);

    const words = (copy.headline || "").replace(/\n/g, " ").split(/\s+/).filter(Boolean);
    const revealIdx = Math.max(0, words.length - 1);
    const wordHtml = words.map((word, i) => {
      if (i === revealIdx) {
        return `<span style="color:${p.primary};text-decoration:underline;text-decoration-color:${p.primary}40;text-underline-offset:${Math.round(8 * s)}px;">${escapeHtml(word)}</span>`;
      }
      return `<span style="background:${p.text};color:${p.text};border-radius:2px;padding:0 ${Math.round(4 * s)}px;">${escapeHtml(word)}</span>`;
    }).join(" ");

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; display: flex; align-items: center; justify-content: center; }
      .content { padding: 0 ${padX}px; max-width: 90%; }
      .headline { font-family: 'Display'; font-weight: 900; font-size: ${headlineSize}px; line-height: 1.3; letter-spacing: -1px; }
      .tagline { position: absolute; bottom: ${padY}px; left: ${padX}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}30; }
    </style></head><body>
      <div class="content">
        <div class="headline">${wordHtml}</div>
      </div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Full-Bleed Stat — giant number fills 90% of frame, detail at foot   */
/* ------------------------------------------------------------------ */

const tipsFullBleedStat: TemplateDef = {
  id: "tips-full-bleed-stat",
  name: "Full-Bleed Stat",
  contentType: "tips",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const statSize = Math.round(420 * s);
    const detailSize = Math.round(20 * s);
    const taglineSize = Math.round(16 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(48 * s);

    const headlineText = copy.headline || "";
    const firstLine = headlineText.split("\n")[0] || headlineText;

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .stat {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -55%);
        font-family: 'Display'; font-weight: 900;
        font-size: ${statSize}px; line-height: 0.85;
        color: ${p.primary};
        white-space: nowrap;
      }
      .stat-shadow {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -55%);
        font-family: 'Display'; font-weight: 900;
        font-size: ${statSize}px; line-height: 0.85;
        color: transparent;
        -webkit-text-stroke: 2px ${p.primary}15;
        white-space: nowrap;
        margin-left: ${Math.round(12 * s)}px; margin-top: ${Math.round(10 * s)}px;
      }
      .detail { position: absolute; bottom: ${padY + Math.round(28 * s)}px; left: ${padX}px; right: ${padX}px; font-family: 'Body'; font-size: ${detailSize}px; color: ${p.text}cc; line-height: 1.5; text-align: center; }
      .tagline { position: absolute; top: ${padY}px; left: ${padX}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; left: 0; right: 0; text-align: center; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}30; }
    </style></head><body>
      <div class="stat-shadow">${escapeHtml(firstLine)}</div>
      <div class="stat">${escapeHtml(firstLine)}</div>
      <div class="detail">${escapeHtml(copy.detail || "")}</div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Diagonal Cut — headline rotated across the diagonal of the frame    */
/* ------------------------------------------------------------------ */

const portfolioDiagonal: TemplateDef = {
  id: "portfolio-diagonal",
  name: "Diagonal Cut",
  contentType: "portfolio",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(100 * s);
    const detailSize = Math.round(14 * s);
    const taglineSize = Math.round(15 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(48 * s);
    const diagAngle = -12;

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .diagonal-band {
        position: absolute; left: -10%; right: -10%;
        top: 50%; transform: translateY(-50%) rotate(${diagAngle}deg);
        background: ${p.primary};
        padding: ${Math.round(40 * s)}px ${Math.round(80 * s)}px;
      }
      .headline {
        font-family: 'Display'; font-weight: 900;
        font-size: ${headlineSize}px; line-height: 0.95; letter-spacing: -3px;
        color: ${p.background}; text-transform: uppercase;
      }
      .corner-tl { position: absolute; top: ${padY}px; left: ${padX}px; }
      .corner-br { position: absolute; bottom: ${padY}px; right: ${padX}px; text-align: right; }
      .label { font-family: 'Label'; font-size: ${Math.round(10 * s)}px; letter-spacing: 4px; text-transform: uppercase; color: ${p.text}50; margin-bottom: ${Math.round(8 * s)}px; }
      .detail { font-family: 'Label'; font-size: ${detailSize}px; letter-spacing: 2px; text-transform: uppercase; color: ${p.text}70; }
      .tagline { font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; left: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}30; }
    </style></head><body>
      <div class="corner-tl">
        <div class="label">Recent work</div>
        <div class="detail">${escapeHtml(copy.detail || "")}</div>
      </div>
      <div class="diagonal-band">
        <div class="headline">${escapeHtml(copy.headline || "")}</div>
      </div>
      <div class="corner-br">
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Crosshair — grid overlay with text at intersection points           */
/* ------------------------------------------------------------------ */

const btsCrosshair: TemplateDef = {
  id: "bts-crosshair",
  name: "Crosshair",
  contentType: "behind_the_scenes",
  copySlots: ["headline", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(52 * s);
    const taglineSize = Math.round(15 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(48 * s);
    const crossX = Math.round(width * 0.35);
    const crossY = Math.round(height * 0.4);
    const lineColor = `${p.primary}30`;
    const dotSize = Math.round(8 * s);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .h-line { position: absolute; left: 0; right: 0; top: ${crossY}px; height: 1px; background: ${lineColor}; }
      .v-line { position: absolute; top: 0; bottom: 0; left: ${crossX}px; width: 1px; background: ${lineColor}; }
      .h-line-2 { position: absolute; left: 0; right: 0; top: ${Math.round(height * 0.72)}px; height: 1px; background: ${p.text}08; }
      .v-line-2 { position: absolute; top: 0; bottom: 0; left: ${Math.round(width * 0.7)}px; width: 1px; background: ${p.text}08; }
      .dot { position: absolute; width: ${dotSize}px; height: ${dotSize}px; border-radius: 50%; background: ${p.primary}; top: ${crossY - dotSize / 2}px; left: ${crossX - dotSize / 2}px; }
      .headline {
        position: absolute; top: ${crossY + Math.round(20 * s)}px; left: ${crossX + Math.round(20 * s)}px;
        max-width: ${Math.round(width * 0.55)}px;
        font-family: 'Display'; font-weight: 900;
        font-size: ${headlineSize}px; line-height: 1.1; letter-spacing: -1px;
      }
      .coord { position: absolute; top: ${crossY - Math.round(20 * s)}px; left: ${crossX + Math.round(12 * s)}px; font-family: 'Label'; font-size: ${Math.round(10 * s)}px; letter-spacing: 2px; color: ${p.primary}80; }
      .tagline { position: absolute; bottom: ${padY}px; left: ${padX}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .label { position: absolute; top: ${padY}px; left: ${padX}px; font-family: 'Label'; font-size: ${Math.round(10 * s)}px; letter-spacing: 4px; text-transform: uppercase; color: ${p.text}40; }
      .footer { position: absolute; bottom: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}30; }
    </style></head><body>
      <div class="h-line"></div>
      <div class="v-line"></div>
      <div class="h-line-2"></div>
      <div class="v-line-2"></div>
      <div class="dot"></div>
      <div class="coord">35 · 40</div>
      <div class="label">Behind the scenes</div>
      <div class="headline">${escapeHtml(copy.headline || "")}</div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Inversion — cream background, dark text. Breaks the dark-mode rule. */
/* ------------------------------------------------------------------ */

const testimonialInversion: TemplateDef = {
  id: "testimonial-inversion",
  name: "Inversion",
  contentType: "testimonial",
  copySlots: ["headline", "detail", "subtext"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const quoteSize = Math.round(42 * s);
    const nameSize = Math.round(15 * s);
    const roleSize = Math.round(12 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(64 * s);
    const padY = Math.round(64 * s);
    const quoteMarkSize = Math.round(280 * s);
    const borderW = Math.round(6 * s);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.text}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.background}; }
      .border-frame { position: absolute; inset: ${Math.round(16 * s)}px; border: ${borderW}px solid ${p.primary}; pointer-events: none; }
      .quote-mark {
        position: absolute; top: ${padY - Math.round(20 * s)}px; left: ${padX - Math.round(12 * s)}px;
        font-family: 'Display'; font-size: ${quoteMarkSize}px; line-height: 0.7;
        color: ${p.primary}12;
      }
      .content { position: absolute; top: 50%; left: ${padX}px; right: ${padX}px; transform: translateY(-50%); z-index: 1; }
      .quote { font-family: 'Body'; font-style: italic; font-size: ${quoteSize}px; line-height: 1.35; margin-bottom: ${Math.round(32 * s)}px; }
      .rule { width: ${Math.round(40 * s)}px; height: 3px; background: ${p.primary}; margin-bottom: ${Math.round(16 * s)}px; }
      .name { font-family: 'Label'; font-size: ${nameSize}px; letter-spacing: 2px; text-transform: uppercase; color: ${p.primary}; }
      .role { font-family: 'Body'; font-size: ${roleSize}px; color: ${p.background}80; margin-top: ${Math.round(4 * s)}px; }
      .footer { position: absolute; bottom: ${Math.round(24 * s)}px; left: 0; right: 0; text-align: center; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.background}30; }
    </style></head><body>
      <div class="border-frame"></div>
      <div class="quote-mark">&ldquo;</div>
      <div class="content">
        <div class="quote">&ldquo;${escapeHtml(copy.headline || "")}&rdquo;</div>
        <div class="rule"></div>
        <div class="name">${escapeHtml(copy.detail || "")}</div>
        <div class="role">${escapeHtml(copy.subtext || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Marquee — repeated headline as a rotated texture band               */
/* ------------------------------------------------------------------ */

const tipsMarquee: TemplateDef = {
  id: "tips-marquee",
  name: "Marquee",
  contentType: "tips",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const marqueeSize = Math.round(36 * s);
    const detailSize = Math.round(22 * s);
    const taglineSize = Math.round(16 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(48 * s);
    const bandH = Math.round(44 * s);

    const text = (copy.headline || "").replace(/\n/g, " ").toUpperCase();
    const repeated = (text + " · ").repeat(8);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .band {
        position: absolute; left: -20%; right: -20%;
        height: ${bandH}px; line-height: ${bandH}px;
        font-family: 'Display'; font-weight: 900; font-size: ${marqueeSize}px;
        letter-spacing: 2px; white-space: nowrap; overflow: hidden;
        color: ${p.text}; background: ${p.primary};
      }
      .band-1 { top: ${Math.round(height * 0.18)}px; transform: rotate(-5deg); }
      .band-2 { top: ${Math.round(height * 0.18) + bandH + Math.round(6 * s)}px; transform: rotate(-5deg); color: ${p.primary}; background: transparent; -webkit-text-stroke: 1px ${p.primary}50; }
      .content { position: absolute; bottom: ${padY}px; left: ${padX}px; right: ${padX}px; z-index: 2; }
      .detail { font-family: 'Body'; font-size: ${detailSize}px; color: ${p.text}cc; line-height: 1.6; margin-bottom: ${Math.round(16 * s)}px; max-width: 75%; }
      .tagline { font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; top: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}30; }
    </style></head><body>
      <div class="band band-1">${escapeHtml(repeated)}</div>
      <div class="band band-2">${escapeHtml(repeated)}</div>
      <div class="content">
        <div class="detail">${escapeHtml(copy.detail || "")}</div>
        <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      </div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

/* ------------------------------------------------------------------ */
/* Crop Bleed — text intentionally cropped by frame edges              */
/* ------------------------------------------------------------------ */

const portfolioCropBleed: TemplateDef = {
  id: "portfolio-crop-bleed",
  name: "Crop Bleed",
  contentType: "portfolio",
  copySlots: ["headline", "detail", "tagline"],
  renderHtml(copy, ratio, options) {
    const { width, height } = ASPECT_DIMENSIONS[ratio];
    const ff = options?.fontFaces ?? DEFAULT_FONT_FACES;
    const p = options?.palette ?? DEFAULT_PALETTE;
    const s = scaleForRatio(ratio);
    const headlineSize = Math.round(180 * s);
    const detailSize = Math.round(14 * s);
    const taglineSize = Math.round(15 * s);
    const footerSize = Math.round(11 * s);
    const padX = Math.round(48 * s);
    const padY = Math.round(48 * s);

    return `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      ${ff}
      body { width: ${width}px; height: ${height}px; background: ${p.background}; overflow: hidden; position: relative; font-family: 'Body', sans-serif; color: ${p.text}; }
      .headline {
        position: absolute; bottom: ${Math.round(-headlineSize * 0.25)}px; left: ${Math.round(-12 * s)}px;
        font-family: 'Display'; font-weight: 900;
        font-size: ${headlineSize}px; line-height: 0.9; letter-spacing: -6px;
        color: ${p.text}; text-transform: uppercase;
        max-width: ${Math.round(width * 1.15)}px;
      }
      .accent-block {
        position: absolute; top: 0; right: 0;
        width: ${Math.round(width * 0.28)}px; height: ${Math.round(height * 0.35)}px;
        background: ${p.primary};
      }
      .detail-block { position: absolute; top: ${Math.round(height * 0.35) + Math.round(20 * s)}px; right: ${padX}px; text-align: right; }
      .label { font-family: 'Label'; font-size: ${Math.round(10 * s)}px; letter-spacing: 4px; text-transform: uppercase; color: ${p.text}40; margin-bottom: ${Math.round(10 * s)}px; }
      .detail { font-family: 'Label'; font-size: ${detailSize}px; letter-spacing: 1px; text-transform: uppercase; color: ${p.text}70; line-height: 1.8; }
      .tagline { position: absolute; top: ${padY}px; left: ${padX}px; font-family: 'Body'; font-style: italic; font-size: ${taglineSize}px; color: ${p.accent}; }
      .footer { position: absolute; bottom: ${padY}px; right: ${padX}px; font-family: 'Label'; font-size: ${footerSize}px; letter-spacing: 3px; text-transform: uppercase; color: ${p.text}30; }
    </style></head><body>
      <div class="accent-block"></div>
      <div class="tagline">${escapeHtml(copy.tagline || "")}</div>
      <div class="detail-block">
        <div class="label">Recent work</div>
        <div class="detail">${escapeHtml((copy.detail || "").replace(/[·•,]\s*/g, "<br>"))}</div>
      </div>
      <div class="headline">${escapeHtml(copy.headline || "")}</div>
      <div class="footer">superbadmedia.com.au</div>
    </body></html>`;
  },
};

export const ALL_TEMPLATES: TemplateDef[] = [
  announcementBold,
  announcementMinimal,
  announcementStripe,
  announcementKnockout,
  antiMotivation,
  antiMotivationVoid,
  antiMotivationStacked,
  antiMotivationRedacted,
  tipsValue,
  tipsNumbered,
  tipsHeadlineOnly,
  tipsFullBleedStat,
  tipsMarquee,
  testimonialQuote,
  testimonialCard,
  testimonialOversized,
  testimonialInversion,
  behindTheScenes,
  btsTimestamp,
  btsRaw,
  btsCrosshair,
  portfolioShowcase,
  portfolioSplit,
  portfolioEditorial,
  portfolioDiagonal,
  portfolioCropBleed,
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

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

export const ALL_TEMPLATES: TemplateDef[] = [
  announcementBold,
  announcementMinimal,
  antiMotivation,
  tipsValue,
  testimonialQuote,
  behindTheScenes,
  portfolioShowcase,
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

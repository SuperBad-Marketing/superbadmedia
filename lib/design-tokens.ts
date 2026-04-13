/**
 * SuperBad Design System — TypeScript token mirror (A2)
 *
 * Single source of typed tokens for runtime use: Framer Motion configs,
 * sound registry, chart libs, anywhere TS code needs a token literal.
 *
 * Canonical source: app/globals.css (CSS custom properties).
 * Kept in sync via tests/tokens.test.ts — if a value here diverges from
 * the corresponding `--foo: …;` line in globals.css, the typecheck stays
 * green but `npm test` fails. Don't edit one without the other.
 *
 * Related spec: docs/specs/design-system-baseline.md
 */

/* ------------------------------------------------------------------ */
/* Brand tokens — locked, never altered by presets                    */
/* ------------------------------------------------------------------ */

export const brand = {
  red: "#B22848",
  cream: "#FDF5E6",
  pink: "#F4A0B0",
  orange: "#F28C52",
  charcoal: "#1A1A18",
} as const;

/* ------------------------------------------------------------------ */
/* Warm neutral scale                                                 */
/* ------------------------------------------------------------------ */

export const neutral = {
  950: "#0F0F0E",
  900: "#1A1A18",
  800: "#22221F",
  700: "#2C2C28",
  600: "#3D3D37",
  500: "#807F73",
  300: "#D4D2C2",
  100: "#FDF5E6",
} as const;

/* ------------------------------------------------------------------ */
/* Surface tints (reference neutrals)                                 */
/* ------------------------------------------------------------------ */

export const surface = {
  0: neutral[900],
  1: neutral[800],
  2: neutral[700],
  3: neutral[600],
} as const;

/* ------------------------------------------------------------------ */
/* Semantic tokens                                                    */
/* ------------------------------------------------------------------ */

export const semantic = {
  success: "#7BAE7E",
  warning: brand.orange,
  error: brand.red,
  info: neutral[300],
} as const;

/* ------------------------------------------------------------------ */
/* Spacing (px)                                                       */
/* ------------------------------------------------------------------ */

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

/* ------------------------------------------------------------------ */
/* Corner radius (px) — purpose-mapped                                */
/* ------------------------------------------------------------------ */

export const radius = {
  tight: 4,
  default: 8,
  generous: 16,
} as const;

/* ------------------------------------------------------------------ */
/* Type scale                                                         */
/* ------------------------------------------------------------------ */

export const typography = {
  display: { size: 64, lineHeight: 1.0 },
  h1: { size: 40, lineHeight: 1.1 },
  h2: { size: 28, lineHeight: 1.2 },
  h3: { size: 20, lineHeight: 1.3 },
  body: { size: 16, lineHeight: 1.5 },
  small: { size: 14, lineHeight: 1.5 },
  micro: { size: 12, lineHeight: 1.4 },
  narrative: { size: 24, lineHeight: 1.5 },
} as const;

/* ------------------------------------------------------------------ */
/* Motion — house spring + Tier 2 choreography timings                */
/*                                                                    */
/* Tier 1 = the default interaction spring used everywhere.           */
/* Tier 2 timings are reference values; named choreographies land     */
/* in A4 (motion + sound registry session).                           */
/* ------------------------------------------------------------------ */

export const houseSpring = {
  type: "spring",
  mass: 1,
  stiffness: 220,
  damping: 25,
} as const;

export const motion = {
  /** Framer Motion preset used on every Tier 1 interaction. */
  tier1Spring: houseSpring,
  /** CSS stand-in duration for Tier 1 when a spring isn't available. */
  tier1DurationMs: 280,
  tier1Ease: "cubic-bezier(0.2, 0.8, 0.2, 1.05)",
  /** Tier 2 slow-out curve for the morning brief / quote-accept class of moment. */
  tier2SlowMs: 800,
  tier2Ease: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Reduced-motion substitute duration (used when `prefers-reduced-motion: reduce`). */
  reducedDurationMs: 180,
} as const;

/* ------------------------------------------------------------------ */
/* Theme presets — the three hand-tuned closed-list variants          */
/* ------------------------------------------------------------------ */

export const THEME_PRESETS = ["standard", "late-shift", "quiet-hours"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];
export const DEFAULT_THEME_PRESET: ThemePreset = "standard";

/** CSS class applied to <html> per preset. `standard` applies no class. */
export const themePresetClass: Record<ThemePreset, string | null> = {
  standard: null,
  "late-shift": "theme-late-shift",
  "quiet-hours": "theme-quiet-hours",
};

/* ------------------------------------------------------------------ */
/* Typeface presets — body + narrative font swap                      */
/* ------------------------------------------------------------------ */

export const TYPEFACE_PRESETS = ["house", "long-read", "dispatch"] as const;
export type TypefacePreset = (typeof TYPEFACE_PRESETS)[number];
export const DEFAULT_TYPEFACE_PRESET: TypefacePreset = "house";

/** CSS class applied to <html> per preset. `house` applies no class. */
export const typefacePresetClass: Record<TypefacePreset, string | null> = {
  house: null,
  "long-read": "typeface-long-read",
  dispatch: "typeface-dispatch",
};

/* ------------------------------------------------------------------ */
/* Black Han Sans closed list — every place BHS is allowed to appear. */
/* Spec: design-system-baseline.md "Black Han Sans closed list" (Q6). */
/* ------------------------------------------------------------------ */

export const BHS_CLOSED_LIST = [
  "marketing_landing_hero",
  "morning_brief_headline",
  "quote_page_hero",
  "subscriber_dashboard_welcome",
  "client_portal_welcome",
  "empty_state_hero",
  "tier2_arrival_reveal",
  "setup_wizard_intro_and_completion",
] as const;
export type BhsLocation = (typeof BHS_CLOSED_LIST)[number];

/* ------------------------------------------------------------------ */
/* Generous radius closed list                                        */
/* ------------------------------------------------------------------ */

export const GENEROUS_RADIUS_CLOSED_LIST = [
  "quote_page_hero_card",
  "morning_brief_panel",
  "subscriber_dashboard_hero_card",
  "client_portal_welcome_panel",
] as const;
export type GenerousRadiusSurface = (typeof GENEROUS_RADIUS_CLOSED_LIST)[number];

/* ------------------------------------------------------------------ */
/* Accent opacity knobs — consumed by components that reference       */
/* pink / orange accents; theme-quiet-hours halves these.             */
/* ------------------------------------------------------------------ */

export const accentOpacity = {
  pink: 1,
  orange: 1,
} as const;

/* ------------------------------------------------------------------ */
/* Preference axes — the six user-facing Settings → Display controls. */
/* Values land as columns on the user table in A5; the Settings UI    */
/* lands in a post-A8 session. Types exported here so any consumer    */
/* can already speak the enum.                                        */
/* ------------------------------------------------------------------ */

export const MOTION_PREFERENCES = ["full", "reduced", "off"] as const;
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];
export const DEFAULT_MOTION_PREFERENCE: MotionPreference = "full";

export const DENSITY_PREFERENCES = ["comfort", "compact"] as const;
export type DensityPreference = (typeof DENSITY_PREFERENCES)[number];
export const DEFAULT_DENSITY_PREFERENCE: DensityPreference = "comfort";

export const TEXT_SIZE_PREFERENCES = ["standard", "large"] as const;
export type TextSizePreference = (typeof TEXT_SIZE_PREFERENCES)[number];
export const DEFAULT_TEXT_SIZE_PREFERENCE: TextSizePreference = "standard";

export const DEFAULT_SOUNDS_ENABLED = true;

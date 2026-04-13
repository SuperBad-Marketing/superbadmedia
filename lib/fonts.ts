/**
 * Font loading — all typefaces vendored as local .woff2 files under
 * `public/fonts/` and loaded via `next/font/local`. No build-time network
 * dependency on fonts.googleapis.com.
 *
 * Every font exports a `.variable` (the CSS custom property hook).
 * Layout attaches every variable to <html>; the active preset is
 * selected via CSS in app/globals.css (`.typeface-long-read` etc.).
 *
 * v1.0 reality: all three typeface-preset bundles are loaded on every
 * request. The "selective bundle load per preset" optimisation lives
 * as a PATCHES_OWED row for a later wave.
 *
 * Note on General Sans (the spec's Dispatch body face): General Sans
 * lives on Fontshare, not Google Fonts. We use Outfit as an on-brand
 * Google-available substitute.
 */
import localFont from "next/font/local";

/* Always-on faces (brand spine — never swapped by presets) */

export const displayFont = localFont({
  src: "../public/fonts/black-han-sans-400.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-black-han-sans",
  display: "swap",
});

export const labelFont = localFont({
  src: "../public/fonts/righteous-400.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-righteous",
  display: "swap",
});

export const logoFont = localFont({
  src: "../public/fonts/pacifico-400.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-pacifico",
  display: "swap",
});

/* House preset (default) */

export const houseBodyFont = localFont({
  src: "../public/fonts/dm-sans-var.woff2",
  weight: "100 1000",
  style: "normal",
  variable: "--font-dm-sans",
  display: "swap",
});

export const houseNarrativeFont = localFont({
  src: [
    {
      path: "../public/fonts/playfair-display-var.woff2",
      weight: "400 900",
      style: "normal",
    },
    {
      path: "../public/fonts/playfair-display-italic-var.woff2",
      weight: "400 900",
      style: "italic",
    },
  ],
  variable: "--font-playfair-display",
  display: "swap",
});

/* Long Read preset */

export const longReadBodyFont = localFont({
  src: "../public/fonts/plus-jakarta-sans-var.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export const longReadNarrativeFont = localFont({
  src: [
    { path: "../public/fonts/cormorant-garamond-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/cormorant-garamond-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../public/fonts/cormorant-garamond-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/cormorant-garamond-500-italic.woff2", weight: "500", style: "italic" },
    { path: "../public/fonts/cormorant-garamond-600.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/cormorant-garamond-600-italic.woff2", weight: "600", style: "italic" },
  ],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

/* Dispatch preset */

export const dispatchBodyFont = localFont({
  src: "../public/fonts/outfit-var.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-outfit",
  display: "swap",
});

export const dispatchNarrativeFont = localFont({
  src: [
    { path: "../public/fonts/dm-serif-display-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/dm-serif-display-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-dm-serif-display",
  display: "swap",
});

/** Every font variable joined as a space-separated className string. */
export const allFontVariables = [
  displayFont.variable,
  labelFont.variable,
  logoFont.variable,
  houseBodyFont.variable,
  houseNarrativeFont.variable,
  longReadBodyFont.variable,
  longReadNarrativeFont.variable,
  dispatchBodyFont.variable,
  dispatchNarrativeFont.variable,
].join(" ");

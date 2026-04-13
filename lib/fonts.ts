/**
 * Font loading — all next/font/google bundles declared in one place.
 *
 * Every font exports a `.variable` (the CSS custom property hook).
 * Layout attaches every variable to <html>; the active preset is
 * selected via CSS in app/globals.css (`.typeface-long-read` etc.).
 *
 * v1.0 reality: all three typeface-preset bundles are loaded on every
 * request. The "selective bundle load per preset" optimisation lives
 * as a PATCHES_OWED row for a later wave — doing it properly requires
 * layout-per-preset routing that isn't worth the complexity for the
 * small number of typography bytes in play today.
 *
 * Note on General Sans (the spec's Dispatch body face): General Sans
 * lives on Fontshare, not Google Fonts. We use Outfit as an on-brand
 * Google-available substitute. Swap for Fontshare-hosted General Sans
 * in a later wave if the difference ever matters.
 */
import {
  Black_Han_Sans,
  Cormorant_Garamond,
  DM_Sans,
  DM_Serif_Display,
  Outfit,
  Pacifico,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Righteous,
} from "next/font/google";

/* Always-on faces (brand spine — never swapped by presets) */

export const displayFont = Black_Han_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-black-han-sans",
  display: "swap",
});

export const labelFont = Righteous({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-righteous",
  display: "swap",
});

export const logoFont = Pacifico({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pacifico",
  display: "swap",
});

/* House preset (default) */

export const houseBodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const houseNarrativeFont = Playfair_Display({
  subsets: ["latin"],
  style: ["italic", "normal"],
  variable: "--font-playfair-display",
  display: "swap",
});

/* Long Read preset */

export const longReadBodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export const longReadNarrativeFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["italic", "normal"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

/* Dispatch preset */

export const dispatchBodyFont = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const dispatchNarrativeFont = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["italic", "normal"],
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

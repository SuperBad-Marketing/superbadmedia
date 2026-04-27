export interface FontPairing {
  id: string;
  name: string;
  displayFamily: string;
  bodyFamily: string;
  labelFamily: string;
  narrativeFamily: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: "house",
    name: "House",
    displayFamily: "'Black Han Sans', sans-serif",
    bodyFamily: "'DM Sans', sans-serif",
    labelFamily: "'DM Sans', sans-serif",
    narrativeFamily: "'DM Sans', sans-serif",
  },
  {
    id: "editorial",
    name: "Editorial",
    displayFamily: "'Playfair Display', serif",
    bodyFamily: "'DM Sans', sans-serif",
    labelFamily: "'DM Sans', sans-serif",
    narrativeFamily: "'Playfair Display', serif",
  },
  {
    id: "dispatch",
    name: "Dispatch",
    displayFamily: "'DM Serif Display', serif",
    bodyFamily: "'Outfit', sans-serif",
    labelFamily: "'Outfit', sans-serif",
    narrativeFamily: "'DM Serif Display', serif",
  },
  {
    id: "modern",
    name: "Modern",
    displayFamily: "'Plus Jakarta Sans', sans-serif",
    bodyFamily: "'Plus Jakarta Sans', sans-serif",
    labelFamily: "'Plus Jakarta Sans', sans-serif",
    narrativeFamily: "'Plus Jakarta Sans', sans-serif",
  },
  {
    id: "statement",
    name: "Statement",
    displayFamily: "'Black Han Sans', sans-serif",
    bodyFamily: "'Outfit', sans-serif",
    labelFamily: "'Outfit', sans-serif",
    narrativeFamily: "'Outfit', sans-serif",
  },
  {
    id: "classic",
    name: "Classic",
    displayFamily: "'Cormorant Garamond', serif",
    bodyFamily: "'Plus Jakarta Sans', sans-serif",
    labelFamily: "'Plus Jakarta Sans', sans-serif",
    narrativeFamily: "'Cormorant Garamond', serif",
  },
  {
    id: "minimal",
    name: "Minimal",
    displayFamily: "'Outfit', sans-serif",
    bodyFamily: "'Outfit', sans-serif",
    labelFamily: "'Outfit', sans-serif",
    narrativeFamily: "'Outfit', sans-serif",
  },
  {
    id: "bold",
    name: "Bold",
    displayFamily: "'Righteous', sans-serif",
    bodyFamily: "'DM Sans', sans-serif",
    labelFamily: "'DM Sans', sans-serif",
    narrativeFamily: "'DM Sans', sans-serif",
  },
];

export function getFontPairing(id: string): FontPairing | undefined {
  return FONT_PAIRINGS.find((p) => p.id === id);
}

export function getDefaultFontPairing(): FontPairing {
  return FONT_PAIRINGS[0];
}

const FONT_FILE_MAP: Record<string, Record<"display" | "body" | "label" | "narrative", string>> = {
  house: { display: "black-han-sans-400.woff2", body: "dm-sans-var.woff2", label: "dm-sans-var.woff2", narrative: "dm-sans-var.woff2" },
  editorial: { display: "playfair-display-var.woff2", body: "dm-sans-var.woff2", label: "dm-sans-var.woff2", narrative: "playfair-display-italic-var.woff2" },
  dispatch: { display: "dm-serif-display-400.woff2", body: "outfit-var.woff2", label: "outfit-var.woff2", narrative: "dm-serif-display-400-italic.woff2" },
  modern: { display: "plus-jakarta-sans-var.woff2", body: "plus-jakarta-sans-var.woff2", label: "plus-jakarta-sans-var.woff2", narrative: "plus-jakarta-sans-var.woff2" },
  statement: { display: "black-han-sans-400.woff2", body: "outfit-var.woff2", label: "outfit-var.woff2", narrative: "outfit-var.woff2" },
  classic: { display: "cormorant-garamond-600.woff2", body: "plus-jakarta-sans-var.woff2", label: "plus-jakarta-sans-var.woff2", narrative: "cormorant-garamond-500-italic.woff2" },
  minimal: { display: "outfit-var.woff2", body: "outfit-var.woff2", label: "outfit-var.woff2", narrative: "outfit-var.woff2" },
  bold: { display: "righteous-400.woff2", body: "dm-sans-var.woff2", label: "dm-sans-var.woff2", narrative: "dm-sans-var.woff2" },
};

function buildFontFaces(id: string, prefix: string): string {
  const files = FONT_FILE_MAP[id];
  if (!files) return DEFAULT_FONT_FACES;
  return `
    @font-face { font-family: 'Display'; src: url('${prefix}${files.display}') format('woff2'); font-weight: 900; }
    @font-face { font-family: 'Body'; src: url('${prefix}${files.body}') format('woff2'); font-weight: 400; }
    @font-face { font-family: 'Label'; src: url('${prefix}${files.label}') format('woff2'); font-weight: 600; }
    @font-face { font-family: 'Narrative'; src: url('${prefix}${files.narrative}') format('woff2'); font-weight: 400; font-style: italic; }
  `;
}

const DEFAULT_FONT_FACES = `
  @font-face { font-family: 'Display'; src: local('Inter'); font-weight: 900; }
  @font-face { font-family: 'Body'; src: local('Inter'); font-weight: 400; }
  @font-face { font-family: 'Label'; src: local('Inter'); font-weight: 600; }
  @font-face { font-family: 'Narrative'; src: local('Inter'); font-weight: 400; font-style: italic; }
`;

export function getFontFacesForBrowser(id: string): string {
  return buildFontFaces(id, "/fonts/");
}

export function getFontFacesForServer(id: string): string {
  const { join } = require("path") as typeof import("path");
  const prefix = `file://${join(process.cwd(), "public/fonts")}/`;
  return buildFontFaces(id, prefix);
}

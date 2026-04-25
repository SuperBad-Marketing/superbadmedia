import type { ColourPalette } from "./types";

export const BRAND_PALETTES: ColourPalette[] = [
  {
    id: "default-dark",
    name: "Default Dark",
    source: "brand",
    background: "#0F0F0E",
    primary: "#B22848",
    accent: "#F28C52",
    text: "#FDF5E6",
  },
  {
    id: "pink-forward",
    name: "Pink Forward",
    source: "brand",
    background: "#0F0F0E",
    primary: "#F4A0B0",
    accent: "#B22848",
    text: "#FDF5E6",
  },
  {
    id: "cream-invert",
    name: "Cream Invert",
    source: "brand",
    background: "#FDF5E6",
    primary: "#B22848",
    accent: "#F28C52",
    text: "#0F0F0E",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    source: "brand",
    background: "#0F0F0E",
    primary: "#FDF5E6",
    accent: "#807F73",
    text: "#FDF5E6",
  },
  {
    id: "orange-warm",
    name: "Orange Warm",
    source: "brand",
    background: "#0F0F0E",
    primary: "#F28C52",
    accent: "#FDF5E6",
    text: "#FDF5E6",
  },
];

export function getPalette(id: string): ColourPalette | undefined {
  return BRAND_PALETTES.find((p) => p.id === id);
}

export function generateClientPalettes(
  clientPrimary: string,
  clientName: string,
): ColourPalette[] {
  return [
    {
      id: `client-${clientName.toLowerCase().replace(/\s+/g, "-")}-primary`,
      name: `${clientName} Primary`,
      source: "client-dna",
      background: "#0F0F0E",
      primary: clientPrimary,
      accent: "#FDF5E6",
      text: "#FDF5E6",
    },
    {
      id: `client-${clientName.toLowerCase().replace(/\s+/g, "-")}-inverted`,
      name: `${clientName} Inverted`,
      source: "client-dna",
      background: clientPrimary,
      primary: "#FDF5E6",
      accent: "#0F0F0E",
      text: "#FDF5E6",
    },
    {
      id: `client-${clientName.toLowerCase().replace(/\s+/g, "-")}-superbad`,
      name: `${clientName} + SuperBad`,
      source: "client-dna",
      background: "#0F0F0E",
      primary: clientPrimary,
      accent: "#B22848",
      text: "#FDF5E6",
    },
  ];
}

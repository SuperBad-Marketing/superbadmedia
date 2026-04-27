import React from "react";
import { staticFile } from "remotion";

const FONT_FILES: Record<
  string,
  { display: string; body: string; label: string; narrative: string }
> = {
  house: {
    display: "black-han-sans-400.woff2",
    body: "dm-sans-var.woff2",
    label: "dm-sans-var.woff2",
    narrative: "dm-sans-var.woff2",
  },
  editorial: {
    display: "playfair-display-var.woff2",
    body: "dm-sans-var.woff2",
    label: "dm-sans-var.woff2",
    narrative: "playfair-display-italic-var.woff2",
  },
  dispatch: {
    display: "dm-serif-display-400.woff2",
    body: "outfit-var.woff2",
    label: "outfit-var.woff2",
    narrative: "dm-serif-display-400-italic.woff2",
  },
  modern: {
    display: "plus-jakarta-sans-var.woff2",
    body: "plus-jakarta-sans-var.woff2",
    label: "plus-jakarta-sans-var.woff2",
    narrative: "plus-jakarta-sans-var.woff2",
  },
  statement: {
    display: "black-han-sans-400.woff2",
    body: "outfit-var.woff2",
    label: "outfit-var.woff2",
    narrative: "outfit-var.woff2",
  },
  classic: {
    display: "cormorant-garamond-600.woff2",
    body: "plus-jakarta-sans-var.woff2",
    label: "plus-jakarta-sans-var.woff2",
    narrative: "cormorant-garamond-500-italic.woff2",
  },
  minimal: {
    display: "outfit-var.woff2",
    body: "outfit-var.woff2",
    label: "outfit-var.woff2",
    narrative: "outfit-var.woff2",
  },
  bold: {
    display: "righteous-400.woff2",
    body: "dm-sans-var.woff2",
    label: "dm-sans-var.woff2",
    narrative: "dm-sans-var.woff2",
  },
};

export const FONT_DISPLAY = "'Display', sans-serif";
export const FONT_BODY = "'Body', sans-serif";
export const FONT_LABEL = "'Label', sans-serif";
export const FONT_NARRATIVE = "'Narrative', sans-serif";

export const MotionFonts: React.FC<{ fontPairingId?: string }> = ({
  fontPairingId,
}) => {
  const id = fontPairingId || "house";
  const files = FONT_FILES[id];
  if (!files) return null;

  const css = [
    `@font-face { font-family: 'Display'; src: url('${staticFile(`fonts/${files.display}`)}') format('woff2'); font-display: block; }`,
    `@font-face { font-family: 'Body'; src: url('${staticFile(`fonts/${files.body}`)}') format('woff2'); font-display: block; }`,
    `@font-face { font-family: 'Label'; src: url('${staticFile(`fonts/${files.label}`)}') format('woff2'); font-display: block; }`,
    `@font-face { font-family: 'Narrative'; src: url('${staticFile(`fonts/${files.narrative}`)}') format('woff2'); font-style: italic; font-display: block; }`,
  ].join("\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
};

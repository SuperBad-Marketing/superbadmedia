import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import { computeLayout } from "../layouts";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { useFadeIn } from "./shared";

export const TextRevealMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

  const text = copy.headline || "";
  const words = text.split(/\s+/).filter(Boolean);
  const emphasisWords = (copy.emphasis || "")
    .split(",")
    .map((w) => w.trim().toLowerCase());

  const framesPerWord = Math.max(5, Math.floor(50 / Math.max(words.length, 1)));
  const footerFade = useFadeIn(words.length * framesPerWord + 15, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        color: palette.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: lyt.justifyContent,
        alignItems: lyt.alignItems,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <Atmosphere
        palette={palette}
        transparent={transparent}
        gradientPosition="center"
        gradientIntensity={0.18}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: lyt.textAlign,
          padding: `${lyt.paddingY}px ${lyt.paddingX}px`,
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: lyt.justifyContent,
          alignItems: "center",
          gap: lyt.elementGap,
        }}
      >
        {words.map((word, i) => {
          const startFrame = 5 + i * framesPerWord;
          const wordSpring = spring({
            frame: frame - startFrame,
            fps,
            config: { mass: 0.6, stiffness: 400, damping: 13 },
          });
          const opacity = interpolate(wordSpring, [0, 1], [0, 1]);
          const y = interpolate(wordSpring, [0, 1], [24, 0]);
          const isEmphasis = emphasisWords.includes(word.toLowerCase());

          return (
            <span
              key={i}
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: isEmphasis ? 900 : 700,
                fontSize: isEmphasis ? lyt.headlineFontSize * 1.05 : lyt.headlineFontSize,
                lineHeight: 1.2,
                color: isEmphasis ? palette.primary : palette.text,
                opacity,
                transform: `translateY(${y}px)`,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {copy.tagline && (
        <div
          style={{
            position: "absolute",
            bottom: lyt.paddingY * 2,
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: lyt.taglineFontSize,
            color: palette.accent,
            opacity: useFadeIn(words.length * framesPerWord + 5, 12),
          }}
        >
          {copy.tagline}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: lyt.paddingY,
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: lyt.footerFontSize,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}40`,
          opacity: footerFade,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

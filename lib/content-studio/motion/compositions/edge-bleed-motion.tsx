import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import { getCanvasScale } from "../layouts";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { useFadeIn } from "./shared";

export const EdgeBleedMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const headline = copy.headline || "";
  const words = headline.split("\n").length > 1
    ? headline.split("\n")
    : headline.split(/\s+/);

  const headlineSize = Math.round(120 * s);
  const padY = Math.round(60 * s);

  const taglineFade = useFadeIn(45, 15);
  const footerFade = useFadeIn(60, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        color: palette.text,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <Atmosphere
        palette={palette}
        transparent={transparent}
        gradientPosition="top-right"
        gradientIntensity={0.18}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: padY,
          paddingBottom: padY,
        }}
      >
        {words.map((word, i) => {
          const startFrame = 5 + i * 8;
          const direction = i % 2 === 0 ? -1 : 1;
          const overshoot = width * 0.12 * direction;

          const enterProgress = spring({
            frame: frame - startFrame,
            fps,
            config: { mass: 0.6, stiffness: 280, damping: 16 },
          });

          const slideFrom = direction * width * 0.6;
          const translateX = interpolate(
            enterProgress,
            [0, 1],
            [slideFrom, overshoot],
          );
          const opacity = interpolate(enterProgress, [0, 0.3], [0, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 900,
                fontSize: headlineSize,
                lineHeight: 0.9,
                letterSpacing: -3,
                color: i === 0 ? palette.primary : palette.text,
                opacity,
                transform: `translateX(${translateX}px)`,
                whiteSpace: "nowrap",
                paddingLeft: Math.round(24 * s),
              }}
            >
              {word}
            </div>
          );
        })}

        {copy.tagline && (
          <div
            style={{
              position: "absolute",
              bottom: padY + Math.round(48 * s),
              right: Math.round(48 * s),
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: Math.round(20 * s),
              color: palette.accent,
              opacity: taglineFade,
              textAlign: "right",
            }}
          >
            {copy.tagline}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: padY,
          left: Math.round(24 * s),
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(12 * s),
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

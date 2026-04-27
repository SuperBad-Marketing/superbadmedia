import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_BODY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { AccentLine } from "./accent-shapes";
import { useFadeIn, useSlideUp } from "./shared";

export const TipsValueMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineFontSize = isLandscape ? 56 : isSquare ? 80 : 96;
  const bodyFontSize = isLandscape ? 18 : 22;
  const pad = isLandscape ? "40px 60px" : "60px 48px";

  const brandFade = useFadeIn(0, 12);
  const headline = useSlideUp(8, 35);
  const taglineFade = useFadeIn(65, 12);
  const footerFade = useFadeIn(75, 12);

  const detailText = copy.detail || "";
  const charsPerFrame = detailText.length / 28;
  const visibleChars = Math.min(
    detailText.length,
    Math.max(0, Math.floor((frame - 40) * charsPerFrame)),
  );
  const detailVisible = detailText.slice(0, visibleChars);
  const detailOpacity = interpolate(frame, [40, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        fontFamily: FONT_BODY,
        color: palette.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <Atmosphere
        palette={palette}
        transparent={transparent}
        gradientPosition="top-right"
        gradientIntensity={0.22}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: pad,
          width: "100%",
        }}
      >
        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: isLandscape ? 14 : 16,
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.primary,
            marginBottom: isLandscape ? 20 : 32,
            opacity: brandFade,
          }}
        >
          SuperBad
        </div>

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: headlineFontSize,
            lineHeight: 0.95,
            letterSpacing: -2,
            marginBottom: isLandscape ? 16 : 24,
            color: palette.text,
            opacity: headline.opacity,
            transform: `translateY(${headline.translateY}px)`,
          }}
        >
          {copy.headline || ""}
        </div>

        <AccentLine
          startFrame={28}
          width={48}
          height={3}
          color={`linear-gradient(90deg, ${palette.accent}, ${palette.primary})`}
          direction="center-out"
          style={{ margin: `0 auto ${isLandscape ? 16 : 24}px` }}
        />

        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: bodyFontSize,
            lineHeight: 1.6,
            color: palette.text,
            opacity: detailOpacity,
          }}
        >
          {detailVisible}
          {visibleChars < detailText.length && (
            <span
              style={{
                opacity: interpolate(
                  frame % 20,
                  [0, 10, 20],
                  [1, 0.2, 1],
                ),
              }}
            >
              |
            </span>
          )}
        </div>

        <div
          style={{
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: isLandscape ? 16 : 20,
            color: palette.accent,
            marginTop: isLandscape ? 12 : 20,
            opacity: taglineFade,
          }}
        >
          {copy.tagline || ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: isLandscape ? 20 : 40,
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: 12,
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

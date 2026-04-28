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
  FONT_BODY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";

export const TypewriterMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  animationParams,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

  const charSpeed = (animationParams?.charSpeed as number) ?? 2;
  const headline = copy.headline || "";
  const charsVisible = Math.floor(frame / Math.max(1, charSpeed));
  const displayText = headline.slice(0, charsVisible);
  const showCursor = frame % 16 < 10 || charsVisible < headline.length;
  const cursorColor =
    charsVisible >= headline.length ? palette.primary : palette.text;

  const detailStart = headline.length * charSpeed + 15;
  const detailProgress = spring({
    frame: frame - detailStart,
    fps,
    config: { mass: 1.2, stiffness: 120, damping: 18 },
  });
  const detailOpacity = interpolate(detailProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineStart = detailStart + 20;
  const taglineProgress = spring({
    frame: frame - taglineStart,
    fps,
    config: { mass: 1.2, stiffness: 120, damping: 18 },
  });
  const taglineOpacity = interpolate(taglineProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const footerStart = taglineStart + 15;
  const footerProgress = spring({
    frame: frame - footerStart,
    fps,
    config: { mass: 1.2, stiffness: 120, damping: 18 },
  });
  const footerOpacity = interpolate(footerProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

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
        gradientIntensity={0.15}
        gradientPosition="top-left"
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: `0 ${lyt.paddingX}px`,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: lyt.justifyContent,
        }}
      >
        {/* Headline with typewriter effect */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: lyt.headlineFontSize,
            lineHeight: lyt.headlineLineHeight,
            letterSpacing: lyt.headlineLetterSpacing,
            color: palette.text,
            marginBottom: lyt.elementGap,
            minHeight: lyt.headlineFontSize * 2,
          }}
        >
          {displayText}
          {showCursor && (
            <span
              style={{
                display: "inline-block",
                width: Math.round(3 * lyt.scale),
                height: lyt.headlineFontSize * 0.85,
                background: cursorColor,
                marginLeft: Math.round(2 * lyt.scale),
                verticalAlign: "text-bottom",
                opacity: showCursor ? 1 : 0,
              }}
            />
          )}
        </div>

        {/* Detail */}
        {copy.detail && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 400,
              fontSize: lyt.detailFontSize,
              lineHeight: 1.5,
              color: `${palette.text}BB`,
              maxWidth: lyt.contentMaxWidth,
              opacity: detailOpacity,
              marginBottom: lyt.elementGap,
            }}
          >
            {copy.detail}
          </div>
        )}

        {/* Tagline */}
        {copy.tagline && (
          <div
            style={{
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: lyt.taglineFontSize,
              color: palette.accent,
              opacity: taglineOpacity,
            }}
          >
            {copy.tagline}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: lyt.paddingY,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: lyt.footerFontSize,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}30`,
          opacity: footerOpacity,
          zIndex: 10,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import {
  AbsoluteFill,
  interpolate,
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
import { AccentLine } from "./accent-shapes";
import { useFadeIn, useSlideUp } from "./shared";

export const TipsValueMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

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
        justifyContent: lyt.justifyContent,
        alignItems: lyt.alignItems,
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
          textAlign: lyt.textAlign,
          padding: `${lyt.paddingY}px ${lyt.paddingX}px`,
          width: "100%",
          maxWidth: lyt.contentMaxWidth,
        }}
      >
        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: lyt.brandFontSize,
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.primary,
            marginBottom: lyt.elementGap,
            opacity: brandFade,
          }}
        >
          SuperBad
        </div>

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: lyt.headlineFontSize,
            lineHeight: lyt.headlineLineHeight,
            letterSpacing: lyt.headlineLetterSpacing,
            marginBottom: lyt.elementGap,
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
          style={{ margin: `0 auto ${lyt.elementGap}px` }}
        />

        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: lyt.detailFontSize,
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
            fontSize: lyt.taglineFontSize,
            color: palette.accent,
            marginTop: lyt.elementGap,
            opacity: taglineFade,
          }}
        >
          {copy.tagline || ""}
        </div>
      </div>

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

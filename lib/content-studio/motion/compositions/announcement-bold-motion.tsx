import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
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
import { useFadeIn, useSlamIn, useSlideUp } from "./shared";

export const AnnouncementBoldMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  layout,
}) => {
  const { width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

  const brandFade = useFadeIn(0, 12);
  const headline = useSlamIn(8);
  const detailSlide = useSlideUp(32, 25);
  const subtextFade = useFadeIn(46, 12);
  const taglineFade = useFadeIn(56, 15);
  const footerFade = useFadeIn(70, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        fontFamily: FONT_BODY,
        color: palette.text,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <Atmosphere
        palette={palette}
        transparent={transparent}
        gradientPosition="top-left"
        gradientIntensity={0.28}
        secondaryGradient
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: lyt.textAlign,
          padding: `${lyt.paddingY}px ${lyt.paddingX}px`,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: lyt.justifyContent,
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
            transform: `translateY(${headline.y}px) scale(${headline.scale})`,
            transformOrigin: "left center",
          }}
        >
          {copy.headline || ""}
        </div>

        <AccentLine
          startFrame={24}
          width={Math.round(80 * lyt.scale)}
          height={3}
          color={palette.accent}
          direction="left-to-right"
          style={{ marginBottom: lyt.elementGap }}
        />

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: lyt.detailFontSize,
            color: palette.primary,
            maxWidth: lyt.contentMaxWidth,
            marginBottom: lyt.elementGap,
            opacity: detailSlide.opacity,
            transform: `translateY(${detailSlide.translateY}px)`,
          }}
        >
          {copy.detail || ""}
        </div>

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: lyt.labelFontSize,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: `${palette.text}80`,
            marginBottom: lyt.elementGap,
            opacity: subtextFade,
          }}
        >
          {copy.subtext || ""}
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
          left: 0,
          right: 0,
          textAlign: "center",
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

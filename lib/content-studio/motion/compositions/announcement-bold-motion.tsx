import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
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
import { useFadeIn, useSlamIn, useSlideUp } from "./shared";

export const AnnouncementBoldMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const { width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineFontSize = isLandscape ? 60 : isSquare ? 84 : 100;
  const detailFontSize = isLandscape ? 36 : isSquare ? 48 : 56;
  const pad = isLandscape ? "40px 60px" : "60px 48px";

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
          textAlign: "left",
          padding: pad,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
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
            marginBottom: isLandscape ? 20 : 28,
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
            marginBottom: isLandscape ? 16 : 20,
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
          width={isLandscape ? 60 : 80}
          height={3}
          color={palette.accent}
          direction="left-to-right"
          style={{ marginBottom: isLandscape ? 16 : 20 }}
        />

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: detailFontSize,
            color: palette.primary,
            marginBottom: isLandscape ? 8 : 12,
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
            fontSize: isLandscape ? 16 : 20,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: `${palette.text}80`,
            marginBottom: isLandscape ? 8 : 12,
            opacity: subtextFade,
          }}
        >
          {copy.subtext || ""}
        </div>

        <div
          style={{
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: isLandscape ? 16 : 20,
            color: palette.accent,
            marginTop: isLandscape ? 12 : 16,
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
          left: 0,
          right: 0,
          textAlign: "center",
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

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { useFadeIn, useSlideUp } from "./shared";

export const TestimonialQuoteMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const quoteFontSize = isLandscape ? 28 : isSquare ? 40 : 48;
  const pad = isLandscape ? "40px 60px" : "60px 48px";

  const quoteMarkScale = spring({
    frame: frame - 5,
    fps,
    config: { mass: 0.6, stiffness: 350, damping: 12 },
  });
  const quoteMarkOpacity = interpolate(quoteMarkScale, [0, 1], [0, 1]);

  const brandFade = useFadeIn(0, 12);
  const quoteFade = useFadeIn(15, 18);
  const attribution = useSlideUp(45, 20);
  const subtextFade = useFadeIn(55, 12);
  const footerFade = useFadeIn(65, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
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
        gradientPosition="center"
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
            fontSize: quoteFontSize * 2,
            color: palette.primary,
            lineHeight: 0.5,
            marginBottom: 16,
            opacity: quoteMarkOpacity,
            transform: `scale(${quoteMarkScale})`,
          }}
        >
          {"“"}
        </div>

        <div
          style={{
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: quoteFontSize,
            lineHeight: 1.4,
            color: palette.text,
            marginBottom: isLandscape ? 16 : 24,
            opacity: quoteFade,
          }}
        >
          {copy.headline || ""}
        </div>

        <div
          style={{
            width: 48,
            height: 3,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.primary})`,
            margin: `0 auto ${isLandscape ? 12 : 16}px`,
            borderRadius: 2,
            opacity: quoteFade,
          }}
        />

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: isLandscape ? 14 : 16,
            letterSpacing: 2,
            textTransform: "uppercase" as const,
            color: palette.accent,
            opacity: attribution.opacity,
            transform: `translateY(${attribution.translateY}px)`,
          }}
        >
          {copy.detail ? `— ${copy.detail}` : ""}
        </div>

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: isLandscape ? 14 : 16,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: `${palette.text}60`,
            marginTop: 8,
            opacity: subtextFade,
          }}
        >
          {copy.subtext || ""}
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

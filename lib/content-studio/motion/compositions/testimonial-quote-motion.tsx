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
import { useFadeIn, useSlideUp } from "./shared";

export const TestimonialQuoteMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

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
        gradientIntensity={0.22}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: lyt.textAlign,
          padding: `${lyt.paddingY}px ${lyt.paddingX}px`,
          width: "100%",
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
            fontSize: lyt.headlineFontSize * 2,
            color: palette.primary,
            lineHeight: 0.5,
            marginBottom: lyt.elementGap,
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
            fontSize: lyt.headlineFontSize,
            lineHeight: 1.4,
            color: palette.text,
            marginBottom: lyt.elementGap,
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
            margin: `0 auto ${lyt.elementGap}px`,
            borderRadius: 2,
            opacity: quoteFade,
          }}
        />

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: lyt.labelFontSize,
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
            fontSize: lyt.labelFontSize,
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

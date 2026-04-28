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
  FONT_BODY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { useFadeIn, useBlurReveal } from "./shared";

export const BtsCaptionMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

  const brandFade = useFadeIn(0, 12);
  const headlineBlur = useBlurReveal(5, 14, 22);

  const taglineProgress = spring({
    frame: frame - 35,
    fps,
    config: { mass: 0.7, stiffness: 300, damping: 14 },
  });
  const taglineX = interpolate(taglineProgress, [0, 1], [40, 0]);
  const taglineOpacity = interpolate(taglineProgress, [0, 1], [0, 1]);

  const footerFade = useFadeIn(55, 12);

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
        gradientIntensity={0.2}
        grainOpacity={0.055}
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
            color: palette.accent,
            marginBottom: lyt.elementGap,
            opacity: brandFade,
          }}
        >
          Behind the scenes
        </div>

        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 400,
            fontSize: lyt.headlineFontSize,
            lineHeight: 1.5,
            color: palette.text,
            opacity: headlineBlur.opacity,
            filter: `blur(${headlineBlur.blur}px)`,
          }}
        >
          {copy.headline || ""}
        </div>

        <div
          style={{
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: lyt.taglineFontSize,
            color: palette.accent,
            marginTop: lyt.elementGap,
            opacity: taglineOpacity,
            transform: `translateX(${taglineX}px)`,
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

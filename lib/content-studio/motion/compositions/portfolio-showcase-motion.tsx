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
import { AccentLine } from "./accent-shapes";
import { useFadeIn, useSlideUp } from "./shared";

export const PortfolioShowcaseMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

  const wipeProgress = spring({
    frame: frame - 3,
    fps,
    config: { mass: 0.8, stiffness: 280, damping: 16 },
  });
  const labelClipX = interpolate(wipeProgress, [0, 1], [100, 0]);

  const headline = useSlideUp(15, 35);
  const subtextFade = useFadeIn(45, 12);
  const taglineFade = useFadeIn(55, 12);
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
        gradientPosition="top-left"
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
            color: palette.accent,
            marginBottom: lyt.elementGap,
            overflow: "hidden",
          }}
        >
          <div style={{ transform: `translateX(-${labelClipX}%)` }}>
            Recent work
          </div>
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
          startFrame={33}
          width={48}
          height={3}
          color={`linear-gradient(90deg, ${palette.accent}, ${palette.primary})`}
          direction="center-out"
          style={{ margin: `0 auto ${lyt.elementGap}px` }}
        />

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: lyt.labelFontSize,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: `${palette.text}70`,
            marginBottom: lyt.elementGap,
            opacity: subtextFade,
          }}
        >
          {copy.detail || ""}
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

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
import { AccentLine } from "./accent-shapes";
import { useFadeIn, useSlideUp } from "./shared";

export const PortfolioShowcaseMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineFontSize = isLandscape ? 56 : isSquare ? 80 : 96;
  const pad = isLandscape ? "40px 60px" : "60px 48px";

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
        justifyContent: "center",
        alignItems: "center",
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
            color: palette.accent,
            marginBottom: isLandscape ? 20 : 32,
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
          startFrame={33}
          width={48}
          height={3}
          color={`linear-gradient(90deg, ${palette.accent}, ${palette.primary})`}
          direction="center-out"
          style={{ margin: `0 auto ${isLandscape ? 12 : 16}px` }}
        />

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: isLandscape ? 16 : 20,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: `${palette.text}70`,
            marginBottom: isLandscape ? 8 : 12,
            opacity: subtextFade,
          }}
        >
          {copy.detail || ""}
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

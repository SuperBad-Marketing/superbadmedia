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
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { AccentDot } from "./accent-shapes";
import { useFadeIn } from "./shared";

export const AntiMotivationTypographyMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

  const headlineProgress = spring({
    frame: frame - 5,
    fps,
    config: { mass: 1, stiffness: 200, damping: 16 },
  });
  const headlineY = interpolate(headlineProgress, [0, 1], [50, 0]);
  const headlineOpacity = interpolate(headlineProgress, [0, 1], [0, 1]);

  const letterSpacing = interpolate(
    frame,
    [25, 45, 65, 85],
    [-4, 0, -4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "extend" },
  );

  const dividerFade = useFadeIn(35, 12);
  const taglineFade = useFadeIn(45, 15);
  const footerFade = useFadeIn(60, 12);

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
        gradientIntensity={0.3}
        grainOpacity={0.045}
        secondaryGradient
      />

      <AccentDot
        startFrame={15}
        x={width * 0.2}
        y={height * 0.3}
        radius={8}
        color={palette.primary}
        opacity={0.15}
      />
      <AccentDot
        startFrame={20}
        x={width * 0.78}
        y={height * 0.65}
        radius={6}
        color={palette.accent}
        opacity={0.12}
      />
      <AccentDot
        startFrame={25}
        x={width * 0.15}
        y={height * 0.72}
        radius={5}
        color={palette.primary}
        opacity={0.1}
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
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: lyt.headlineFontSize,
            lineHeight: 0.92,
            letterSpacing,
            color: palette.text,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          {copy.headline || ""}
        </div>

        <div
          style={{
            width: 48,
            height: 3,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.primary})`,
            margin: `${lyt.elementGap}px auto`,
            borderRadius: 2,
            opacity: dividerFade,
          }}
        />

        <div
          style={{
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: lyt.taglineFontSize,
            color: palette.accent,
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

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import { getCanvasScale } from "../layouts";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_LABEL,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { AccentLine } from "./accent-shapes";
import { useBlurReveal } from "./shared";

export const LogoStingMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const logoFontSize = Math.round(96 * s);

  const logoScale = spring({
    frame: frame - 5,
    fps,
    config: { mass: 1.2, stiffness: 180, damping: 14 },
  });
  const logoBlur = useBlurReveal(5, 10, 18);

  const taglineProgress = spring({
    frame: frame - 35,
    fps,
    config: { mass: 0.7, stiffness: 300, damping: 16 },
  });
  const taglineY = interpolate(taglineProgress, [0, 1], [16, 0]);
  const taglineOpacity = interpolate(taglineProgress, [0, 1], [0, 1]);

  const underlineWidth = Math.round(250 * s);

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
        gradientIntensity={0.3}
        grainOpacity={0.04}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: logoFontSize,
            letterSpacing: -3,
            color: palette.text,
            opacity: logoBlur.opacity,
            transform: `scale(${logoScale})`,
            filter: `blur(${logoBlur.blur}px)`,
          }}
        >
          {copy.logo || "SuperBad"}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 4,
          }}
        >
          <AccentLine
            startFrame={22}
            width={(underlineWidth - 24) / 2}
            height={2}
            color={palette.accent}
            direction="right-to-left"
          />
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: palette.primary,
              opacity: interpolate(
                spring({
                  frame: frame - 25,
                  fps,
                  config: { mass: 0.4, stiffness: 400, damping: 14 },
                }),
                [0, 1],
                [0, 0.6],
              ),
            }}
          />
          <AccentLine
            startFrame={22}
            width={(underlineWidth - 24) / 2}
            height={2}
            color={palette.accent}
            direction="left-to-right"
          />
        </div>

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: Math.round(18 * s),
            letterSpacing: 6,
            textTransform: "uppercase" as const,
            color: palette.accent,
            marginTop: Math.round(24 * s),
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          {copy.tagline || ""}
        </div>
      </div>
    </AbsoluteFill>
  );
};

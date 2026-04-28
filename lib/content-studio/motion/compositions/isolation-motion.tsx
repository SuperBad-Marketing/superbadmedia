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
  FONT_NARRATIVE,
} from "./motion-fonts";
import { GrainOverlay } from "./atmosphere";
import { AccentDot } from "./accent-shapes";
import { useFadeIn } from "./shared";

export const IsolationMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const headlineProgress = spring({
    frame: frame - 8,
    fps,
    config: { mass: 1.2, stiffness: 180, damping: 22 },
  });
  const headlineOpacity = interpolate(headlineProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineFade = useFadeIn(40, 18);
  const footerFade = useFadeIn(55, 12);

  const padX = Math.round(48 * s);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <GrainOverlay opacity={0.03} />

      <AccentDot
        startFrame={20}
        x={width * 0.82}
        y={height * 0.18}
        radius={Math.round(4 * s)}
        color={palette.primary}
        opacity={0.2}
      />

      <div
        style={{
          position: "absolute",
          bottom: Math.round(height * 0.1),
          left: padX,
          zIndex: 1,
          maxWidth: "55%",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: Math.round(56 * s),
            lineHeight: 0.95,
            letterSpacing: -1,
            color: palette.text,
            opacity: headlineOpacity,
          }}
        >
          {copy.headline || ""}
        </div>

        {copy.tagline && (
          <div
            style={{
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: Math.round(16 * s),
              color: palette.accent,
              marginTop: Math.round(16 * s),
              opacity: taglineFade,
            }}
          >
            {copy.tagline}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: Math.round(40 * s),
          right: padX,
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(11 * s),
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}30`,
          opacity: footerFade,
          zIndex: 1,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

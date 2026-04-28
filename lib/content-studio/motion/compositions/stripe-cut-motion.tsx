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
  FONT_BODY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { GrainOverlay } from "./atmosphere";
import { useFadeIn } from "./shared";

export const StripeCutMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const stripeHeight = Math.round(height * 0.22);
  const stripeTop = Math.round(height * 0.32);
  const padX = Math.round(48 * s);

  const stripeProgress = spring({
    frame: frame - 3,
    fps,
    config: { mass: 1, stiffness: 240, damping: 18 },
  });
  const stripeClip = interpolate(stripeProgress, [0, 1], [0, 100]);

  const headlineProgress = spring({
    frame: frame - 15,
    fps,
    config: { mass: 0.7, stiffness: 320, damping: 14 },
  });
  const headlineX = interpolate(headlineProgress, [0, 1], [-60, 0]);
  const headlineOpacity = interpolate(headlineProgress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  const detailFade = useFadeIn(35, 15);
  const taglineFade = useFadeIn(48, 12);
  const footerFade = useFadeIn(58, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <GrainOverlay opacity={0.03} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: stripeTop,
          height: stripeHeight,
          backgroundColor: palette.primary,
          clipPath: `inset(0 ${100 - stripeClip}% 0 0)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: padX,
          right: padX,
          top: stripeTop,
          height: stripeHeight,
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: Math.round(58 * s),
            lineHeight: 1,
            letterSpacing: -2,
            color: palette.background,
            opacity: headlineOpacity,
            transform: `translateX(${headlineX}px)`,
            whiteSpace: "nowrap",
          }}
        >
          {copy.headline || ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: padX,
          top: stripeTop + stripeHeight + Math.round(28 * s),
          maxWidth: "70%",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: Math.round(20 * s),
            lineHeight: 1.5,
            color: palette.text,
            opacity: detailFade,
          }}
        >
          {copy.detail || ""}
        </div>

        {copy.tagline && (
          <div
            style={{
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: Math.round(16 * s),
              color: palette.accent,
              marginTop: Math.round(14 * s),
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
          bottom: Math.round(32 * s),
          left: 0,
          right: 0,
          textAlign: "center",
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

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

export const SplitFieldMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const splitRatio = 0.38;
  const splitY = height * splitRatio;
  const padX = Math.round(48 * s);

  const dividerProgress = spring({
    frame: frame - 3,
    fps,
    config: { mass: 1.2, stiffness: 200, damping: 20 },
  });
  const dividerClip = interpolate(dividerProgress, [0, 1], [0, 100]);

  const headlineProgress = spring({
    frame: frame - 12,
    fps,
    config: { mass: 0.8, stiffness: 300, damping: 14 },
  });
  const headlineY = interpolate(headlineProgress, [0, 1], [40, 0]);
  const headlineOpacity = interpolate(headlineProgress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  const detailFade = useFadeIn(35, 15);
  const taglineFade = useFadeIn(50, 12);
  const footerFade = useFadeIn(60, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: splitY,
          backgroundColor: palette.primary,
          clipPath: `inset(0 ${100 - dividerClip}% 0 0)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: splitY - 1,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: palette.accent,
          clipPath: `inset(0 ${100 - dividerClip}% 0 0)`,
        }}
      />

      <GrainOverlay opacity={0.03} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: splitY,
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: `0 ${padX}px ${Math.round(28 * s)}px`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: Math.round(72 * s),
            lineHeight: 0.92,
            letterSpacing: -2,
            color: palette.background,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          {copy.headline || ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: splitY,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          padding: `${Math.round(36 * s)}px ${padX}px`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: Math.round(22 * s),
            lineHeight: 1.5,
            color: palette.text,
            maxWidth: "75%",
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
              fontSize: Math.round(18 * s),
              color: palette.accent,
              marginTop: Math.round(20 * s),
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
          right: padX,
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(11 * s),
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

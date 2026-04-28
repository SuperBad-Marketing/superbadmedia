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

export const OversizedCropMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const bigText = copy.stat || copy.headline || "01";
  const giantSize = height * 1.4;

  const driftProgress = spring({
    frame: frame - 3,
    fps,
    config: { mass: 2, stiffness: 80, damping: 30 },
  });
  const giantOpacity = interpolate(driftProgress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const giantY = interpolate(driftProgress, [0, 1], [height * 0.15, 0]);

  const slowDrift = interpolate(
    frame,
    [0, 120],
    [0, -height * 0.03],
    { extrapolateRight: "extend" },
  );

  const detailFade = useFadeIn(30, 15);
  const taglineFade = useFadeIn(45, 12);
  const footerFade = useFadeIn(55, 12);

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
          left: -width * 0.15,
          top: (height - giantSize) / 2,
          zIndex: 0,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: giantSize,
          lineHeight: 0.85,
          letterSpacing: -giantSize * 0.04,
          color: palette.primary,
          opacity: giantOpacity * 0.12,
          transform: `translateY(${giantY + slowDrift}px)`,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {bigText}
      </div>

      <div
        style={{
          position: "absolute",
          right: -width * 0.08,
          bottom: -height * 0.2,
          zIndex: 0,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: giantSize * 0.6,
          lineHeight: 0.85,
          color: palette.accent,
          opacity: giantOpacity * 0.06,
          transform: `translateY(${slowDrift * 0.5}px)`,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {bigText}
      </div>

      <GrainOverlay opacity={0.04} />

      <div
        style={{
          position: "absolute",
          zIndex: 1,
          bottom: Math.round(height * 0.12),
          left: Math.round(48 * s),
          right: Math.round(48 * s),
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: Math.round(52 * s),
            lineHeight: 0.95,
            letterSpacing: -1,
            color: palette.text,
            opacity: detailFade,
            marginBottom: Math.round(16 * s),
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
          left: Math.round(48 * s),
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(12 * s),
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}40`,
          opacity: footerFade,
          zIndex: 1,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

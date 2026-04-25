import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { MotionTemplateProps } from "../types";
import { useFadeIn, useCountUp, useGradientPulse } from "./shared";

export const StatCounterMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const statFontSize = isLandscape ? 120 : isSquare ? 160 : 200;
  const labelFontSize = isLandscape ? 20 : isSquare ? 24 : 28;
  const gradientPulse = useGradientPulse();

  const rawStat = copy.stat || "0";
  const numericValue = parseInt(rawStat.replace(/[^0-9]/g, ""), 10) || 0;
  const prefix = rawStat.match(/^[^0-9]*/)?.[0] || "";
  const suffix = rawStat.match(/[^0-9]*$/)?.[0] || "";

  const countedValue = useCountUp(10, 55, numericValue);

  const statScale = spring({
    frame: frame - 5,
    fps,
    config: { mass: 1.2, stiffness: 160, damping: 20 },
  });
  const statOpacity = interpolate(statScale, [0, 1], [0, 1]);

  const labelFade = useFadeIn(30, 20);
  const subLabelFade = useFadeIn(50, 15);
  const footerFade = useFadeIn(65, 15);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        fontFamily: "'Inter', sans-serif",
        color: palette.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {!transparent && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(ellipse 70% 50% at 50% 30%, ${palette.primary}${Math.round(gradientPulse * 255).toString(16).padStart(2, "0")}, transparent 60%)`,
          }}
        />
      )}

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "100%" }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: statFontSize,
            lineHeight: 1,
            letterSpacing: -4,
            color: palette.primary,
            opacity: statOpacity,
            transform: `scale(${statScale})`,
          }}
        >
          {prefix}{countedValue.toLocaleString()}{suffix}
        </div>

        <div
          style={{
            fontWeight: 600,
            fontSize: labelFontSize,
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.text,
            marginTop: isLandscape ? 8 : 16,
            opacity: labelFade,
          }}
        >
          {copy.label || ""}
        </div>

        <div
          style={{
            fontStyle: "italic",
            fontSize: isLandscape ? 14 : 18,
            color: palette.accent,
            marginTop: isLandscape ? 8 : 12,
            opacity: subLabelFade,
          }}
        >
          {copy.sublabel || ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: isLandscape ? 20 : 40,
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

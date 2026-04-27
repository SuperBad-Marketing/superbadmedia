import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import { MotionFonts, FONT_DISPLAY, FONT_LABEL } from "./motion-fonts";

export const KineticScatterMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const words = (copy.headline ?? "").split(/\s+/).filter(Boolean);
  const progress = spring({ frame, fps, config: { damping: 80, mass: 0.6 } });

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <MotionFonts />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "10%",
        }}
      >
        {words.map((word, i) => {
          const d = spring({
            frame: frame - i * 3,
            fps,
            config: { damping: 60, mass: 0.5 },
          });
          const angle = ((i * 137.5) % 360) * (Math.PI / 180);
          const radius = 120;
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: Math.min(width, height) * 0.08,
                fontWeight: 900,
                color: palette.foreground,
                transform: `translate(${interpolate(d, [0, 1], [Math.cos(angle) * radius, 0])}px, ${interpolate(d, [0, 1], [Math.sin(angle) * radius, 0])}px)`,
                opacity: interpolate(d, [0, 0.3, 1], [0, 1, 1]),
              }}
            >
              {word}
            </div>
          );
        })}
      </div>
      {copy.tagline && (
        <div
          style={{
            position: "absolute",
            bottom: "12%",
            width: "100%",
            textAlign: "center",
            fontFamily: FONT_LABEL,
            fontSize: Math.min(width, height) * 0.03,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: palette.accent ?? palette.foreground,
            opacity: interpolate(progress, [0.6, 1], [0, 1], { extrapolateLeft: "clamp" }),
          }}
        >
          {copy.tagline}
        </div>
      )}
    </AbsoluteFill>
  );
};

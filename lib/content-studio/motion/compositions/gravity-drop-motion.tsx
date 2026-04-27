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

export const GravityDropMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const words = (copy.headline ?? "").split(/\s+/).filter(Boolean);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <MotionFonts />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {words.map((word, i) => {
          const d = spring({
            frame: frame - i * 4,
            fps,
            config: { damping: 40, mass: 1.2, stiffness: 120 },
          });
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: Math.min(width, height) * 0.1,
                fontWeight: 900,
                color: palette.foreground,
                transform: `translateY(${interpolate(d, [0, 1], [-height * 0.5, 0])}px)`,
                opacity: interpolate(d, [0, 0.2, 1], [0, 1, 1]),
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
            bottom: "10%",
            width: "100%",
            textAlign: "center",
            fontFamily: FONT_LABEL,
            fontSize: Math.min(width, height) * 0.03,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: palette.accent ?? palette.foreground,
            opacity: interpolate(
              spring({ frame: frame - words.length * 4 - 5, fps, config: { damping: 80 } }),
              [0, 1],
              [0, 1],
            ),
          }}
        >
          {copy.tagline}
        </div>
      )}
    </AbsoluteFill>
  );
};

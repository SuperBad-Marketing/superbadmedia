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
import { Atmosphere } from "./atmosphere";
import { useFadeIn } from "./shared";

export const WordSlamMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const wordSize = Math.round(96 * s);
  const padX = Math.round(48 * s);
  const padY = Math.round(60 * s);

  const text = copy.headline || "";
  const words = text.split(/\s+/).filter(Boolean);
  const STAGGER = 10;

  const brandFade = useFadeIn(0, 10);
  const taglineStart = 8 + words.length * STAGGER + 15;
  const taglineFade = useFadeIn(taglineStart, 12);
  const footerFade = useFadeIn(taglineStart + 10, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        color: palette.text,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <Atmosphere
        palette={palette}
        transparent={transparent}
        gradientPosition="center"
        gradientIntensity={0.22}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: `${padY}px ${padX}px`,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: Math.round(16 * s),
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.primary,
            marginBottom: Math.round(28 * s),
            opacity: brandFade,
          }}
        >
          SuperBad
        </div>

        <div style={{ clipPath: "inset(-100px -100px 0 -100px)" }}>
          {words.map((word, i) => {
            const startFrame = 8 + i * STAGGER;

            const enterSpring = spring({
              frame: frame - startFrame,
              fps,
              config: { mass: 0.5, stiffness: 500, damping: 12 },
            });

            const y = interpolate(enterSpring, [0, 1], [wordSize * 1.2, 0]);
            const opacity = interpolate(enterSpring, [0, 0.3], [0, 1], {
              extrapolateRight: "clamp",
            });

            const pushOffset = words.slice(i + 1).reduce((acc, _, j) => {
              const laterStart = 8 + (i + 1 + j) * STAGGER;
              const laterSpring = spring({
                frame: frame - laterStart,
                fps,
                config: { mass: 0.5, stiffness: 500, damping: 12 },
              });
              return acc - interpolate(laterSpring, [0, 0.5], [0, 4], {
                extrapolateRight: "clamp",
              });
            }, 0);

            return (
              <div
                key={i}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 900,
                  fontSize: wordSize,
                  lineHeight: 0.95,
                  letterSpacing: -2,
                  color: i === 0 ? palette.primary : palette.text,
                  opacity,
                  transform: `translateY(${y + pushOffset}px)`,
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
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: Math.round(20 * s),
              color: palette.accent,
              marginTop: Math.round(24 * s),
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
          bottom: Math.round(40 * s),
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(12 * s),
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

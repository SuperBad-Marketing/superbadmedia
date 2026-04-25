import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionTemplateProps } from "../types";
import { useFadeIn, useGradientPulse } from "./shared";

export const TextRevealMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const wordFontSize = isLandscape ? 48 : isSquare ? 64 : 80;
  const gradientPulse = useGradientPulse();

  const text = copy.headline || "";
  const words = text.split(/\s+/).filter(Boolean);
  const emphasisWords = (copy.emphasis || "").split(",").map((w) => w.trim().toLowerCase());

  const framesPerWord = Math.max(6, Math.floor(60 / Math.max(words.length, 1)));
  const footerFade = useFadeIn(words.length * framesPerWord + 15, 15);

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

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: isLandscape ? "40px 80px" : "60px 48px",
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: isLandscape ? 12 : 16,
        }}
      >
        {words.map((word, i) => {
          const startFrame = 5 + i * framesPerWord;
          const wordSpring = spring({
            frame: frame - startFrame,
            fps,
            config: { mass: 0.8, stiffness: 280, damping: 22 },
          });
          const opacity = interpolate(wordSpring, [0, 1], [0, 1]);
          const y = interpolate(wordSpring, [0, 1], [30, 0]);
          const isEmphasis = emphasisWords.includes(word.toLowerCase());

          return (
            <span
              key={i}
              style={{
                fontWeight: isEmphasis ? 900 : 700,
                fontSize: wordFontSize,
                lineHeight: 1.2,
                color: isEmphasis ? palette.primary : palette.text,
                opacity,
                transform: `translateY(${y}px)`,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {copy.tagline && (
        <div
          style={{
            position: "absolute",
            bottom: isLandscape ? 60 : 100,
            fontStyle: "italic",
            fontSize: isLandscape ? 16 : 20,
            color: palette.accent,
            opacity: useFadeIn(words.length * framesPerWord + 5, 15),
          }}
        >
          {copy.tagline}
        </div>
      )}

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

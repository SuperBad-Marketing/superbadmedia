import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { useFadeIn } from "./shared";

export const ZoomThroughMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const wordSize = isLandscape ? 64 : isSquare ? 80 : 96;

  const text = copy.headline || "";
  const words = text.split(/\s+/).filter(Boolean);
  const STAGGER = 8;
  const HOLD = 5;

  const brandFade = useFadeIn(0, 10);
  const taglineStart = 8 + words.length * STAGGER + 20;
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
        gradientIntensity={0.25}
        secondaryGradient
      />

      {/* Brand label */}
      <div
        style={{
          position: "absolute",
          top: isLandscape ? 30 : 50,
          left: isLandscape ? 60 : 48,
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: isLandscape ? 14 : 16,
          letterSpacing: 4,
          textTransform: "uppercase" as const,
          color: palette.primary,
          opacity: brandFade,
          zIndex: 10,
        }}
      >
        SuperBad
      </div>

      {/* Zoom-through words */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 800,
        }}
      >
        {words.map((word, i) => {
          const startFrame = 8 + i * STAGGER;
          const endFrame = startFrame + STAGGER + HOLD;

          const enterSpring = spring({
            frame: frame - startFrame,
            fps,
            config: { mass: 0.4, stiffness: 500, damping: 14 },
          });

          const exitProgress = interpolate(
            frame,
            [endFrame - 4, endFrame + 2],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          const isLast = i === words.length - 1;
          const finalExit = isLast ? 0 : exitProgress;

          const scale = interpolate(enterSpring, [0, 1], [0.3, 1]);
          const zoomOut = interpolate(finalExit, [0, 1], [1, 2.5]);
          const combinedScale = scale * zoomOut;

          const z = interpolate(enterSpring, [0, 1], [-300, 0]);
          const zOut = interpolate(finalExit, [0, 1], [0, 200]);

          const enterOpacity = interpolate(enterSpring, [0, 0.4], [0, 1], {
            extrapolateRight: "clamp",
          });
          const exitOpacity = interpolate(finalExit, [0, 0.6, 1], [1, 0.6, 0]);
          const opacity = enterOpacity * exitOpacity;

          const blur = interpolate(enterSpring, [0, 0.3], [8, 0], {
            extrapolateRight: "clamp",
          });
          const exitBlur = interpolate(finalExit, [0.3, 1], [0, 4], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const isEmphasis = i === 0;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                fontFamily: FONT_DISPLAY,
                fontWeight: 900,
                fontSize: wordSize,
                letterSpacing: -2,
                color: isEmphasis ? palette.primary : palette.text,
                opacity,
                transform: `translateZ(${z + zOut}px) scale(${combinedScale})`,
                filter: `blur(${blur + exitBlur}px)`,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {word}
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Tagline */}
      {copy.tagline && (
        <div
          style={{
            position: "absolute",
            bottom: isLandscape ? 60 : 100,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: isLandscape ? 16 : 20,
            color: palette.accent,
            opacity: taglineFade,
            zIndex: 10,
          }}
        >
          {copy.tagline}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: isLandscape ? 20 : 40,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}40`,
          opacity: footerFade,
          zIndex: 10,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

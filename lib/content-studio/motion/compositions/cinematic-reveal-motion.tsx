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
  FONT_BODY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { GrainOverlay } from "./atmosphere";

export const CinematicRevealMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineSize = isLandscape ? 64 : isSquare ? 80 : 96;
  const detailSize = isLandscape ? 18 : isSquare ? 22 : 26;
  const barHeight = isLandscape ? height * 0.1 : height * 0.08;

  // Cinematic bars animate in first
  const barProgress = spring({
    frame: frame - 0,
    fps,
    config: { mass: 1.6, stiffness: 100, damping: 28 },
  });
  const barY = interpolate(barProgress, [0, 1], [barHeight, 0]);

  // Headline: slow, confident drift upward
  const headlineProgress = spring({
    frame: frame - 15,
    fps,
    config: { mass: 2.0, stiffness: 60, damping: 20 },
  });
  const headlineY = interpolate(headlineProgress, [0, 1], [14, 0]);
  const headlineOpacity = interpolate(headlineProgress, [0, 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });
  const headlineScale = interpolate(headlineProgress, [0, 1], [1.015, 1]);

  // Detail: follows headline with breathing room
  const detailProgress = spring({
    frame: frame - 35,
    fps,
    config: { mass: 2.0, stiffness: 60, damping: 20 },
  });
  const detailY = interpolate(detailProgress, [0, 1], [10, 0]);
  const detailOpacity = interpolate(detailProgress, [0, 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Accent line: single thin sweep
  const lineProgress = spring({
    frame: frame - 28,
    fps,
    config: { mass: 1.4, stiffness: 80, damping: 22 },
  });

  // Tagline
  const taglineProgress = spring({
    frame: frame - 52,
    fps,
    config: { mass: 2.0, stiffness: 60, damping: 20 },
  });
  const taglineOpacity = interpolate(taglineProgress, [0, 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Light sweep
  const sweepProgress = interpolate(frame, [20, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sweepX = interpolate(sweepProgress, [0, 1], [-20, 120]);

  // Footer
  const footerProgress = spring({
    frame: frame - 62,
    fps,
    config: { mass: 2.0, stiffness: 60, damping: 20 },
  });
  const footerOpacity = interpolate(footerProgress, [0, 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        color: palette.text,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />

      {/* Subtle radial warmth — barely there */}
      {!transparent && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 70% 50% at 50% 45%, ${palette.primary}0A, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}

      <GrainOverlay opacity={0.025} />

      {/* Top cinematic bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: barHeight,
          background: "#000",
          transform: `translateY(${-barY}px)`,
          zIndex: 20,
        }}
      />

      {/* Bottom cinematic bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: barHeight,
          background: "#000",
          transform: `translateY(${barY}px)`,
          zIndex: 20,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: isLandscape ? "0 80px" : "0 48px",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Headline */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: headlineSize,
            lineHeight: 0.95,
            letterSpacing: -2,
            color: palette.text,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px) scale(${headlineScale})`,
            transformOrigin: "left center",
            marginBottom: isLandscape ? 16 : 20,
          }}
        >
          {copy.headline || ""}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: isLandscape ? 48 : 56,
            height: 1.5,
            background: palette.accent,
            transform: `scaleX(${lineProgress})`,
            transformOrigin: "left",
            opacity: interpolate(lineProgress, [0, 0.1], [0, 0.7], {
              extrapolateRight: "clamp",
            }),
            marginBottom: isLandscape ? 16 : 20,
          }}
        />

        {/* Detail */}
        {copy.detail && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 400,
              fontSize: detailSize,
              lineHeight: 1.5,
              color: `${palette.text}BB`,
              maxWidth: isLandscape ? "50%" : "80%",
              opacity: detailOpacity,
              transform: `translateY(${detailY}px)`,
              marginBottom: isLandscape ? 12 : 16,
            }}
          >
            {copy.detail}
          </div>
        )}

        {/* Tagline */}
        {copy.tagline && (
          <div
            style={{
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: isLandscape ? 15 : 18,
              color: palette.accent,
              opacity: taglineOpacity,
            }}
          >
            {copy.tagline}
          </div>
        )}
      </div>

      {/* Light sweep — a single thin highlight that crosses the frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sweepX}%`,
            width: 1,
            background: `linear-gradient(180deg, transparent 20%, ${palette.text}08 50%, transparent 80%)`,
            boxShadow: `0 0 40px 20px ${palette.text}04`,
          }}
        />
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: barHeight + (isLandscape ? 14 : 20),
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}30`,
          opacity: footerOpacity,
          zIndex: 10,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

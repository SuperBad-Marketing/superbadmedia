import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import { useFadeIn, useGradientPulse } from "./shared";

export const AnnouncementMinimalMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineFontSize = isLandscape ? 56 : isSquare ? 80 : 96;
  const detailFontSize = isLandscape ? 36 : isSquare ? 48 : 56;
  const pad = isLandscape ? "40px 60px" : "60px 48px";

  const brandFade = useFadeIn(5, 15);
  const taglineFade = useFadeIn(40, 20);
  const footerFade = useFadeIn(55, 15);
  const gradientPulse = useGradientPulse();

  const headlineText = copy.headline || "";
  const charsPerFrame = headlineText.length / 35;
  const visibleChars = Math.min(
    headlineText.length,
    Math.max(0, Math.floor((frame - 5) * charsPerFrame)),
  );
  const headlineVisible = headlineText.slice(0, visibleChars);
  const headlineOpacity = interpolate(frame, [5, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          padding: pad,
          width: "100%",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: isLandscape ? 14 : 16,
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.primary,
            marginBottom: isLandscape ? 20 : 32,
            opacity: brandFade,
          }}
        >
          SuperBad
        </div>

        <div
          style={{
            fontWeight: 900,
            fontSize: headlineFontSize,
            lineHeight: 0.95,
            letterSpacing: -2,
            marginBottom: isLandscape ? 16 : 24,
            color: palette.accent,
            opacity: headlineOpacity,
            minHeight: headlineFontSize * 2,
          }}
        >
          {headlineVisible}
          {visibleChars < headlineText.length && (
            <span
              style={{
                opacity: interpolate(
                  frame % 20,
                  [0, 10, 20],
                  [1, 0.3, 1],
                ),
              }}
            >
              |
            </span>
          )}
        </div>

        <div
          style={{
            fontWeight: 900,
            fontSize: detailFontSize,
            color: palette.primary,
            marginBottom: isLandscape ? 8 : 12,
            opacity: useFadeIn(35, 15),
          }}
        >
          {copy.detail || ""}
        </div>

        <div
          style={{
            fontStyle: "italic",
            fontSize: isLandscape ? 16 : 20,
            color: `${palette.text}B0`,
            marginTop: isLandscape ? 12 : 20,
            opacity: taglineFade,
          }}
        >
          {copy.tagline || ""}
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

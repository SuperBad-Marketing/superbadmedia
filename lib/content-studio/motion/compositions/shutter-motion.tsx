import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import { computeLayout } from "../layouts";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_BODY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { GrainOverlay } from "./atmosphere";

export const ShutterMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  animationParams,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

  const slatCount = (animationParams?.slatCount as number) ?? 8;
  const slatHeight = height / slatCount;

  // Content fades in behind the slats
  const contentEntry = spring({
    frame: frame - 5,
    fps,
    config: { mass: 1.2, stiffness: 100, damping: 18 },
  });
  const contentOpacity = interpolate(contentEntry, [0, 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Headline enters with weight
  const headlineEntry = spring({
    frame: frame - 20,
    fps,
    config: { mass: 1.6, stiffness: 80, damping: 20 },
  });
  const headlineY = interpolate(headlineEntry, [0, 1], [16, 0]);
  const headlineOpacity = interpolate(headlineEntry, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Detail
  const detailEntry = spring({
    frame: frame - 40,
    fps,
    config: { mass: 1.4, stiffness: 100, damping: 20 },
  });
  const detailOpacity = interpolate(detailEntry, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Tagline
  const taglineEntry = spring({
    frame: frame - 52,
    fps,
    config: { mass: 1.4, stiffness: 100, damping: 20 },
  });
  const taglineOpacity = interpolate(taglineEntry, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Footer
  const footerEntry = spring({
    frame: frame - 62,
    fps,
    config: { mass: 1.4, stiffness: 100, damping: 20 },
  });
  const footerOpacity = interpolate(footerEntry, [0, 0.5], [0, 1], {
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

      <GrainOverlay opacity={0.02} />

      {/* Content layer — visible behind opening slats */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          opacity: contentOpacity,
          padding: `0 ${lyt.paddingX}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: lyt.justifyContent,
          width: "100%",
          height: "100%",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: lyt.headlineFontSize,
            lineHeight: lyt.headlineLineHeight,
            letterSpacing: lyt.headlineLetterSpacing,
            color: palette.text,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
            marginBottom: lyt.elementGap,
          }}
        >
          {copy.headline || ""}
        </div>

        {copy.detail && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 400,
              fontSize: lyt.detailFontSize,
              lineHeight: 1.5,
              color: `${palette.text}BB`,
              maxWidth: lyt.contentMaxWidth,
              opacity: detailOpacity,
              marginBottom: lyt.elementGap,
            }}
          >
            {copy.detail}
          </div>
        )}

        {copy.tagline && (
          <div
            style={{
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: lyt.taglineFontSize,
              color: palette.accent,
              opacity: taglineOpacity,
            }}
          >
            {copy.tagline}
          </div>
        )}
      </div>

      {/* Shutter slats */}
      {Array.from({ length: slatCount }).map((_, i) => {
        const slatDelay = i * 2;
        const slatProgress = spring({
          frame: frame - slatDelay,
          fps,
          config: { mass: 0.8, stiffness: 200, damping: 16 },
        });
        const scaleY = interpolate(slatProgress, [0, 1], [1, 0]);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: slatHeight * i,
              height: slatHeight + 1,
              background: palette.primary,
              transform: `scaleY(${scaleY})`,
              transformOrigin: i % 2 === 0 ? "top" : "bottom",
              zIndex: 10,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          bottom: lyt.paddingY,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: lyt.footerFontSize,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}30`,
          opacity: footerOpacity,
          zIndex: 15,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

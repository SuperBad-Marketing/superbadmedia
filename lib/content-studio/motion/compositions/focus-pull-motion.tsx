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

export const FocusPullMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineSize = isLandscape ? 68 : isSquare ? 88 : 104;
  const detailSize = isLandscape ? 20 : isSquare ? 24 : 28;
  const pad = isLandscape ? "40px 80px" : "60px 48px";

  // Headline focus pull: starts oversized + blurred, racks to sharp
  const headlineFocus = spring({
    frame: frame - 10,
    fps,
    config: { mass: 2.2, stiffness: 50, damping: 18 },
  });
  const headlineBlur = interpolate(headlineFocus, [0, 1], [16, 0]);
  const headlineScale = interpolate(headlineFocus, [0, 1], [1.06, 1]);
  const headlineOpacity = interpolate(headlineFocus, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Detail focus pull: follows headline
  const detailFocus = spring({
    frame: frame - 34,
    fps,
    config: { mass: 2.2, stiffness: 50, damping: 18 },
  });
  const detailBlur = interpolate(detailFocus, [0, 1], [12, 0]);
  const detailScale = interpolate(detailFocus, [0, 1], [1.04, 1]);
  const detailOpacity = interpolate(detailFocus, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Brand mark — appears crisp while headline is still pulling focus
  const brandProgress = spring({
    frame: frame - 3,
    fps,
    config: { mass: 1.8, stiffness: 70, damping: 22 },
  });
  const brandOpacity = interpolate(brandProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Tagline — gentle arrival after everything settles
  const taglineProgress = spring({
    frame: frame - 52,
    fps,
    config: { mass: 2.0, stiffness: 50, damping: 20 },
  });
  const taglineOpacity = interpolate(taglineProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(taglineProgress, [0, 1], [6, 0]);

  // Footer
  const footerProgress = spring({
    frame: frame - 60,
    fps,
    config: { mass: 2.0, stiffness: 50, damping: 20 },
  });
  const footerOpacity = interpolate(footerProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Ambient depth-of-field bokeh circles (very faint, decorative)
  const bokehOpacity = interpolate(frame, [0, 20, 40], [0, 0.06, 0.03], {
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

      {/* Gentle ambient light */}
      {!transparent && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 60% 50% at 40% 40%, ${palette.primary}0C, transparent 65%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Bokeh circles — the blurred background "lights" */}
      {!transparent && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: bokehOpacity,
          }}
        >
          {[
            { x: "15%", y: "20%", size: 120, color: palette.primary },
            { x: "75%", y: "30%", size: 80, color: palette.accent },
            { x: "60%", y: "70%", size: 100, color: palette.primary },
            { x: "25%", y: "75%", size: 60, color: palette.accent },
            { x: "85%", y: "65%", size: 90, color: palette.text },
          ].map((b, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: b.x,
                top: b.y,
                width: b.size,
                height: b.size,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${b.color}20 0%, transparent 70%)`,
                filter: "blur(20px)",
                transform: `translate(-50%, -50%)`,
              }}
            />
          ))}
        </div>
      )}

      <GrainOverlay opacity={0.03} />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: pad,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Brand mark — sharp while headline is soft */}
        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: isLandscape ? 13 : 15,
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.primary,
            marginBottom: isLandscape ? 24 : 32,
            opacity: brandOpacity,
          }}
        >
          SuperBad
        </div>

        {/* Headline with focus pull */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: headlineSize,
            lineHeight: 0.93,
            letterSpacing: -2.5,
            color: palette.text,
            opacity: headlineOpacity,
            transform: `scale(${headlineScale})`,
            transformOrigin: "left center",
            filter: headlineBlur > 0.3 ? `blur(${headlineBlur}px)` : undefined,
            marginBottom: isLandscape ? 20 : 28,
          }}
        >
          {copy.headline || ""}
        </div>

        {/* Detail with focus pull */}
        {copy.detail && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 400,
              fontSize: detailSize,
              lineHeight: 1.5,
              color: `${palette.text}BB`,
              maxWidth: isLandscape ? "50%" : "75%",
              opacity: detailOpacity,
              transform: `scale(${detailScale})`,
              transformOrigin: "left center",
              filter: detailBlur > 0.3 ? `blur(${detailBlur}px)` : undefined,
              marginBottom: isLandscape ? 12 : 16,
            }}
          >
            {copy.detail}
          </div>
        )}

        {/* Tagline — arrives last, already in focus */}
        {copy.tagline && (
          <div
            style={{
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: isLandscape ? 15 : 18,
              color: palette.accent,
              opacity: taglineOpacity,
              transform: `translateY(${taglineY}px)`,
            }}
          >
            {copy.tagline}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: isLandscape ? 20 : 40,
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
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

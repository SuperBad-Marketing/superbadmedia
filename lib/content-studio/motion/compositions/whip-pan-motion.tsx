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

export const WhipPanMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const wordSize = Math.round(110 * s);

  const text = copy.headline || "";
  const words = text.split(/\s+/).filter(Boolean);
  const HOLD = 12;
  const WHIP = 6;
  const SEGMENT = HOLD + WHIP;

  const brandFade = useFadeIn(0, 10);
  const totalWordFrames = 4 + words.length * SEGMENT;
  const taglineFade = useFadeIn(totalWordFrames + 5, 14);
  const footerFade = useFadeIn(totalWordFrames + 15, 12);

  const allWordsSettled = frame >= totalWordFrames - SEGMENT + HOLD;

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
        gradientIntensity={0.18}
      />

      <div
        style={{
          position: "absolute",
          top: Math.round(50 * s),
          left: Math.round(48 * s),
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(16 * s),
          letterSpacing: 4,
          textTransform: "uppercase" as const,
          color: palette.primary,
          opacity: brandFade,
          zIndex: 10,
        }}
      >
        SuperBad
      </div>

      {/* Word panels */}
      {words.map((word, i) => {
        const segmentStart = 4 + i * SEGMENT;
        const isLast = i === words.length - 1;

        const enterSpring = spring({
          frame: frame - segmentStart,
          fps,
          config: { mass: 0.4, stiffness: 500, damping: 14 },
        });

        const enterX = interpolate(enterSpring, [0, 1], [width, 0]);

        let exitX = 0;
        if (!isLast) {
          const exitStart = segmentStart + HOLD;
          const exitProgress = interpolate(
            frame,
            [exitStart, exitStart + WHIP],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const exitEased = exitProgress * exitProgress;
          exitX = interpolate(exitEased, [0, 1], [0, -width]);
        }

        const x = enterX + exitX;

        const motionBlurAmount = Math.abs(enterX) > 50 || Math.abs(exitX) > 50
          ? interpolate(Math.abs(enterX + exitX), [0, 200, width], [0, 12, 24], { extrapolateRight: "clamp" })
          : 0;

        const visible = frame >= segmentStart - 2 && (isLast || frame < segmentStart + SEGMENT + 4);
        if (!visible) return null;

        const isEmphasis = i === 0;

        return (
          <AbsoluteFill
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateX(${x}px)`,
              filter: motionBlurAmount > 1 ? `blur(${motionBlurAmount}px)` : undefined,
              zIndex: words.length - i,
            }}
          >
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 900,
                fontSize: wordSize,
                letterSpacing: -3,
                lineHeight: 0.9,
                color: isEmphasis ? palette.primary : palette.text,
                textAlign: "center",
                padding: "0 60px",
              }}
            >
              {word}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* Final state: all words stacked small */}
      {allWordsSettled && (() => {
        const settleSpring = spring({
          frame: frame - (totalWordFrames - SEGMENT + HOLD),
          fps,
          config: { mass: 0.6, stiffness: 300, damping: 16 },
        });

        const settleOpacity = interpolate(settleSpring, [0, 1], [0, 1]);
        const settleScale = interpolate(settleSpring, [0, 1], [1.2, 1]);
        const smallSize = Math.round(52 * s);

        return (
          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: settleOpacity,
              transform: `scale(${settleScale})`,
              zIndex: words.length + 1,
            }}
          >
            {words.map((word, i) => (
              <div
                key={i}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 900,
                  fontSize: smallSize,
                  lineHeight: 1.0,
                  letterSpacing: -1,
                  color: i === 0 ? palette.primary : palette.text,
                }}
              >
                {word}
              </div>
            ))}
          </AbsoluteFill>
        );
      })()}

      {copy.tagline && (
        <div
          style={{
            position: "absolute",
            bottom: Math.round(100 * s),
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: Math.round(20 * s),
            color: palette.accent,
            opacity: taglineFade,
            zIndex: 20,
          }}
        >
          {copy.tagline}
        </div>
      )}

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
          zIndex: 20,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

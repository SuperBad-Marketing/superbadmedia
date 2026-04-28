import React from "react";
import {
  AbsoluteFill,
  interpolate,
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

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export const GlitchMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const headlineSize = Math.round(110 * s);
  const padX = Math.round(48 * s);
  const padY = Math.round(60 * s);

  const entryDone = Math.min(1, frame / 12);
  const entryOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  const glitchPhase = frame > 10 && frame < fps * 2.5;
  const glitchAmount = glitchPhase
    ? interpolate(frame, [10, fps * 2.5], [1, 0], {
        extrapolateRight: "clamp",
      })
    : 0;

  const rOffset = glitchPhase
    ? pseudoRandom(frame * 3) * 12 * s * glitchAmount
    : 0;
  const gOffset = glitchPhase
    ? pseudoRandom(frame * 7) * -10 * s * glitchAmount
    : 0;

  const sliceOffset = glitchPhase
    ? pseudoRandom(frame * 13) * 30 * s * glitchAmount
    : 0;
  const sliceY = glitchPhase
    ? pseudoRandom(frame * 19) * height * 0.6 + height * 0.2
    : 0;
  const sliceH = Math.round(8 * s);

  const taglineFade = useFadeIn(fps * 2, 15);
  const footerFade = useFadeIn(fps * 2.2, 12);

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
        gradientIntensity={0.12}
      />

      {/* Red channel ghost */}
      {glitchPhase && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: padX,
            right: padX,
            transform: `translateY(-50%) translateX(${rOffset}px)`,
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: headlineSize,
            lineHeight: 0.95,
            letterSpacing: -3,
            color: `${palette.primary}40`,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        >
          {copy.headline || ""}
        </div>
      )}

      {/* Cyan channel ghost */}
      {glitchPhase && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: padX,
            right: padX,
            transform: `translateY(-50%) translateX(${gOffset}px)`,
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: headlineSize,
            lineHeight: 0.95,
            letterSpacing: -3,
            color: `${palette.accent}30`,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        >
          {copy.headline || ""}
        </div>
      )}

      {/* Main headline */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: padX,
          right: padX,
          transform: `translateY(-50%) scale(${interpolate(entryDone, [0, 1], [1.02, 1])})`,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: headlineSize,
          lineHeight: 0.95,
          letterSpacing: -3,
          color: palette.text,
          opacity: entryOpacity,
          zIndex: 2,
        }}
      >
        {copy.headline || ""}
      </div>

      {/* Horizontal slice displacement */}
      {glitchPhase && glitchAmount > 0.2 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: sliceY,
            height: sliceH,
            background: palette.background,
            transform: `translateX(${sliceOffset}px)`,
            zIndex: 5,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Scanline overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${Math.round(2 * s)}px, ${palette.text}04 ${Math.round(2 * s)}px, ${palette.text}04 ${Math.round(4 * s)}px)`,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {copy.tagline && (
        <div
          style={{
            position: "absolute",
            bottom: padY + Math.round(28 * s),
            right: padX,
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: Math.round(18 * s),
            color: palette.accent,
            opacity: taglineFade,
            textAlign: "right",
            zIndex: 4,
          }}
        >
          {copy.tagline}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: padY,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(12 * s),
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}30`,
          opacity: footerFade,
          zIndex: 4,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

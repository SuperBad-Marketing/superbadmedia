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
  FONT_BODY,
} from "./motion-fonts";
import { GrainOverlay } from "./atmosphere";
import { AccentLine } from "./accent-shapes";
import { useFadeIn } from "./shared";

export const VerticalTypeMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const headline = copy.headline || "";
  const chars = headline.split("");
  const charSize = Math.round(64 * s);
  const STAGGER = 3;

  const detailFade = useFadeIn(8 + chars.length * STAGGER + 5, 15);
  const footerFade = useFadeIn(8 + chars.length * STAGGER + 20, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <GrainOverlay opacity={0.03} />

      <div
        style={{
          position: "absolute",
          left: Math.round(width * 0.15),
          top: Math.round(48 * s),
          bottom: Math.round(48 * s),
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: Math.round(2 * s),
        }}
      >
        {chars.map((char, i) => {
          const startFrame = 8 + i * STAGGER;

          const enterProgress = spring({
            frame: frame - startFrame,
            fps,
            config: { mass: 0.5, stiffness: 400, damping: 14 },
          });

          const slideX = interpolate(enterProgress, [0, 1], [-40, 0]);
          const opacity = interpolate(enterProgress, [0, 0.3], [0, 1], {
            extrapolateRight: "clamp",
          });

          const isSpace = char === " ";

          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 900,
                fontSize: charSize,
                lineHeight: 0.82,
                color: i === 0 ? palette.primary : palette.text,
                opacity: isSpace ? 0 : opacity,
                transform: `translateX(${slideX}px)`,
                height: isSpace ? Math.round(20 * s) : undefined,
              }}
            >
              {isSpace ? "" : char}
            </div>
          );
        })}
      </div>

      <AccentLine
        startFrame={5}
        width={Math.round(height * 0.4)}
        height={2}
        color={palette.primary}
        direction="left-to-right"
        style={{
          position: "absolute",
          left: Math.round(width * 0.15) - Math.round(20 * s),
          top: "50%",
          transform: "rotate(90deg)",
          transformOrigin: "top left",
          opacity: 0.15,
        }}
      />

      <div
        style={{
          position: "absolute",
          right: Math.round(width * 0.12),
          bottom: Math.round(height * 0.2),
          maxWidth: "35%",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: Math.round(18 * s),
            lineHeight: 1.5,
            color: palette.text,
            opacity: detailFade,
            textAlign: "right",
          }}
        >
          {copy.detail || ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: Math.round(32 * s),
          right: Math.round(48 * s),
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(11 * s),
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}30`,
          opacity: footerFade,
          zIndex: 1,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};

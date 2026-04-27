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
import { AccentRing } from "./accent-shapes";
import { useFadeIn } from "./shared";

const ROLL_CYCLES = 2;
const ALL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIGIT_STAGGER = 2;
const ROLL_START = 10;
const BASE_MASS = 0.8;
const MASS_STEP = 0.15;

const RollingDigit: React.FC<{
  target: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  startFrame: number;
  mass: number;
}> = ({ target, fontSize, color, fontFamily, startFrame, mass }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const strip: number[] = [];
  for (let c = 0; c < ROLL_CYCLES; c++) {
    strip.push(...ALL_DIGITS);
  }
  for (let d = 0; d <= target; d++) {
    strip.push(d);
  }

  const totalPositions = strip.length;
  const digitHeight = fontSize;
  const springConfig = { mass, stiffness: 120, damping: 18 };

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: springConfig,
  });

  const translateY = interpolate(
    progress,
    [0, 1],
    [0, -(totalPositions - 1) * digitHeight],
  );

  const prevProgress = spring({
    frame: frame - startFrame - 1,
    fps,
    config: springConfig,
  });
  const velocity = Math.abs(progress - prevProgress);
  const blurAmount = interpolate(velocity, [0, 0.02, 0.06], [0, 0, 3], {
    extrapolateRight: "clamp",
  });

  const fadeIn = interpolate(
    frame,
    [startFrame, startFrame + 5],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        height: digitHeight,
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "flex-start",
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          filter: blurAmount > 0.3 ? `blur(${blurAmount}px)` : undefined,
          willChange: "transform",
        }}
      >
        {strip.map((d, i) => (
          <div
            key={i}
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize,
              lineHeight: 1,
              height: digitHeight,
              color,
              textAlign: "center",
            }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
};

export const StatCounterMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const statFontSize = isLandscape ? 120 : isSquare ? 160 : 200;
  const labelFontSize = isLandscape ? 20 : isSquare ? 24 : 28;
  const affixSize = statFontSize * 0.55;

  const rawStat = copy.stat || "0";
  const numericStr = rawStat.replace(/[^0-9]/g, "");
  const prefix = rawStat.match(/^[^0-9]*/)?.[0] || "";
  const suffix = rawStat.match(/[^0-9]*$/)?.[0] || "";
  const digits = numericStr.split("").map(Number);
  const totalDigits = digits.length;

  type El =
    | { kind: "digit"; value: number; fromRight: number }
    | { kind: "comma" };
  const elements: El[] = [];
  digits.forEach((d, i) => {
    const fromRight = totalDigits - 1 - i;
    elements.push({ kind: "digit", value: d, fromRight });
    if (fromRight > 0 && fromRight % 3 === 0) {
      elements.push({ kind: "comma" });
    }
  });

  const affixFade = interpolate(
    frame,
    [ROLL_START, ROLL_START + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const labelFade = useFadeIn(50, 15);
  const subLabelFade = useFadeIn(62, 12);
  const footerFade = useFadeIn(74, 12);

  const ringRadius = statFontSize * 0.6;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        color: palette.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <Atmosphere
        palette={palette}
        transparent={transparent}
        gradientPosition="center"
        gradientIntensity={0.28}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            {prefix && (
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 900,
                  fontSize: affixSize,
                  lineHeight: 1,
                  color: palette.primary,
                  opacity: affixFade,
                  marginTop: (statFontSize - affixSize) * 0.15,
                  marginRight: 4,
                }}
              >
                {prefix}
              </span>
            )}

            {elements.map((el, i) =>
              el.kind === "comma" ? (
                <span
                  key={`c-${i}`}
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 900,
                    fontSize: statFontSize * 0.75,
                    lineHeight: 1,
                    color: palette.primary,
                    opacity: affixFade,
                    marginTop: statFontSize * 0.1,
                    marginLeft: 2,
                    marginRight: 2,
                  }}
                >
                  ,
                </span>
              ) : (
                <RollingDigit
                  key={`d-${i}`}
                  target={el.value}
                  fontSize={statFontSize}
                  color={palette.primary}
                  fontFamily={FONT_DISPLAY}
                  startFrame={ROLL_START + el.fromRight * DIGIT_STAGGER}
                  mass={BASE_MASS + el.fromRight * MASS_STEP}
                />
              ),
            )}

            {suffix && (
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 900,
                  fontSize: affixSize,
                  lineHeight: 1,
                  color: palette.primary,
                  opacity: affixFade,
                  alignSelf: "flex-end",
                  marginBottom: statFontSize * 0.05,
                  marginLeft: 4,
                }}
              >
                {suffix}
              </span>
            )}
          </div>

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            <AccentRing
              startFrame={55}
              radius={ringRadius}
              color={palette.accent}
              strokeWidth={isLandscape ? 1.5 : 2}
            />
          </div>
        </div>

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: labelFontSize,
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.text,
            marginTop: isLandscape ? 8 : 16,
            opacity: labelFade,
          }}
        >
          {copy.label || ""}
        </div>

        <div
          style={{
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: isLandscape ? 14 : 18,
            color: palette.accent,
            marginTop: isLandscape ? 8 : 12,
            opacity: subLabelFade,
          }}
        >
          {copy.sublabel || ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: isLandscape ? 20 : 40,
          fontFamily: FONT_LABEL,
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

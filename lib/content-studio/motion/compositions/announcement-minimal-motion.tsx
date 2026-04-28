import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import { computeLayout } from "../layouts";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { Atmosphere } from "./atmosphere";
import { AccentLine } from "./accent-shapes";
import { useFadeIn } from "./shared";

export const AnnouncementMinimalMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
  layout,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const lyt = computeLayout(layout, width, height);

  const brandFade = useFadeIn(5, 12);
  const taglineFade = useFadeIn(42, 15);
  const footerFade = useFadeIn(55, 12);

  const headlineText = copy.headline || "";
  const charsPerFrame = headlineText.length / 30;
  const visibleChars = Math.min(
    headlineText.length,
    Math.max(0, Math.floor((frame - 5) * charsPerFrame)),
  );
  const headlineVisible = headlineText.slice(0, visibleChars);
  const headlineOpacity = interpolate(frame, [5, 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        fontFamily: FONT_LABEL,
        color: palette.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: lyt.justifyContent,
        alignItems: lyt.alignItems,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />
      <Atmosphere
        palette={palette}
        transparent={transparent}
        gradientPosition="center"
        gradientIntensity={0.2}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: lyt.textAlign,
          padding: `${lyt.paddingY}px ${lyt.paddingX}px`,
          width: "100%",
        }}
      >
        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 600,
            fontSize: lyt.brandFontSize,
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.primary,
            marginBottom: lyt.elementGap,
            opacity: brandFade,
          }}
        >
          SuperBad
        </div>

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: lyt.headlineFontSize,
            lineHeight: lyt.headlineLineHeight,
            letterSpacing: lyt.headlineLetterSpacing,
            marginBottom: lyt.elementGap,
            color: palette.accent,
            opacity: headlineOpacity,
            minHeight: lyt.headlineFontSize * 2,
          }}
        >
          {headlineVisible}
          {visibleChars < headlineText.length && (
            <span
              style={{
                opacity: interpolate(
                  frame % 20,
                  [0, 10, 20],
                  [1, 0.2, 1],
                ),
              }}
            >
              |
            </span>
          )}
        </div>

        <AccentLine
          startFrame={34}
          width={48}
          height={3}
          color={`linear-gradient(90deg, ${palette.accent}, ${palette.primary})`}
          direction="center-out"
          style={{ margin: `0 auto ${lyt.elementGap}px` }}
        />

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: lyt.detailFontSize,
            color: palette.primary,
            marginBottom: lyt.elementGap,
            opacity: useFadeIn(36, 12),
          }}
        >
          {copy.detail || ""}
        </div>

        <div
          style={{
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: lyt.taglineFontSize,
            color: `${palette.text}B0`,
            marginTop: lyt.elementGap,
            opacity: taglineFade,
          }}
        >
          {copy.tagline || ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: lyt.paddingY,
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: lyt.footerFontSize,
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

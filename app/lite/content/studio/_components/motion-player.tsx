"use client";

import React, { forwardRef, useMemo } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { AnnouncementBoldMotion } from "@/lib/content-studio/motion/compositions/announcement-bold-motion";
import { AnnouncementMinimalMotion } from "@/lib/content-studio/motion/compositions/announcement-minimal-motion";
import { AntiMotivationTypographyMotion } from "@/lib/content-studio/motion/compositions/anti-motivation-typography-motion";
import { TipsValueMotion } from "@/lib/content-studio/motion/compositions/tips-value-motion";
import { TestimonialQuoteMotion } from "@/lib/content-studio/motion/compositions/testimonial-quote-motion";
import { BtsCaptionMotion } from "@/lib/content-studio/motion/compositions/bts-caption-motion";
import { PortfolioShowcaseMotion } from "@/lib/content-studio/motion/compositions/portfolio-showcase-motion";
import { StatCounterMotion } from "@/lib/content-studio/motion/compositions/stat-counter-motion";
import { TextRevealMotion } from "@/lib/content-studio/motion/compositions/text-reveal-motion";
import { LogoStingMotion } from "@/lib/content-studio/motion/compositions/logo-sting-motion";
import type { ColourPalette, MotionTemplateProps } from "@/lib/content-studio/motion/types";
import { MOTION_DIMENSIONS, type MotionAspectRatio } from "@/lib/content-studio/motion/types";

const COMPOSITION_MAP: Record<string, React.FC<MotionTemplateProps>> = {
  "announcement-bold-motion": AnnouncementBoldMotion,
  "announcement-minimal-motion": AnnouncementMinimalMotion,
  "anti-motivation-typography-motion": AntiMotivationTypographyMotion,
  "tips-value-motion": TipsValueMotion,
  "testimonial-quote-motion": TestimonialQuoteMotion,
  "bts-caption-motion": BtsCaptionMotion,
  "portfolio-showcase-motion": PortfolioShowcaseMotion,
  "stat-counter": StatCounterMotion,
  "text-reveal": TextRevealMotion,
  "logo-sting": LogoStingMotion,
};

interface MotionPlayerProps {
  templateId: string;
  copy: Record<string, string>;
  palette: ColourPalette;
  aspectRatio: MotionAspectRatio;
  transparent: boolean;
  animationParams: Record<string, number | string | boolean>;
  durationInFrames: number;
  fps?: number;
  loop?: boolean;
  style?: React.CSSProperties;
}

export const MotionPlayer = forwardRef<PlayerRef, MotionPlayerProps>(
  function MotionPlayer(
    {
      templateId,
      copy,
      palette,
      aspectRatio,
      transparent,
      animationParams,
      durationInFrames,
      fps = 30,
      loop = true,
      style,
    },
    ref,
  ) {
    const Component = COMPOSITION_MAP[templateId];
    const { width, height } = MOTION_DIMENSIONS[aspectRatio];

    const inputProps: MotionTemplateProps = useMemo(
      () => ({ copy, palette, transparent, animationParams }),
      [copy, palette, transparent, animationParams],
    );

    if (!Component) {
      return (
        <div
          style={{
            ...style,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1A1A18",
            color: "#8A8A80",
            fontFamily: "var(--font-label)",
            fontSize: 14,
          }}
        >
          Unknown template: {templateId}
        </div>
      );
    }

    return (
      <Player
        ref={ref}
        component={Component as unknown as React.ComponentType<Record<string, unknown>>}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        compositionWidth={width}
        compositionHeight={height}
        fps={fps}
        loop={loop}
        autoPlay
        style={{
          width: "100%",
          ...style,
        }}
        acknowledgeRemotionLicense
      />
    );
  },
);

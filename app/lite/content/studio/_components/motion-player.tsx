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
import { WordSlamMotion } from "@/lib/content-studio/motion/compositions/word-slam-motion";
import { CinematicRevealMotion } from "@/lib/content-studio/motion/compositions/cinematic-reveal-motion";
import { FocusPullMotion } from "@/lib/content-studio/motion/compositions/focus-pull-motion";
import { WhipPanMotion } from "@/lib/content-studio/motion/compositions/whip-pan-motion";
import { ZoomThroughMotion } from "@/lib/content-studio/motion/compositions/zoom-through-motion";
import { EdgeBleedMotion } from "@/lib/content-studio/motion/compositions/edge-bleed-motion";
import { SplitFieldMotion } from "@/lib/content-studio/motion/compositions/split-field-motion";
import { OversizedCropMotion } from "@/lib/content-studio/motion/compositions/oversized-crop-motion";
import { IsolationMotion } from "@/lib/content-studio/motion/compositions/isolation-motion";
import { VerticalTypeMotion } from "@/lib/content-studio/motion/compositions/vertical-type-motion";
import { StripeCutMotion } from "@/lib/content-studio/motion/compositions/stripe-cut-motion";
import { withSfx } from "@/lib/content-studio/motion/compositions/motion-sfx";
import type { ColourPalette, MotionTemplateProps, SfxCueData } from "@/lib/content-studio/motion/types";
import { MOTION_DIMENSIONS, type MotionAspectRatio } from "@/lib/content-studio/motion/types";
import type { MotionLayoutConfig } from "@/lib/content-studio/motion/layouts";

export const COMPOSITION_MAP: Record<string, React.FC<MotionTemplateProps>> = {
  "announcement-bold-motion": withSfx(AnnouncementBoldMotion),
  "announcement-minimal-motion": withSfx(AnnouncementMinimalMotion),
  "anti-motivation-typography-motion": withSfx(AntiMotivationTypographyMotion),
  "tips-value-motion": withSfx(TipsValueMotion),
  "testimonial-quote-motion": withSfx(TestimonialQuoteMotion),
  "bts-caption-motion": withSfx(BtsCaptionMotion),
  "portfolio-showcase-motion": withSfx(PortfolioShowcaseMotion),
  "stat-counter": withSfx(StatCounterMotion),
  "text-reveal": withSfx(TextRevealMotion),
  "logo-sting": withSfx(LogoStingMotion),
  "word-slam": withSfx(WordSlamMotion),
  "cinematic-reveal": withSfx(CinematicRevealMotion),
  "focus-pull": withSfx(FocusPullMotion),
  "whip-pan": withSfx(WhipPanMotion),
  "zoom-through": withSfx(ZoomThroughMotion),
  "edge-bleed": withSfx(EdgeBleedMotion),
  "split-field": withSfx(SplitFieldMotion),
  "oversized-crop": withSfx(OversizedCropMotion),
  "isolation": withSfx(IsolationMotion),
  "vertical-type": withSfx(VerticalTypeMotion),
  "stripe-cut": withSfx(StripeCutMotion),
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
  sfxCues?: SfxCueData[];
  fontPairingId?: string;
  layout?: MotionLayoutConfig;
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
      sfxCues,
      fontPairingId,
      layout,
    },
    ref,
  ) {
    const Component = COMPOSITION_MAP[templateId];
    const { width, height } = MOTION_DIMENSIONS[aspectRatio];

    const inputProps: MotionTemplateProps = useMemo(
      () => ({ copy, palette, transparent, animationParams, sfxCues, fontPairingId, layout }),
      [copy, palette, transparent, animationParams, sfxCues, fontPairingId, layout],
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

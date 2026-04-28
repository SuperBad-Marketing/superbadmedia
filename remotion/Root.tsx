import React from "react";
import { Composition } from "remotion";
import { AnnouncementBoldMotion } from "../lib/content-studio/motion/compositions/announcement-bold-motion";
import { AnnouncementMinimalMotion } from "../lib/content-studio/motion/compositions/announcement-minimal-motion";
import { AntiMotivationTypographyMotion } from "../lib/content-studio/motion/compositions/anti-motivation-typography-motion";
import { TipsValueMotion } from "../lib/content-studio/motion/compositions/tips-value-motion";
import { TestimonialQuoteMotion } from "../lib/content-studio/motion/compositions/testimonial-quote-motion";
import { BtsCaptionMotion } from "../lib/content-studio/motion/compositions/bts-caption-motion";
import { PortfolioShowcaseMotion } from "../lib/content-studio/motion/compositions/portfolio-showcase-motion";
import { StatCounterMotion } from "../lib/content-studio/motion/compositions/stat-counter-motion";
import { TextRevealMotion } from "../lib/content-studio/motion/compositions/text-reveal-motion";
import { LogoStingMotion } from "../lib/content-studio/motion/compositions/logo-sting-motion";
import { WordSlamMotion } from "../lib/content-studio/motion/compositions/word-slam-motion";
import { CinematicRevealMotion } from "../lib/content-studio/motion/compositions/cinematic-reveal-motion";
import { FocusPullMotion } from "../lib/content-studio/motion/compositions/focus-pull-motion";
import { WhipPanMotion } from "../lib/content-studio/motion/compositions/whip-pan-motion";
import { ZoomThroughMotion } from "../lib/content-studio/motion/compositions/zoom-through-motion";
import { EdgeBleedMotion } from "../lib/content-studio/motion/compositions/edge-bleed-motion";
import { SplitFieldMotion } from "../lib/content-studio/motion/compositions/split-field-motion";
import { OversizedCropMotion } from "../lib/content-studio/motion/compositions/oversized-crop-motion";
import { IsolationMotion } from "../lib/content-studio/motion/compositions/isolation-motion";
import { VerticalTypeMotion } from "../lib/content-studio/motion/compositions/vertical-type-motion";
import { StripeCutMotion } from "../lib/content-studio/motion/compositions/stripe-cut-motion";
import { withSfx } from "../lib/content-studio/motion/compositions/motion-sfx";
import { ALL_MOTION_TEMPLATES } from "../lib/content-studio/motion/registry";
import { BRAND_PALETTES } from "../lib/content-studio/motion/palettes";
import { MOTION_DIMENSIONS } from "../lib/content-studio/motion/types";
import type { MotionAspectRatio } from "../lib/content-studio/motion/types";
import { DEFAULT_LAYOUT } from "../lib/content-studio/motion/layouts";

const COMPOSITION_MAP: Record<string, React.FC<any>> = {
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

const DEFAULT_RATIO: MotionAspectRatio = "square";
const FPS = 30;

const SAMPLE_COPY: Record<string, Record<string, string>> = {
  "stat-counter": { stat: "$1250K", label: "Revenue generated", sublabel: "across all clients this quarter" },
  "word-slam": { headline: "Stop Scrolling Start Building", tagline: "the work speaks louder." },
  "cinematic-reveal": { headline: "This Is What\nWe Do", detail: "Marketing that moves at the speed of culture.", tagline: "not an agency. a weapon." },
  "focus-pull": { headline: "Sharper Than\nYou Expected", detail: "Content built for attention spans that don't exist.", tagline: "that's the point." },
  "whip-pan": { headline: "Create Launch Dominate Repeat", tagline: "the flywheel never stops." },
  "zoom-through": { headline: "Strategy That Scales", tagline: "from one post to a thousand." },
  "edge-bleed": { headline: "We Don't\nPlay Safe", tagline: "neither should you." },
  "split-field": { headline: "Better Content\nStarts Here", detail: "Your audience doesn't owe you attention. Earn it with work that moves.", tagline: "the quiet part, out loud." },
  "oversized-crop": { stat: "97%", detail: "Of Marketing Is\nForgettable", tagline: "let's fix that." },
  "isolation": { headline: "Less Is\nThe Point", tagline: "when the work is good, it doesn't need to shout." },
  "vertical-type": { headline: "SUPERBAD", detail: "Marketing that refuses to be background noise. Built to stop thumbs." },
  "stripe-cut": { headline: "Content That Converts", detail: "Strategy-first creative. No templates. No stock. No safe choices.", tagline: "this is how it's done." },
};

export const RemotionRoot: React.FC = () => {
  const defaultPalette = BRAND_PALETTES[0];
  const { width, height } = MOTION_DIMENSIONS[DEFAULT_RATIO];

  return (
    <>
      {ALL_MOTION_TEMPLATES.map((template) => {
        const Component = COMPOSITION_MAP[template.id];
        if (!Component) return null;

        const copy = SAMPLE_COPY[template.id] ||
          Object.fromEntries(
            template.copySlots.map((slot) => [slot, `Sample ${slot}`]),
          );

        return (
          <Composition
            key={template.id}
            id={template.id}
            component={Component}
            durationInFrames={template.defaultDuration}
            fps={FPS}
            width={width}
            height={height}
            defaultProps={{
              copy,
              palette: defaultPalette,
              transparent: false,
              animationParams: Object.fromEntries(
                template.animationParams.map((p) => [p.key, p.default]),
              ),
              fontPairingId: "house",
              layout: DEFAULT_LAYOUT,
            }}
          />
        );
      })}
    </>
  );
};

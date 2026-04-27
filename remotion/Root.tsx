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
import { withSfx } from "../lib/content-studio/motion/compositions/motion-sfx";
import { ALL_MOTION_TEMPLATES } from "../lib/content-studio/motion/registry";
import { BRAND_PALETTES } from "../lib/content-studio/motion/palettes";
import { MOTION_DIMENSIONS } from "../lib/content-studio/motion/types";
import type { MotionAspectRatio } from "../lib/content-studio/motion/types";

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
};

const DEFAULT_RATIO: MotionAspectRatio = "square";
const FPS = 30;

const SAMPLE_COPY: Record<string, Record<string, string>> = {
  "stat-counter": { stat: "$1250K", label: "Revenue generated", sublabel: "across all clients this quarter" },
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
            }}
          />
        );
      })}
    </>
  );
};

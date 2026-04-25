import React from "react";
import { Composition } from "remotion";
import { AnnouncementBoldMotion } from "../lib/content-studio/motion/compositions/announcement-bold-motion";
import { AnnouncementMinimalMotion } from "../lib/content-studio/motion/compositions/announcement-minimal-motion";
import {
  ALL_MOTION_TEMPLATES,
  getMotionTemplate,
} from "../lib/content-studio/motion/registry";
import { BRAND_PALETTES } from "../lib/content-studio/motion/palettes";
import { MOTION_DIMENSIONS } from "../lib/content-studio/motion/types";
import type { MotionAspectRatio } from "../lib/content-studio/motion/types";

const COMPOSITION_MAP: Record<string, React.FC<any>> = {
  "announcement-bold-motion": AnnouncementBoldMotion,
  "announcement-minimal-motion": AnnouncementMinimalMotion,
};

const DEFAULT_RATIO: MotionAspectRatio = "square";
const FPS = 30;

export const RemotionRoot: React.FC = () => {
  const defaultPalette = BRAND_PALETTES[0];
  const { width, height } = MOTION_DIMENSIONS[DEFAULT_RATIO];

  return (
    <>
      {ALL_MOTION_TEMPLATES.map((template) => {
        const Component = COMPOSITION_MAP[template.id];
        if (!Component) return null;

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
              copy: Object.fromEntries(
                template.copySlots.map((slot) => [slot, `Sample ${slot}`]),
              ),
              palette: defaultPalette,
              transparent: false,
              animationParams: Object.fromEntries(
                template.animationParams.map((p) => [p.key, p.default]),
              ),
            }}
          />
        );
      })}
    </>
  );
};

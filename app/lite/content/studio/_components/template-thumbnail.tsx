"use client";

import React, { useState, useRef, useCallback } from "react";
import { Thumbnail } from "@remotion/player";
import { COMPOSITION_MAP } from "./motion-player";
import { BRAND_PALETTES } from "@/lib/content-studio/motion/palettes";
import { DEFAULT_LAYOUT } from "@/lib/content-studio/motion/layouts";
import type { MotionTemplateProps } from "@/lib/content-studio/motion/types";
import { getMotionTemplate } from "@/lib/content-studio/motion/registry";

const PREVIEW_COPY: Record<string, Record<string, string>> = {
  "announcement-bold-motion": { headline: "We Just Hit\n500 Clients", detail: "And we're just warming up.", subtext: "Q2 2026", tagline: "the quiet part, out loud." },
  "announcement-minimal-motion": { headline: "New Work\nDropping Soon", detail: "Stay close.", tagline: "you'll want to see this." },
  "anti-motivation-typography-motion": { headline: "Nobody Cares\nHow Hard\nYou Worked", tagline: "they care about the result." },
  "tips-value-motion": { headline: "Three Things\nYour Feed\nIs Missing", detail: "Strategy. Consistency. Taste.", tagline: "start here." },
  "testimonial-quote-motion": { headline: "They made our brand\nfeel like us, but better.", detail: "Sarah Chen", subtext: "Founder, Baseline Studio" },
  "bts-caption-motion": { headline: "5am Call Sheet\nNobody Asked For", tagline: "the work behind the work." },
  "portfolio-showcase-motion": { headline: "Thetford Estate\nBrand Campaign", detail: "Photography · Strategy · Content", tagline: "delivered in 10 days." },
  "stat-counter": { stat: "$1.2M", label: "Revenue generated", sublabel: "across all clients this quarter" },
  "text-reveal": { headline: "Your Content\nDeserves Better", emphasis: "Better", tagline: "we can prove it." },
  "logo-sting": { logo: "SuperBad", tagline: "marketing that moves." },
  "word-slam": { headline: "Stop Scrolling Start Building", tagline: "the work speaks louder." },
  "cinematic-reveal": { headline: "This Is What\nWe Do", detail: "Marketing that moves at the speed of culture.", tagline: "not an agency. a weapon." },
  "focus-pull": { headline: "Sharper Than\nYou Expected", detail: "Content built for attention spans that don't exist.", tagline: "that's the point." },
  "whip-pan": { headline: "Create Launch Dominate Repeat", tagline: "the flywheel never stops." },
  "zoom-through": { headline: "Strategy\nThat Scales", tagline: "from one post to a thousand." },
  "edge-bleed": { headline: "We Don't\nPlay Safe", tagline: "neither should you." },
  "split-field": { headline: "Better Content\nStarts Here", detail: "Your audience doesn't owe you attention. Earn it.", tagline: "the quiet part, out loud." },
  "oversized-crop": { stat: "97%", detail: "Of Marketing Is\nForgettable", tagline: "let's fix that." },
  "isolation": { headline: "Less Is\nThe Point", tagline: "when the work is good, it doesn't need to shout." },
  "vertical-type": { headline: "SUPERBAD", detail: "Marketing that refuses to be background noise." },
  "stripe-cut": { headline: "Content That Converts", detail: "Strategy-first creative. No templates. No stock.", tagline: "this is how it's done." },
};

const HERO_FRAME = 55;

interface TemplateThumbnailProps {
  templateId: string;
  children: React.ReactNode;
}

export function TemplateThumbnail({ templateId, children }: TemplateThumbnailProps) {
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<"above" | "below">("above");
  const [hAlign, setHAlign] = useState<"center" | "left" | "right">("center");
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Component = COMPOSITION_MAP[templateId];
  const template = getMotionTemplate(templateId);

  const THUMB_W = 240;

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition(rect.top > 280 ? "above" : "below");

      const centerX = rect.left + rect.width / 2;
      const spaceRight = window.innerWidth - centerX;
      const spaceLeft = centerX;
      if (spaceRight < THUMB_W / 2 + 16) {
        setHAlign("right");
      } else if (spaceLeft < THUMB_W / 2 + 16) {
        setHAlign("left");
      } else {
        setHAlign("center");
      }
    }

    timeoutRef.current = setTimeout(() => setHovered(true), 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(false);
  }, []);

  if (!Component || !template) {
    return <>{children}</>;
  }

  const copy = PREVIEW_COPY[templateId] ??
    Object.fromEntries(template.copySlots.map((slot) => [slot, `Sample ${slot}`]));

  const palette = BRAND_PALETTES[0];
  const inputProps: MotionTemplateProps = {
    copy,
    palette,
    transparent: false,
    animationParams: Object.fromEntries(
      template.animationParams.map((p) => [p.key, p.default]),
    ),
    fontPairingId: "house",
    layout: DEFAULT_LAYOUT,
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: "relative" }}
    >
      {children}

      {hovered && (
        <div
          style={{
            position: "absolute",
            [position === "above" ? "bottom" : "top"]: "calc(100% + 12px)",
            ...(hAlign === "center"
              ? { left: "50%", transform: "translateX(-50%)" }
              : hAlign === "right"
                ? { right: 0 }
                : { left: 0 }),
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 240,
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(253, 245, 230, 0.1)",
              boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)",
            }}
          >
            <Thumbnail
              component={Component as unknown as React.ComponentType<Record<string, unknown>>}
              inputProps={inputProps}
              compositionWidth={1080}
              compositionHeight={1080}
              durationInFrames={template.defaultDuration}
              fps={30}
              frameToDisplay={HERO_FRAME}
              style={{ width: 240, height: 240 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

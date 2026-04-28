"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import type { TemplateDef } from "@/lib/content-studio/templates";
import { BRAND_PALETTES } from "@/lib/content-studio/motion/palettes";
import { DEFAULT_LAYOUT } from "@/lib/content-studio/motion/layouts";

const PREVIEW_COPY: Record<string, Record<string, string>> = {
  "announcement-bold": { headline: "We Just Hit\n500 Clients", detail: "And we're just warming up.", subtext: "Q2 2026", tagline: "the quiet part, out loud." },
  "announcement-minimal": { headline: "New Work\nDropping Soon", detail: "Stay close.", tagline: "you'll want to see this." },
  "anti-motivation-typography": { headline: "Nobody Cares\nHow Hard\nYou Worked", tagline: "they care about the result." },
  "tips-value": { headline: "Three Things\nYour Feed\nIs Missing", detail: "Strategy. Consistency. Taste.", tagline: "start here." },
  "testimonial-quote": { headline: "They made our brand feel like us, but better.", detail: "Sarah Chen", subtext: "Founder, Baseline Studio" },
  "bts-caption": { headline: "5am Call Sheet Nobody Asked For", tagline: "the work behind the work." },
  "portfolio-showcase": { headline: "Thetford Estate\nBrand Campaign", detail: "Photography · Strategy · Content", tagline: "delivered in 10 days." },
};

const THUMB_SIZE = 240;
const CANVAS_SIZE = 1080;
const SCALE = THUMB_SIZE / CANVAS_SIZE;

interface StaticTemplateThumbnailProps {
  template: TemplateDef;
  children: React.ReactNode;
}

export function StaticTemplateThumbnail({ template, children }: StaticTemplateThumbnailProps) {
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<"above" | "below">("above");
  const [hAlign, setHAlign] = useState<"center" | "left" | "right">("center");
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition(rect.top > 280 ? "above" : "below");

      const centerX = rect.left + rect.width / 2;
      const spaceRight = window.innerWidth - centerX;
      const spaceLeft = centerX;
      if (spaceRight < THUMB_SIZE / 2 + 16) {
        setHAlign("right");
      } else if (spaceLeft < THUMB_SIZE / 2 + 16) {
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

  const copy = PREVIEW_COPY[template.id] ??
    Object.fromEntries(template.copySlots.map((slot) => [slot, `Sample ${slot}`]));

  const html = useMemo(
    () =>
      template.renderHtml(copy, "square", {
        palette: BRAND_PALETTES[0],
        layout: DEFAULT_LAYOUT,
      }),
    [template, copy],
  );

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
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(253, 245, 230, 0.1)",
              boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)",
            }}
          >
            <iframe
              srcDoc={html}
              sandbox=""
              tabIndex={-1}
              aria-hidden
              style={{
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                border: "none",
                transform: `scale(${SCALE})`,
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

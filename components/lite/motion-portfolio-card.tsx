"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PlayIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

interface MotionPortfolioCardProps {
  videoUrl: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  engine: "remotion" | "higgsfield" | "composite";
  durationSec?: number;
}

const ENGINE_LABELS: Record<string, { label: string; color: string }> = {
  remotion: { label: "Motion", color: "#7BAE7E" },
  higgsfield: { label: "AI Cinematic", color: "var(--color-brand-orange)" },
  composite: { label: "Composite", color: "var(--color-brand-pink)" },
};

export function MotionPortfolioCard({
  videoUrl,
  thumbnailUrl,
  title,
  description,
  engine,
  durationSec,
}: MotionPortfolioCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const engineInfo = ENGINE_LABELS[engine] ?? ENGINE_LABELS.remotion;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hovered && !shouldReduceMotion) {
      video.currentTime = 0;
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }, [hovered, shouldReduceMotion]);

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
      className="group overflow-hidden rounded-xl"
      style={{
        backgroundColor: "var(--color-neutral-800)",
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-video overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />

        {!playing && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "rgba(26, 26, 24, 0.4)" }}
          >
            <div
              className="flex size-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(253, 245, 230, 0.15)" }}
            >
              <PlayIcon
                className="ml-0.5 size-4"
                style={{ color: "var(--color-brand-cream)" }}
              />
            </div>
          </div>
        )}

        {/* Engine badge */}
        <div className="absolute left-2 top-2">
          <span
            className="rounded px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{
              letterSpacing: "1px",
              backgroundColor: `color-mix(in srgb, ${engineInfo.color} 15%, transparent)`,
              color: engineInfo.color,
            }}
          >
            {engineInfo.label}
          </span>
        </div>

        {/* Duration */}
        {durationSec && (
          <div className="absolute bottom-2 right-2">
            <span
              className="rounded px-1.5 py-0.5 font-[family-name:var(--font-body)] text-[10px] tabular-nums"
              style={{
                backgroundColor: "rgba(26, 26, 24, 0.7)",
                color: "var(--color-brand-cream)",
              }}
            >
              {Math.floor(durationSec / 60)}:{String(durationSec % 60).padStart(2, "0")}
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3
          className="truncate font-[family-name:var(--font-body)] text-[14px] font-medium"
          style={{ color: "var(--color-brand-cream)" }}
        >
          {title}
        </h3>
        {description && (
          <p
            className="mt-0.5 line-clamp-2 font-[family-name:var(--font-body)] text-[12px] leading-relaxed"
            style={{ color: "var(--color-neutral-400)" }}
          >
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
}

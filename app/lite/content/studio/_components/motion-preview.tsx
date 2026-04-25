"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import { MotionPlayer } from "./motion-player";
import { PaletteSwatches } from "./palette-swatches";
import { MotionTimeline } from "./motion-timeline";
import { getMotionTemplate } from "@/lib/content-studio/motion/registry";
import { BRAND_PALETTES, getPalette } from "@/lib/content-studio/motion/palettes";
import type { ColourPalette } from "@/lib/content-studio/motion/types";
import { MOTION_ASPECT_RATIOS, MOTION_RATIO_LABELS, type MotionAspectRatio } from "@/lib/content-studio/motion/types";
import type { SlideCopy } from "@/lib/content-studio/generate-copy";

export interface MotionPostData {
  id: string;
  motionTemplateId: string;
  slides: SlideCopy[];
  brief: string;
  paletteId: string;
  animationParams: Record<string, number | string | boolean>;
  primaryAspectRatio: MotionAspectRatio;
}

interface MotionPreviewProps {
  post: MotionPostData;
  onCopyChange: (slides: SlideCopy[]) => void;
  onPaletteChange: (paletteId: string) => void;
  onAspectRatioChange: (ratio: MotionAspectRatio) => void;
  onNewPost: () => void;
}

export function MotionPreview({
  post,
  onCopyChange,
  onPaletteChange,
  onAspectRatioChange,
  onNewPost,
}: MotionPreviewProps) {
  const playerRef = useRef<PlayerRef>(null);
  const template = getMotionTemplate(post.motionTemplateId);
  const [editingCopy, setEditingCopy] = useState<SlideCopy>(
    post.slides[0] ?? {},
  );
  const [palette, setPalette] = useState<ColourPalette>(
    () => getPalette(post.paletteId) ?? BRAND_PALETTES[0],
  );
  const [aspectRatio, setAspectRatio] = useState<MotionAspectRatio>(
    post.primaryAspectRatio,
  );
  const [transparent, setTransparent] = useState(false);

  const durationInFrames = template?.defaultDuration ?? 90;
  const fps = 30;

  const handleSlotChange = useCallback(
    (slot: string, value: string) => {
      setEditingCopy((prev) => {
        const next = { ...prev, [slot]: value };
        onCopyChange([next]);
        return next;
      });
    },
    [onCopyChange],
  );

  const handlePaletteSelect = useCallback(
    (p: ColourPalette) => {
      setPalette(p);
      onPaletteChange(p.id);
    },
    [onPaletteChange],
  );

  const handleRatioChange = useCallback(
    (ratio: MotionAspectRatio) => {
      setAspectRatio(ratio);
      onAspectRatioChange(ratio);
    },
    [onAspectRatioChange],
  );

  if (!template) {
    return (
      <div style={{ color: "var(--color-brand-cream)", padding: 32 }}>
        Unknown motion template: {post.motionTemplateId}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 24, width: "100%" }}>
      {/* Left: Preview viewport + controls */}
      <div style={{ flex: "1 1 0", minWidth: 0 }}>
        {/* Palette swatches */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "rgba(253,245,230,0.4)",
              marginBottom: 4,
            }}
          >
            Palette
          </div>
          <PaletteSwatches
            palettes={BRAND_PALETTES}
            activePaletteId={palette.id}
            onSelect={handlePaletteSelect}
          />
        </div>

        {/* Aspect ratio picker */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {MOTION_ASPECT_RATIOS.map((r) => (
            <button
              key={r}
              onClick={() => handleRatioChange(r)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border:
                  r === aspectRatio
                    ? "1px solid var(--color-brand-red)"
                    : "1px solid rgba(253,245,230,0.1)",
                background:
                  r === aspectRatio
                    ? "rgba(178,40,72,0.15)"
                    : "rgba(253,245,230,0.03)",
                color: "var(--color-brand-cream)",
                fontFamily: "var(--font-label)",
                fontSize: 11,
                letterSpacing: 1,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {MOTION_RATIO_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Remotion Player */}
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid rgba(253,245,230,0.08)",
            background: transparent
              ? `repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 20px 20px`
              : "#0F0F0E",
          }}
        >
          <MotionPlayer
            ref={playerRef}
            templateId={post.motionTemplateId}
            copy={editingCopy}
            palette={palette}
            aspectRatio={aspectRatio}
            transparent={transparent}
            animationParams={post.animationParams}
            durationInFrames={durationInFrames}
            fps={fps}
          />
        </div>

        {/* Timeline */}
        <MotionTimeline
          playerRef={playerRef}
          durationInFrames={durationInFrames}
          fps={fps}
        />

        {/* Overlay toggle for overlay-capable templates */}
        {template.overlayCapable && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-label)",
              fontSize: 12,
              letterSpacing: 1,
              color: "rgba(253,245,230,0.5)",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              style={{ accentColor: "var(--color-brand-red)" }}
            />
            Overlay preview (transparent background)
          </label>
        )}
      </div>

      {/* Right: Text editing panel */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(253,245,230,0.4)",
          }}
        >
          Edit copy
        </div>

        {template.copySlots.map((slot) => (
          <div key={slot}>
            <label
              style={{
                display: "block",
                fontFamily: "var(--font-label)",
                fontSize: 12,
                letterSpacing: 1,
                color: "rgba(253,245,230,0.6)",
                marginBottom: 4,
                textTransform: "capitalize",
              }}
            >
              {slot}
            </label>
            <textarea
              value={editingCopy[slot] ?? ""}
              onChange={(e) => handleSlotChange(slot, e.target.value)}
              rows={slot === "headline" ? 3 : 2}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid rgba(253,245,230,0.1)",
                background: "rgba(253,245,230,0.03)",
                color: "var(--color-brand-cream)",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        ))}

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <div
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 12,
              letterSpacing: 1,
              color: "rgba(253,245,230,0.35)",
              marginBottom: 8,
            }}
          >
            Template: {template.name}
          </div>

          <button
            onClick={onNewPost}
            style={{
              width: "100%",
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid rgba(253,245,230,0.12)",
              background: "rgba(253,245,230,0.05)",
              color: "var(--color-brand-cream)",
              fontFamily: "var(--font-label)",
              fontSize: 12,
              letterSpacing: 1,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            New post
          </button>
        </div>
      </div>
    </div>
  );
}

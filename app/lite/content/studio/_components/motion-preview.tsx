"use client";

import React, { useCallback, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import { MotionPlayer } from "./motion-player";
import { PaletteSwatches } from "./palette-swatches";
import { MotionTimeline } from "./motion-timeline";
import { SfxTimeline } from "./sfx-timeline";
import { FontPairingPicker } from "./font-pairing-picker";
import { LayoutPicker } from "./layout-picker";
import { getMotionTemplate } from "@/lib/content-studio/motion/registry";
import { BRAND_PALETTES, getPalette } from "@/lib/content-studio/motion/palettes";
import type { ColourPalette, SfxCueData } from "@/lib/content-studio/motion/types";
import { MOTION_ASPECT_RATIOS, MOTION_RATIO_LABELS, type MotionAspectRatio } from "@/lib/content-studio/motion/types";
import type { MotionLayoutConfig } from "@/lib/content-studio/motion/layouts";
import { DEFAULT_LAYOUT } from "@/lib/content-studio/motion/layouts";
import type { SlideCopy } from "@/lib/content-studio/generate-copy";
import { toast } from "sonner";
import { exportMotionPostAction } from "../actions";

export interface MotionPostData {
  id: string;
  motionTemplateId: string;
  slides: SlideCopy[];
  brief: string;
  paletteId: string;
  animationParams: Record<string, number | string | boolean>;
  primaryAspectRatio: MotionAspectRatio;
  fontPairingId?: string | null;
  durationInFrames?: number | null;
  sfxCues?: SfxCueData[];
}

interface MotionPreviewProps {
  post: MotionPostData;
  onCopyChange: (slides: SlideCopy[]) => void;
  onPaletteChange: (paletteId: string) => void;
  onAspectRatioChange: (ratio: MotionAspectRatio) => void;
  onFontPairingChange: (id: string | null) => void;
  onDurationChange: (frames: number) => void;
  onSfxChange: (cues: SfxCueData[]) => void;
  onLayoutChange: (layout: MotionLayoutConfig) => void;
  onNewPost: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-label)",
        fontSize: 10,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "rgba(253,245,230,0.35)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function SectionDivider() {
  return (
    <div
      style={{
        borderTop: "1px solid rgba(253,245,230,0.06)",
        margin: "16px 0",
      }}
    />
  );
}

export function MotionPreview({
  post,
  onCopyChange,
  onPaletteChange,
  onAspectRatioChange,
  onFontPairingChange,
  onDurationChange,
  onSfxChange,
  onLayoutChange,
  onNewPost,
}: MotionPreviewProps) {
  const playerRef = React.useRef<PlayerRef>(null);
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
  const [exportFormat, setExportFormat] = useState<"mp4" | "webm">("mp4");
  const [exportRatios, setExportRatios] = useState<Set<MotionAspectRatio>>(
    () => new Set([post.primaryAspectRatio]),
  );
  const [sfxCues, setSfxCues] = useState<SfxCueData[]>(post.sfxCues ?? []);
  const [exporting, setExporting] = useState(false);
  const [exportResults, setExportResults] = useState<
    { ratio: string; format: string; url: string }[]
  >([]);
  const [activeLayout, setActiveLayout] = useState<MotionLayoutConfig>(() => {
    const stored = post.animationParams._layout;
    if (typeof stored === "string") {
      try {
        return JSON.parse(stored);
      } catch {
        return DEFAULT_LAYOUT;
      }
    }
    return DEFAULT_LAYOUT;
  });

  const fps = 30;
  const defaultDuration = template?.defaultDuration ?? 90;
  const minDuration = template?.minDuration ?? 60;
  const maxDuration = template?.maxDuration ?? 180;
  const [durationInFrames, setDurationInFrames] = useState(
    post.durationInFrames ?? defaultDuration,
  );

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

  const handleDurationChange = useCallback(
    (frames: number) => {
      setDurationInFrames(frames);
      onDurationChange(frames);
    },
    [onDurationChange],
  );

  const handleSfxChange = useCallback(
    (cues: SfxCueData[]) => {
      setSfxCues(cues);
      onSfxChange(cues);
    },
    [onSfxChange],
  );

  const handleLayoutChange = useCallback(
    (layout: MotionLayoutConfig) => {
      setActiveLayout(layout);
      onLayoutChange(layout);
    },
    [onLayoutChange],
  );

  const handleExport = useCallback(async () => {
    if (exportRatios.size === 0) {
      toast.error("Select at least one aspect ratio.");
      return;
    }
    setExporting(true);
    const result = await exportMotionPostAction({
      postId: post.id,
      ratios: Array.from(exportRatios),
      format: exportFormat,
      transparent: transparent && exportFormat === "webm",
    });
    setExporting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const successful = result.renders.filter((r) => r.url);
    setExportResults(successful);
    toast.success(
      `${successful.length} render${successful.length === 1 ? "" : "s"} complete.`,
    );
  }, [post.id, exportRatios, exportFormat, transparent]);

  const toggleExportRatio = useCallback((r: MotionAspectRatio) => {
    setExportRatios((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }, []);

  if (!template) {
    return (
      <div style={{ color: "var(--color-brand-cream)", padding: 32 }}>
        Unknown motion template: {post.motionTemplateId}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 24, width: "100%" }}>
      {/* Left: Viewport + timelines */}
      <div style={{ flex: "1 1 0", minWidth: 0 }}>
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
            sfxCues={sfxCues}
            fontPairingId={post.fontPairingId ?? undefined}
            layout={template.layoutSupported ? activeLayout : undefined}
          />
        </div>

        <MotionTimeline
          playerRef={playerRef}
          durationInFrames={durationInFrames}
          fps={fps}
        />

        <SfxTimeline
          cues={sfxCues}
          onChange={handleSfxChange}
          durationInFrames={durationInFrames}
          fps={fps}
          playerRef={playerRef}
        />
      </div>

      {/* Right: Control panel */}
      <div
        style={{
          width: 300,
          flexShrink: 0,
          overflowY: "auto",
          maxHeight: "calc(100vh - 160px)",
          paddingRight: 4,
        }}
      >
        {/* ── Copy ── */}
        <SectionLabel>Copy</SectionLabel>
        {template.copySlots.map((slot) => (
          <div key={slot} style={{ marginBottom: 10 }}>
            <label
              style={{
                display: "block",
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: 0.5,
                color: "rgba(253,245,230,0.5)",
                marginBottom: 3,
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
                padding: "6px 8px",
                borderRadius: 5,
                border: "1px solid rgba(253,245,230,0.1)",
                background: "rgba(253,245,230,0.03)",
                color: "var(--color-brand-cream)",
                fontFamily: "var(--font-body)",
                fontSize: 12,
                lineHeight: 1.5,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        ))}

        <SectionDivider />

        {/* ── Style ── */}
        <SectionLabel>Style</SectionLabel>
        <div style={{ marginBottom: 10 }}>
          <FontPairingPicker
            activePairingId={post.fontPairingId ?? null}
            onSelect={onFontPairingChange}
          />
        </div>
        <div>
          <div
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: 0.5,
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

        {/* ── Layout (only for layout-supported templates) ── */}
        {template.layoutSupported && (
          <>
            <SectionDivider />
            <LayoutPicker
              activeLayout={activeLayout}
              onChange={handleLayoutChange}
            />
          </>
        )}

        <SectionDivider />

        {/* ── Canvas ── */}
        <SectionLabel>Canvas</SectionLabel>

        {/* Aspect ratio */}
        <div
          style={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          {MOTION_ASPECT_RATIOS.map((r) => (
            <button
              key={r}
              onClick={() => handleRatioChange(r)}
              style={{
                padding: "3px 8px",
                borderRadius: 5,
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
                fontSize: 10,
                letterSpacing: 0.5,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {MOTION_RATIO_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Duration */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: 0.5,
              color: "rgba(253,245,230,0.4)",
              flexShrink: 0,
            }}
          >
            Duration
          </div>
          <input
            type="range"
            min={minDuration}
            max={maxDuration}
            step={1}
            value={durationInFrames}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            style={{
              flex: 1,
              accentColor: "var(--color-brand-red)",
              cursor: "pointer",
              height: 4,
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              color: "rgba(253,245,230,0.5)",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {(durationInFrames / fps).toFixed(1)}s
          </div>
        </div>

        {/* Overlay toggle */}
        {template.overlayCapable && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: 0.5,
              color: "rgba(253,245,230,0.4)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              style={{ accentColor: "var(--color-brand-red)" }}
            />
            Transparent overlay
          </label>
        )}

        <SectionDivider />

        {/* ── Export ── */}
        <SectionLabel>Export</SectionLabel>

        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {(["mp4", "webm"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setExportFormat(f)}
              style={{
                padding: "3px 10px",
                borderRadius: 5,
                border:
                  exportFormat === f
                    ? "1px solid var(--color-brand-red)"
                    : "1px solid rgba(253,245,230,0.1)",
                background:
                  exportFormat === f
                    ? "rgba(178,40,72,0.15)"
                    : "rgba(253,245,230,0.03)",
                color: "var(--color-brand-cream)",
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: 0.5,
                cursor: "pointer",
              }}
            >
              {f === "mp4" ? "MP4" : "WebM (alpha)"}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: 10,
          }}
        >
          {MOTION_ASPECT_RATIOS.map((r) => (
            <label
              key={r}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 6px",
                borderRadius: 5,
                border: "1px solid rgba(253,245,230,0.08)",
                background: exportRatios.has(r)
                  ? "rgba(253,245,230,0.06)"
                  : "transparent",
                cursor: "pointer",
                fontFamily: "var(--font-label)",
                fontSize: 10,
                color: "var(--color-brand-cream)",
                letterSpacing: 0.3,
              }}
            >
              <input
                type="checkbox"
                checked={exportRatios.has(r)}
                onChange={() => toggleExportRatio(r)}
                style={{ accentColor: "var(--color-brand-red)" }}
              />
              {MOTION_RATIO_LABELS[r]}
            </label>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || exportRatios.size === 0}
          style={{
            padding: "6px 16px",
            borderRadius: 5,
            border: "none",
            background: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: 1,
            cursor: "pointer",
            opacity: exporting || exportRatios.size === 0 ? 0.5 : 1,
          }}
        >
          {exporting
            ? "Rendering…"
            : `Export ${exportRatios.size} ratio${exportRatios.size === 1 ? "" : "s"}`}
        </button>

        {exportResults.length > 0 && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {exportResults.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  padding: "4px 10px",
                  borderRadius: 5,
                  background: "rgba(253,245,230,0.04)",
                  border: "1px solid rgba(253,245,230,0.1)",
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  color: "var(--color-brand-cream)",
                  textDecoration: "none",
                  letterSpacing: 0.3,
                }}
              >
                {r.ratio} {r.format.toUpperCase()}
              </a>
            ))}
          </div>
        )}

        <SectionDivider />

        {/* ── Footer ── */}
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: 0.5,
            color: "rgba(253,245,230,0.25)",
            marginBottom: 8,
          }}
        >
          {template.name}
        </div>

        <button
          onClick={onNewPost}
          style={{
            width: "100%",
            padding: "6px 12px",
            borderRadius: 5,
            border: "1px solid rgba(253,245,230,0.1)",
            background: "rgba(253,245,230,0.04)",
            color: "var(--color-brand-cream)",
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: 1,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          New post
        </button>
      </div>
    </div>
  );
}

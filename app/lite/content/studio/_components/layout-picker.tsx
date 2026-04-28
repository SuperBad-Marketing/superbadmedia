"use client";

import React, { useCallback, useState } from "react";
import type { MotionLayoutConfig } from "@/lib/content-studio/motion/layouts";
import {
  PRESET_LAYOUTS,
  LAYOUT_SLIDER_RANGES,
} from "@/lib/content-studio/motion/layouts";

interface LayoutPickerProps {
  activeLayout: MotionLayoutConfig;
  onChange: (layout: MotionLayoutConfig) => void;
}

const ALIGN_OPTIONS: { value: "left" | "center" | "right"; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const MINI_LAYOUT_LINES: Record<string, number[]> = {
  left: [0.7, 0.5, 0.3],
  center: [0.5, 0.7, 0.35],
  right: [0.6, 0.45, 0.3],
};

function LayoutThumbnail({
  layout,
  active,
}: {
  layout: MotionLayoutConfig;
  active: boolean;
}) {
  const lines = MINI_LAYOUT_LINES[layout.textAlign] ?? MINI_LAYOUT_LINES.left;
  const vp = layout.verticalPosition;
  const topOffset = vp <= 30 ? 20 : vp >= 70 ? 55 : 35;

  return (
    <div
      style={{
        width: 40,
        height: 50,
        borderRadius: 4,
        background: active
          ? "rgba(178,40,72,0.12)"
          : "rgba(253,245,230,0.03)",
        border: active
          ? "1px solid var(--color-brand-red)"
          : "1px solid rgba(253,245,230,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "0 5px",
        paddingTop: `${topOffset}%`,
        alignItems:
          layout.textAlign === "center"
            ? "center"
            : layout.textAlign === "right"
              ? "flex-end"
              : "flex-start",
        transition: "all 0.15s",
      }}
    >
      {lines.map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w * 100}%`,
            height: i === 0 ? 3 : 2,
            borderRadius: 1,
            background: active
              ? "var(--color-brand-red)"
              : i === 0
                ? "rgba(253,245,230,0.4)"
                : "rgba(253,245,230,0.2)",
            opacity: i === 0 ? (active ? 1 : 0.8) : 0.6,
          }}
        />
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: 0.5,
          color: "rgba(253,245,230,0.4)",
          minWidth: 72,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
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
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {displayValue}
      </div>
    </div>
  );
}

export function LayoutPicker({ activeLayout, onChange }: LayoutPickerProps) {
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetSelect = useCallback(
    (preset: MotionLayoutConfig) => {
      onChange(preset);
      setShowCustom(false);
    },
    [onChange],
  );

  const handleSliderChange = useCallback(
    (key: keyof MotionLayoutConfig, value: number | string) => {
      onChange({ ...activeLayout, id: "custom", isPreset: false, [key]: value });
    },
    [activeLayout, onChange],
  );

  return (
    <div>
      {/* Section label */}
      <div
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(253,245,230,0.4)",
          marginBottom: 8,
        }}
      >
        Layout
      </div>

      {/* Preset grid */}
      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        {PRESET_LAYOUTS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetSelect(preset)}
            title={`${preset.name} — ${preset.description}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
          >
            <LayoutThumbnail
              layout={preset}
              active={activeLayout.id === preset.id}
            />
            <div
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 8,
                letterSpacing: 0.5,
                color:
                  activeLayout.id === preset.id
                    ? "var(--color-brand-cream)"
                    : "rgba(253,245,230,0.3)",
                maxWidth: 44,
                textAlign: "center",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {preset.name}
            </div>
          </button>
        ))}
      </div>

      {/* Customize toggle */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: 1,
          color: showCustom
            ? "var(--color-brand-cream)"
            : "rgba(253,245,230,0.35)",
          background: showCustom
            ? "rgba(253,245,230,0.06)"
            : "transparent",
          border: "1px solid rgba(253,245,230,0.08)",
          borderRadius: 5,
          padding: "4px 10px",
          cursor: "pointer",
          transition: "all 0.15s",
          marginBottom: showCustom ? 10 : 0,
        }}
      >
        {showCustom ? "Hide sliders" : "Customize"}
      </button>

      {/* Custom sliders */}
      {showCustom && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "10px 0",
          }}
        >
          {/* Text alignment */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: 0.5,
                color: "rgba(253,245,230,0.4)",
                minWidth: 72,
              }}
            >
              Align
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {ALIGN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSliderChange("textAlign", opt.value)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 4,
                    border:
                      activeLayout.textAlign === opt.value
                        ? "1px solid var(--color-brand-red)"
                        : "1px solid rgba(253,245,230,0.1)",
                    background:
                      activeLayout.textAlign === opt.value
                        ? "rgba(178,40,72,0.15)"
                        : "rgba(253,245,230,0.03)",
                    color: "var(--color-brand-cream)",
                    fontFamily: "var(--font-label)",
                    fontSize: 10,
                    letterSpacing: 0.5,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Slider
            label="Position"
            value={activeLayout.verticalPosition}
            {...LAYOUT_SLIDER_RANGES.verticalPosition}
            displayValue={
              activeLayout.verticalPosition <= 30
                ? "Top"
                : activeLayout.verticalPosition >= 70
                  ? "Bottom"
                  : "Center"
            }
            onChange={(v) => handleSliderChange("verticalPosition", v)}
          />
          <Slider
            label="Headline"
            value={activeLayout.headlineScale}
            {...LAYOUT_SLIDER_RANGES.headlineScale}
            displayValue={`${Math.round(activeLayout.headlineScale * 100)}%`}
            onChange={(v) => handleSliderChange("headlineScale", v)}
          />
          <Slider
            label="Detail"
            value={activeLayout.detailScale}
            {...LAYOUT_SLIDER_RANGES.detailScale}
            displayValue={`${Math.round(activeLayout.detailScale * 100)}%`}
            onChange={(v) => handleSliderChange("detailScale", v)}
          />
          <Slider
            label="Line height"
            value={activeLayout.lineHeight}
            {...LAYOUT_SLIDER_RANGES.lineHeight}
            displayValue={activeLayout.lineHeight.toFixed(2)}
            onChange={(v) => handleSliderChange("lineHeight", v)}
          />
          <Slider
            label="Tracking"
            value={activeLayout.letterSpacing}
            {...LAYOUT_SLIDER_RANGES.letterSpacing}
            displayValue={`${activeLayout.letterSpacing > 0 ? "+" : ""}${activeLayout.letterSpacing}`}
            onChange={(v) => handleSliderChange("letterSpacing", v)}
          />
          <Slider
            label="Padding"
            value={activeLayout.paddingScale}
            {...LAYOUT_SLIDER_RANGES.paddingScale}
            displayValue={`${Math.round(activeLayout.paddingScale * 100)}%`}
            onChange={(v) => handleSliderChange("paddingScale", v)}
          />
          <Slider
            label="Width"
            value={activeLayout.contentWidth}
            {...LAYOUT_SLIDER_RANGES.contentWidth}
            displayValue={`${activeLayout.contentWidth}%`}
            onChange={(v) => handleSliderChange("contentWidth", v)}
          />
          <Slider
            label="Spacing"
            value={activeLayout.elementGap}
            {...LAYOUT_SLIDER_RANGES.elementGap}
            displayValue={`${activeLayout.elementGap}px`}
            onChange={(v) => handleSliderChange("elementGap", v)}
          />
        </div>
      )}
    </div>
  );
}

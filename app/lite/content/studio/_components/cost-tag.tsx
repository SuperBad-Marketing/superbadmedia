"use client";

import type { ContentFormat } from "@/lib/content-studio/brief-parser";

const COST_MAP: Record<ContentFormat, { label: string; amount: string; color: string }> = {
  static: { label: "Free", amount: "$0", color: "#7BAE7E" },
  animated: { label: "Free", amount: "$0", color: "#7BAE7E" },
  cinematic: { label: "AI gen", amount: "~$0.75", color: "var(--color-brand-orange)" },
  composite: { label: "AI + overlay", amount: "~$0.80", color: "var(--color-brand-orange)" },
};

interface CostTagProps {
  format: ContentFormat;
  variants?: number;
}

export function CostTag({ format, variants = 1 }: CostTagProps) {
  const info = COST_MAP[format] ?? COST_MAP.static;
  const isMulti = variants > 1 && (format === "cinematic" || format === "composite");

  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-[family-name:var(--font-body)] text-[10px] tabular-nums"
      style={{
        backgroundColor: `color-mix(in srgb, ${info.color} 12%, transparent)`,
        color: info.color,
      }}
    >
      {isMulti
        ? `${variants}× ${info.amount} ≈ $${(variants * 0.75).toFixed(2)}`
        : `${info.label} · ${info.amount}`}
    </span>
  );
}

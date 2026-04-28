"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ClockIcon, CheckCircleIcon, LoaderIcon, AlertCircleIcon, FilmIcon, SparklesIcon, LayoutGridIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

export type WipStatus = "brief" | "generating" | "ready" | "exported" | "failed";

export interface WipProject {
  id: string;
  name: string;
  status: WipStatus;
  format: "static" | "animated" | "cinematic" | "composite";
  thumbnailUrl?: string;
  updatedAt: number;
}

const STATUS_CONFIG: Record<WipStatus, { label: string; icon: typeof ClockIcon; color: string }> = {
  brief: { label: "Brief", icon: ClockIcon, color: "var(--color-neutral-500)" },
  generating: { label: "Generating", icon: LoaderIcon, color: "var(--color-brand-orange)" },
  ready: { label: "Ready", icon: CheckCircleIcon, color: "#7BAE7E" },
  exported: { label: "Exported", icon: CheckCircleIcon, color: "var(--color-brand-pink)" },
  failed: { label: "Failed", icon: AlertCircleIcon, color: "var(--color-brand-red)" },
};

const FORMAT_ICONS: Record<string, typeof FilmIcon> = {
  static: LayoutGridIcon,
  animated: SparklesIcon,
  cinematic: FilmIcon,
  composite: FilmIcon,
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface WipSectionProps {
  projects: WipProject[];
  onSelect: (id: string) => void;
}

export function WipSection({ projects, onSelect }: WipSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  if (projects.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Work in progress
        </span>
        <span
          className="flex size-5 items-center justify-center rounded-full font-[family-name:var(--font-body)] text-[10px] font-medium"
          style={{
            backgroundColor: "rgba(178, 40, 72, 0.15)",
            color: "var(--color-brand-pink)",
          }}
        >
          {projects.length}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, i) => {
          const statusConf = STATUS_CONFIG[project.status];
          const StatusIcon = statusConf.icon;
          const FormatIcon = FORMAT_ICONS[project.format] ?? LayoutGridIcon;

          return (
            <motion.button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { ...houseSpring, delay: i * 0.04 }
              }
              whileHover={shouldReduceMotion ? undefined : { y: -2 }}
              className="flex items-center gap-3 rounded-xl p-3 text-left transition-colors"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                border: "1px solid rgba(253, 245, 230, 0.06)",
              }}
            >
              {project.thumbnailUrl ? (
                <img
                  src={project.thumbnailUrl}
                  alt=""
                  className="size-10 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="flex size-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(253, 245, 230, 0.04)" }}
                >
                  <FormatIcon className="size-4" style={{ color: "var(--color-neutral-500)" }} />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div
                  className="truncate font-[family-name:var(--font-body)] text-[13px] font-medium"
                  style={{ color: "var(--color-brand-cream)" }}
                >
                  {project.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <StatusIcon
                    className={`size-3 ${project.status === "generating" ? "animate-spin" : ""}`}
                    style={{ color: statusConf.color }}
                  />
                  <span
                    className="font-[family-name:var(--font-body)] text-[11px]"
                    style={{ color: statusConf.color }}
                  >
                    {statusConf.label}
                  </span>
                  <span
                    className="font-[family-name:var(--font-body)] text-[11px]"
                    style={{ color: "var(--color-neutral-500)", opacity: 0.6 }}
                  >
                    {timeAgo(project.updatedAt)}
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

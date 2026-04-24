"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  LoaderIcon,
  PlayIcon,
  FilmIcon,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { getVideoLibraryAction, pollVideoJobAction } from "../actions";
import type { VideoJobRow } from "@/lib/db/schema/video-jobs";

const STATUS_CONFIG = {
  draft: { icon: ClockIcon, label: "Draft", color: "var(--color-neutral-500)" },
  queued: { icon: ClockIcon, label: "Queued", color: "var(--color-neutral-400)" },
  generating: { icon: LoaderIcon, label: "Generating", color: "var(--color-brand-pink)" },
  ready: { icon: CheckCircleIcon, label: "Ready", color: "#22c55e" },
  failed: { icon: AlertCircleIcon, label: "Failed", color: "var(--color-brand-red)" },
} as const;

const VIDEO_TYPE_LABELS: Record<string, string> = {
  cinematic: "Cinematic",
  motion_design: "Motion Design",
  product_showcase: "Product",
  social_short: "Social",
  talking_head: "Talking Head",
};

export function VideoLibrary({ refreshKey }: { refreshKey: number }) {
  const [jobs, setJobs] = useState<VideoJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    const res = await getVideoLibraryAction();
    if (res.ok) setJobs(res.jobs);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs, refreshKey]);

  useEffect(() => {
    const generatingJobs = jobs.filter(
      (j) => j.status === "generating" || j.status === "queued",
    );
    if (generatingJobs.length === 0) return;

    const interval = setInterval(async () => {
      for (const job of generatingJobs) {
        const res = await pollVideoJobAction(job.id);
        if (res.ok && (res.status === "ready" || res.status === "failed")) {
          loadJobs();
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="h-5 w-5 animate-spin text-[color:var(--color-neutral-500)]" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FilmIcon className="h-8 w-8 text-[color:var(--color-neutral-600)]" />
        <p className="mt-3 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          No videos yet.
        </p>
        <p className="mt-1 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-neutral-600)]">
          describe something above and let the machine work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const config = STATUS_CONFIG[job.status];
        const Icon = config.icon;
        const isSelected = selectedJob === job.id;

        return (
          <motion.div
            key={job.id}
            layout
            transition={houseSpring}
          >
            <button
              type="button"
              onClick={() => setSelectedJob(isSelected ? null : job.id)}
              className="w-full rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] p-4 text-left transition-colors hover:border-[color:var(--color-neutral-600)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={
                        "h-4 w-4 shrink-0" +
                        (job.status === "generating" ? " animate-spin" : "")
                      }
                      style={{ color: config.color }}
                    />
                    <span
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase"
                      style={{ letterSpacing: "1.5px", color: config.color }}
                    >
                      {config.label}
                    </span>
                    <span className="text-[color:var(--color-neutral-600)]">
                      ·
                    </span>
                    <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
                      {VIDEO_TYPE_LABELS[job.video_type] ?? job.video_type}
                    </span>
                    <span className="text-[color:var(--color-neutral-600)]">
                      ·
                    </span>
                    <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
                      {job.engine}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]">
                    {job.initial_prompt}
                  </p>
                  <div className="mt-1 flex items-center gap-3 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                    {job.aspect_ratio && <span>{job.aspect_ratio}</span>}
                    {job.duration_sec && <span>{job.duration_sec}s</span>}
                    {job.credits_used != null && (
                      <span>{job.credits_used} credits</span>
                    )}
                    {job.generation_ms != null && (
                      <span>
                        {Math.round(job.generation_ms / 1000)}s gen time
                      </span>
                    )}
                    <span>
                      {new Date(job.created_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {job.status === "ready" && job.output_url && (
                  <a
                    href={job.output_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-lg p-2 text-[color:var(--color-brand-pink)] transition-colors hover:bg-[color:var(--color-brand-pink)]/10"
                    title="Play video"
                  >
                    <PlayIcon className="h-5 w-5" />
                  </a>
                )}
              </div>

              {job.status === "failed" && job.error_message && (
                <p className="mt-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-red)]">
                  {job.error_message}
                </p>
              )}
            </button>

            {isSelected && job.status === "ready" && job.output_url && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={houseSpring}
                className="mt-2 overflow-hidden rounded-xl border border-[color:var(--color-neutral-700)] bg-black"
              >
                <video
                  src={job.output_url}
                  controls
                  className="w-full"
                  poster={job.thumbnail_url ?? undefined}
                />
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

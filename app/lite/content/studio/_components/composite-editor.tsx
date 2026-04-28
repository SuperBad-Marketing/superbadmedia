"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { LayersIcon, FilmIcon, ScissorsIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { houseSpring } from "@/lib/design-tokens";
import { ALL_MOTION_TEMPLATES } from "@/lib/content-studio/motion/registry";
import type { PipelineStage } from "@/lib/db/schema/video-jobs";
import { CompositeStageTracker } from "./composite-stage-tracker";

const OVERLAY_TEMPLATES = ALL_MOTION_TEMPLATES.filter((t) => t.overlayCapable);

export interface CompositeJob {
  id: string;
  footageUrl: string | null;
  overlayUrl: string | null;
  compositeUrl: string | null;
  pipelineStage: PipelineStage;
  status: string;
  errorMessage: string | null;
  overlayTemplateId: string | null;
  overlayCopy: Record<string, string>;
  overlayParams: Record<string, number | string | boolean>;
  trimInFrame: number;
  trimOutFrame: number | null;
  durationSec: number;
  aspectRatio: string;
}

interface CompositeEditorProps {
  job: CompositeJob;
  onConfigureOverlay: (config: {
    overlayTemplateId: string;
    overlayCopy: Record<string, string>;
    overlayParams?: Record<string, number | string | boolean>;
    trimInFrame?: number;
    trimOutFrame?: number;
  }) => Promise<void>;
  onRenderOverlay: () => Promise<void>;
  onComposite: () => Promise<void>;
  onRetryStage: (stage: PipelineStage) => Promise<void>;
}

type EditorTab = "layers" | "overlay" | "trim";

export function CompositeEditor({
  job,
  onConfigureOverlay,
  onRenderOverlay,
  onComposite,
  onRetryStage,
}: CompositeEditorProps) {
  const shouldReduceMotion = useReducedMotion();
  const [tab, setTab] = useState<EditorTab>("layers");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    job.overlayTemplateId ?? OVERLAY_TEMPLATES[0]?.id ?? "",
  );
  const [overlayCopy, setOverlayCopy] = useState<Record<string, string>>(
    job.overlayCopy,
  );
  const [trimIn, setTrimIn] = useState(job.trimInFrame);
  const [trimOut, setTrimOut] = useState(
    job.trimOutFrame ?? job.durationSec * 30,
  );
  const [working, setWorking] = useState(false);

  const selectedTemplate = OVERLAY_TEMPLATES.find(
    (t) => t.id === selectedTemplateId,
  );
  const failed = job.status === "failed";

  const handleApplyOverlay = useCallback(async () => {
    if (!selectedTemplate) return;
    setWorking(true);
    try {
      await onConfigureOverlay({
        overlayTemplateId: selectedTemplateId,
        overlayCopy,
        trimInFrame: trimIn,
        trimOutFrame: trimOut,
      });
      toast.success("Overlay configured — rendering.");
      await onRenderOverlay();
    } catch {
      toast.error("Failed to apply overlay.");
    } finally {
      setWorking(false);
    }
  }, [
    selectedTemplate,
    selectedTemplateId,
    overlayCopy,
    trimIn,
    trimOut,
    onConfigureOverlay,
    onRenderOverlay,
  ]);

  const handleComposite = useCallback(async () => {
    setWorking(true);
    try {
      await onComposite();
      toast.success("Compositing complete.");
    } catch {
      toast.error("Compositing failed.");
    } finally {
      setWorking(false);
    }
  }, [onComposite]);

  return (
    <div className="space-y-4">
      <CompositeStageTracker
        currentStage={job.pipelineStage}
        failed={failed}
        onRetry={onRetryStage}
      />

      {/* Tab bar */}
      <div className="flex gap-1">
        {(
          [
            { id: "layers" as const, label: "Layers", icon: LayersIcon },
            { id: "overlay" as const, label: "Overlay", icon: SparklesIcon },
            { id: "trim" as const, label: "Trim", icon: ScissorsIcon },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
            style={{
              letterSpacing: "1.5px",
              backgroundColor:
                tab === id ? "var(--color-brand-red)" : "var(--color-neutral-800)",
              color:
                tab === id ? "var(--color-brand-cream)" : "var(--color-neutral-500)",
            }}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === "layers" && (
          <motion.div
            key="layers"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="space-y-3"
          >
            {/* Footage layer */}
            <LayerCard
              label="Footage"
              icon={FilmIcon}
              url={job.footageUrl}
              status={
                job.pipelineStage === "footage"
                  ? "generating"
                  : job.footageUrl
                    ? "ready"
                    : "pending"
              }
            />

            {/* Overlay layer */}
            <LayerCard
              label="Brand Overlay"
              icon={LayersIcon}
              url={job.overlayUrl}
              status={
                job.pipelineStage === "overlay"
                  ? "rendering"
                  : job.overlayUrl
                    ? "ready"
                    : "pending"
              }
            />

            {/* Composite preview */}
            {job.compositeUrl && (
              <div
                className="overflow-hidden rounded-xl"
                style={{ border: "1px solid rgba(253, 245, 230, 0.06)" }}
              >
                <video
                  src={job.compositeUrl}
                  controls
                  className="w-full"
                  style={{ maxHeight: 400 }}
                />
                <div
                  className="px-4 py-2"
                  style={{ backgroundColor: "var(--color-neutral-800)" }}
                >
                  <span
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase"
                    style={{
                      letterSpacing: "1.5px",
                      color: "#7BAE7E",
                    }}
                  >
                    Composite ready
                  </span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {job.footageUrl && !job.overlayUrl && (
                <button
                  type="button"
                  onClick={handleApplyOverlay}
                  disabled={working || !selectedTemplate}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--color-brand-red)",
                    color: "var(--color-brand-cream)",
                  }}
                >
                  <SparklesIcon className="size-3.5" />
                  Apply overlay
                </button>
              )}

              {job.overlayUrl && !job.compositeUrl && (
                <button
                  type="button"
                  onClick={handleComposite}
                  disabled={working}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--color-brand-red)",
                    color: "var(--color-brand-cream)",
                  }}
                >
                  <LayersIcon className="size-3.5" />
                  Composite layers
                </button>
              )}
            </div>
          </motion.div>
        )}

        {tab === "overlay" && (
          <motion.div
            key="overlay"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="space-y-4"
          >
            {/* Template picker */}
            <div>
              <label
                className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase"
                style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
              >
                Overlay template
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {OVERLAY_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(t.id);
                      const newCopy: Record<string, string> = {};
                      for (const slot of t.copySlots) {
                        newCopy[slot] = overlayCopy[slot] ?? "";
                      }
                      setOverlayCopy(newCopy);
                    }}
                    className="rounded-lg p-3 text-left transition-colors"
                    style={{
                      backgroundColor:
                        selectedTemplateId === t.id
                          ? "rgba(178, 40, 72, 0.12)"
                          : "var(--color-neutral-800)",
                      border:
                        selectedTemplateId === t.id
                          ? "1px solid rgba(178, 40, 72, 0.3)"
                          : "1px solid rgba(253, 245, 230, 0.06)",
                    }}
                  >
                    <div
                      className="font-[family-name:var(--font-body)] text-[13px] font-medium"
                      style={{
                        color:
                          selectedTemplateId === t.id
                            ? "var(--color-brand-cream)"
                            : "var(--color-neutral-400)",
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      className="mt-0.5 font-[family-name:var(--font-body)] text-[11px]"
                      style={{ color: "var(--color-neutral-500)" }}
                    >
                      {t.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Copy slots */}
            {selectedTemplate && (
              <div>
                <label
                  className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase"
                  style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
                >
                  Overlay text
                </label>
                <div className="space-y-2">
                  {selectedTemplate.copySlots.map((slot) => (
                    <div key={slot}>
                      <label
                        className="mb-1 block font-[family-name:var(--font-body)] text-[11px] capitalize"
                        style={{ color: "var(--color-neutral-400)" }}
                      >
                        {slot}
                      </label>
                      <input
                        type="text"
                        value={overlayCopy[slot] ?? ""}
                        onChange={(e) =>
                          setOverlayCopy((prev) => ({
                            ...prev,
                            [slot]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[13px] outline-none transition-colors focus:ring-1"
                        style={{
                          backgroundColor: "rgba(253, 245, 230, 0.04)",
                          color: "var(--color-brand-cream)",
                          border: "1px solid rgba(253, 245, 230, 0.08)",
                        }}
                        placeholder={`Enter ${slot}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {tab === "trim" && (
          <motion.div
            key="trim"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="space-y-4"
          >
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                border: "1px solid rgba(253, 245, 230, 0.06)",
              }}
            >
              <label
                className="mb-3 block font-[family-name:var(--font-label)] text-[10px] uppercase"
                style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
              >
                In / Out Points
              </label>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    className="mb-1 block font-[family-name:var(--font-body)] text-[11px]"
                    style={{ color: "var(--color-neutral-400)" }}
                  >
                    In (frame)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={trimOut - 1}
                    value={trimIn}
                    onChange={(e) => setTrimIn(Number(e.target.value))}
                    className="w-full rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[13px] tabular-nums outline-none"
                    style={{
                      backgroundColor: "rgba(253, 245, 230, 0.04)",
                      color: "var(--color-brand-cream)",
                      border: "1px solid rgba(253, 245, 230, 0.08)",
                    }}
                  />
                </div>

                <div className="flex-1">
                  <label
                    className="mb-1 block font-[family-name:var(--font-body)] text-[11px]"
                    style={{ color: "var(--color-neutral-400)" }}
                  >
                    Out (frame)
                  </label>
                  <input
                    type="number"
                    min={trimIn + 1}
                    max={job.durationSec * 30}
                    value={trimOut}
                    onChange={(e) => setTrimOut(Number(e.target.value))}
                    className="w-full rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[13px] tabular-nums outline-none"
                    style={{
                      backgroundColor: "rgba(253, 245, 230, 0.04)",
                      color: "var(--color-brand-cream)",
                      border: "1px solid rgba(253, 245, 230, 0.08)",
                    }}
                  />
                </div>

                <div
                  className="flex-shrink-0 pt-4 font-[family-name:var(--font-body)] text-[11px] tabular-nums"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {((trimOut - trimIn) / 30).toFixed(1)}s
                </div>
              </div>

              {/* Visual trim bar */}
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(253, 245, 230, 0.04)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: "var(--color-brand-orange)",
                    marginLeft: `${(trimIn / (job.durationSec * 30)) * 100}%`,
                    width: `${((trimOut - trimIn) / (job.durationSec * 30)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LayerCard({
  label,
  icon: Icon,
  url,
  status,
}: {
  label: string;
  icon: typeof FilmIcon;
  url: string | null;
  status: "pending" | "generating" | "rendering" | "ready";
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{
        backgroundColor: "var(--color-neutral-800)",
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      <div
        className="flex size-10 items-center justify-center rounded-lg"
        style={{
          backgroundColor:
            status === "ready"
              ? "rgba(123, 174, 126, 0.1)"
              : status === "generating" || status === "rendering"
                ? "rgba(242, 140, 82, 0.1)"
                : "rgba(253, 245, 230, 0.04)",
        }}
      >
        <Icon
          className="size-4"
          style={{
            color:
              status === "ready"
                ? "#7BAE7E"
                : status === "generating" || status === "rendering"
                  ? "var(--color-brand-orange)"
                  : "var(--color-neutral-500)",
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="font-[family-name:var(--font-body)] text-[13px] font-medium"
          style={{ color: "var(--color-brand-cream)" }}
        >
          {label}
        </div>
        <div
          className="font-[family-name:var(--font-body)] text-[11px]"
          style={{
            color:
              status === "ready"
                ? "#7BAE7E"
                : status === "generating" || status === "rendering"
                  ? "var(--color-brand-orange)"
                  : "var(--color-neutral-500)",
          }}
        >
          {status === "pending" && "Waiting"}
          {status === "generating" && "Generating footage..."}
          {status === "rendering" && "Rendering overlay..."}
          {status === "ready" && "Ready"}
        </div>
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-2.5 py-1 font-[family-name:var(--font-body)] text-[11px] transition-colors"
          style={{
            backgroundColor: "rgba(253, 245, 230, 0.06)",
            color: "var(--color-neutral-400)",
          }}
        >
          Preview
        </a>
      )}
    </div>
  );
}

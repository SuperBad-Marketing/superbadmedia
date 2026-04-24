"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { SparklesIcon, VideoIcon, SendIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { VideoBrief } from "@/lib/video/brief-builder";
import type { VideoType } from "@/lib/db/schema/video-jobs";
import { analyseBriefAction, createVideoJobAction } from "../actions";

const VIDEO_TYPE_LABELS: Record<VideoType, { label: string; description: string }> = {
  cinematic: { label: "Cinematic", description: "Brand films, mood pieces, hero content" },
  motion_design: { label: "Motion Design", description: "Animated graphics, kinetic typography" },
  product_showcase: { label: "Product Showcase", description: "Product reveals, demos" },
  social_short: { label: "Social Short", description: "Vertical, punchy, platform-native" },
  talking_head: { label: "Talking Head", description: "Presenter-style, explainer content" },
};

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5"];
const PACING_OPTIONS = ["slow", "medium", "fast", "dynamic"];

type BrandSource = "superbad" | "client" | "adhoc";

export function VideoCreateForm({ onCreated }: { onCreated: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [brandSource, setBrandSource] = useState<BrandSource>("superbad");
  const [analysing, setAnalysing] = useState(false);
  const [brief, setBrief] = useState<VideoBrief | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAnalyse() {
    if (!prompt.trim()) return;
    setAnalysing(true);
    const res = await analyseBriefAction(prompt.trim(), brandSource);
    setAnalysing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setBrief(res.brief);
  }

  async function handleGenerate() {
    if (!brief) return;
    setSubmitting(true);
    const res = await createVideoJobAction({
      initialPrompt: prompt,
      brief,
      brandSource,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Video queued for generation.");
    setPrompt("");
    setBrief(null);
    onCreated();
  }

  function updateBrief(patch: Partial<VideoBrief>) {
    if (!brief) return;
    setBrief({ ...brief, ...patch });
  }

  return (
    <div className="space-y-6">
      {/* Prompt input */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              For
            </span>
            <select
              value={brandSource}
              onChange={(e) => setBrandSource(e.target.value as BrandSource)}
              className="rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] focus:border-[color:var(--color-brand-pink)] focus:outline-none"
            >
              <option value="superbad">SuperBad</option>
              <option value="client">Client (from CRM)</option>
              <option value="adhoc">New (upload brand pack)</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (brief) setBrief(null);
            }}
            placeholder="Describe the video you want to create…"
            rows={3}
            className="w-full resize-none rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-4 py-3 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] focus:border-[color:var(--color-brand-pink)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAnalyse}
            disabled={!prompt.trim() || analysing}
            className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-all"
            style={{
              backgroundColor: "var(--color-brand-pink)",
              color: "var(--color-neutral-900)",
              opacity: !prompt.trim() || analysing ? 0.4 : 1,
            }}
          >
            <SparklesIcon className="h-3 w-3" />
            {analysing ? "Analysing…" : "Build brief"}
          </button>
        </div>
      </div>

      {/* Brief form — appears after analysis */}
      <AnimatePresence>
        {brief && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={houseSpring}
            className="space-y-5 rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] p-5"
          >
            <div className="flex items-center justify-between">
              <span
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Video brief
              </span>
              <span
                className="rounded-md px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px]"
                style={{
                  backgroundColor:
                    brief.engine === "remotion"
                      ? "rgba(253, 245, 230, 0.08)"
                      : "rgba(204, 43, 94, 0.15)",
                  color:
                    brief.engine === "remotion"
                      ? "var(--color-brand-cream)"
                      : "var(--color-brand-pink)",
                }}
              >
                {brief.engine === "remotion" ? "Template" : "AI Generate"}
              </span>
            </div>

            {/* Video type selector */}
            <div className="space-y-2">
              <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Type
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.entries(VIDEO_TYPE_LABELS) as [VideoType, { label: string; description: string }][]).map(
                  ([key, { label, description }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateBrief({ videoType: key })}
                      className={
                        "rounded-lg border p-3 text-left transition-all " +
                        (brief.videoType === key
                          ? "border-[color:var(--color-brand-pink)] bg-[color:var(--color-brand-pink)]/5"
                          : "border-[color:var(--color-neutral-700)] hover:border-[color:var(--color-neutral-600)]")
                      }
                    >
                      <div className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                        {label}
                      </div>
                      <div className="mt-0.5 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                        {description}
                      </div>
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Resolved prompt */}
            <div className="space-y-2">
              <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                Generation prompt
              </span>
              <textarea
                value={brief.resolvedPrompt}
                onChange={(e) => updateBrief({ resolvedPrompt: e.target.value })}
                rows={4}
                className="w-full resize-y rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] focus:border-[color:var(--color-brand-pink)] focus:outline-none"
              />
            </div>

            {/* Controls row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <BriefField label="Aspect ratio">
                <select
                  value={brief.aspectRatio}
                  onChange={(e) => updateBrief({ aspectRatio: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] focus:outline-none"
                >
                  {ASPECT_RATIOS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </BriefField>

              <BriefField label="Duration (sec)">
                <input
                  type="number"
                  value={brief.duration}
                  onChange={(e) => updateBrief({ duration: parseInt(e.target.value) || 5 })}
                  min={2}
                  max={30}
                  className="w-full rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3 py-2 font-[family-name:var(--font-body)] font-mono text-[13px] text-[color:var(--color-brand-cream)] focus:outline-none"
                />
              </BriefField>

              <BriefField label="Mood">
                <input
                  type="text"
                  value={brief.mood}
                  onChange={(e) => updateBrief({ mood: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] focus:outline-none"
                />
              </BriefField>

              <BriefField label="Pacing">
                <select
                  value={brief.pacing}
                  onChange={(e) => updateBrief({ pacing: e.target.value })}
                  className="w-full rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] focus:outline-none"
                >
                  {PACING_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </BriefField>
            </div>

            {/* Colour palette */}
            <BriefField label="Colour palette">
              <input
                type="text"
                value={brief.colorPalette}
                onChange={(e) => updateBrief({ colorPalette: e.target.value })}
                className="w-full rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] focus:outline-none"
              />
            </BriefField>

            {/* Generate button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setBrief(null)}
                className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-neutral-300)]"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg px-5 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium transition-all"
                style={{
                  backgroundColor: "var(--color-brand-red)",
                  color: "var(--color-brand-cream)",
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting ? (
                  "Submitting…"
                ) : (
                  <>
                    <SendIcon className="h-4 w-4" />
                    Generate video
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BriefField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
        {label}
      </span>
      {children}
    </div>
  );
}

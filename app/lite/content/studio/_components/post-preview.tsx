"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ASPECT_RATIOS,
  type AspectRatio,
} from "@/lib/db/schema/content-studio";
import {
  getTemplate,
  getTemplatesForType,
  getDimensions,
} from "@/lib/content-studio/templates";
import type { ActivePost } from "./studio-client";

const RATIO_LABELS: Record<AspectRatio, string> = {
  portrait: "Portrait 9:16",
  square: "Square 1:1",
  landscape: "Landscape 2:1",
  portrait_3x4: "Portrait 3:4",
  portrait_4x5: "Tall Portrait 4:5",
  landscape_16x9: "Landscape 16:9",
};

const PLATFORM_OPTIONS = [
  "Instagram Feed",
  "Instagram Story",
  "Instagram Reel Cover",
  "Facebook Post",
  "Facebook Story",
  "LinkedIn Post",
  "TikTok",
  "X (Twitter)",
] as const;

interface PostPreviewProps {
  post: ActivePost;
  onCorrect: (correction: string, slideIndex?: number) => Promise<void>;
  onRender: (
    ratios: AspectRatio[],
    platforms: string,
  ) => Promise<{ id: string; slideIndex: number; ratio: AspectRatio; url: string }[] | undefined>;
  onChangeTemplate: (templateId: string) => Promise<void>;
  onNewPost: () => void;
}

export function PostPreview({
  post,
  onCorrect,
  onRender,
  onChangeTemplate,
  onNewPost,
}: PostPreviewProps) {
  const isCarousel = post.slides.length > 1;
  const [activeSlide, setActiveSlide] = useState(0);
  const [previewRatio, setPreviewRatio] = useState<AspectRatio>("portrait");
  const [correction, setCorrection] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [correctionScope, setCorrectionScope] = useState<"slide" | "all">("slide");
  const [selectedRatios, setSelectedRatios] = useState<Set<AspectRatio>>(
    new Set(["portrait", "square", "landscape"]),
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(["Instagram Feed"]),
  );
  const [rendering, setRendering] = useState(false);
  const [renders, setRenders] = useState<
    { id: string; slideIndex: number; ratio: AspectRatio; url: string }[]
  >([]);
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);

  const currentCopy = post.slides[activeSlide] ?? {};

  const template = useMemo(
    () => getTemplate(post.templateId),
    [post.templateId],
  );

  const previewHtml = useMemo(() => {
    if (!template) return "";
    return template.renderHtml(currentCopy, previewRatio);
  }, [template, currentCopy, previewRatio]);

  const { width: nativeW, height: nativeH } = getDimensions(previewRatio);

  const alternateTemplates = useMemo(
    () =>
      getTemplatesForType(post.contentType).filter(
        (t) => t.id !== post.templateId,
      ),
    [post.contentType, post.templateId],
  );

  async function handleCorrect() {
    if (!correction.trim()) return;
    setCorrecting(true);
    const slideIdx = correctionScope === "slide" ? activeSlide : undefined;
    await onCorrect(correction.trim(), slideIdx);
    setCorrection("");
    setCorrecting(false);
  }

  async function handleRender() {
    if (selectedRatios.size === 0) {
      toast.error("Select at least one aspect ratio.");
      return;
    }
    setRendering(true);
    const result = await onRender(
      Array.from(selectedRatios),
      Array.from(selectedPlatforms).join(", "),
    );
    setRendering(false);
    if (result) setRenders(result);
  }

  function toggleRatio(ratio: AspectRatio) {
    setSelectedRatios((prev) => {
      const next = new Set(prev);
      if (next.has(ratio)) next.delete(ratio);
      else next.add(ratio);
      return next;
    });
  }

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  const maxPreviewH = previewRatio === "portrait" ? 480 : previewRatio === "square" ? 360 : 260;
  const scale = Math.min(1, maxPreviewH / nativeH, 360 / nativeW);

  const totalRenderCount = isCarousel
    ? post.slides.length * selectedRatios.size
    : selectedRatios.size;

  return (
    <div className="space-y-8">
      {/* Slide navigator */}
      {isCarousel && (
        <div>
          <span
            className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Slide {activeSlide + 1} of {post.slides.length}
          </span>
          <div className="flex items-center gap-1.5">
            {post.slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveSlide(i)}
                className="flex h-8 w-8 items-center justify-center rounded-md font-[family-name:var(--font-body)] text-[13px] font-medium transition-all"
                style={{
                  backgroundColor:
                    activeSlide === i
                      ? "var(--color-brand-red)"
                      : "var(--color-neutral-800)",
                  color: "var(--color-brand-cream)",
                  border:
                    activeSlide === i
                      ? "1px solid var(--color-brand-red)"
                      : "1px solid rgba(253, 245, 230, 0.08)",
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live preview */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setPreviewRatio(r)}
              className="rounded-md px-3 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
              style={{
                letterSpacing: "1.5px",
                backgroundColor:
                  previewRatio === r
                    ? "var(--color-brand-red)"
                    : "var(--color-neutral-800)",
                color: "var(--color-brand-cream)",
              }}
            >
              {RATIO_LABELS[r]}
            </button>
          ))}
        </div>

        <div
          className="relative overflow-hidden rounded-lg"
          style={{
            width: nativeW * scale,
            height: nativeH * scale,
            border: "1px solid rgba(253, 245, 230, 0.08)",
          }}
        >
          <iframe
            srcDoc={previewHtml}
            title="Preview"
            className="pointer-events-none"
            style={{
              width: nativeW,
              height: nativeH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: "none",
            }}
          />
        </div>

        {template && (
          <div className="mt-2 flex items-center gap-3">
            <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
              Template: {template.name}
            </span>
            {alternateTemplates.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTemplateDrawer(!showTemplateDrawer)}
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-pink)] transition-opacity hover:opacity-70"
                style={{ letterSpacing: "1px" }}
              >
                {showTemplateDrawer ? "Close" : "Try different layout"}
              </button>
            )}
          </div>
        )}

        {showTemplateDrawer && (
          <div
            className="mt-3 flex flex-wrap gap-2 rounded-lg p-3"
            style={{
              backgroundColor: "var(--color-neutral-800)",
              border: "1px solid rgba(253, 245, 230, 0.06)",
            }}
          >
            {alternateTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={async () => {
                  await onChangeTemplate(t.id);
                  setShowTemplateDrawer(false);
                }}
                className="rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] transition-colors hover:opacity-80"
                style={{
                  backgroundColor: "var(--color-neutral-700)",
                  color: "var(--color-brand-cream)",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Copy slots for active slide */}
      <div>
        <span
          className="mb-3 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {isCarousel ? `Slide ${activeSlide + 1} copy` : "Generated copy"}
        </span>
        <div className="space-y-2">
          {Object.entries(currentCopy).map(([slot, value]) => (
            <div
              key={slot}
              className="flex items-start gap-3 rounded-md p-3"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                border: "1px solid rgba(253, 245, 230, 0.06)",
              }}
            >
              <span
                className="mt-0.5 shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-pink)]"
                style={{ letterSpacing: "1px", minWidth: 72 }}
              >
                {slot}
              </span>
              <span className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Correction */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Corrections
          </span>
          {isCarousel && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCorrectionScope("slide")}
                className="rounded px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase transition-colors"
                style={{
                  letterSpacing: "1px",
                  backgroundColor:
                    correctionScope === "slide"
                      ? "rgba(178, 40, 72, 0.25)"
                      : "transparent",
                  color:
                    correctionScope === "slide"
                      ? "var(--color-brand-pink)"
                      : "var(--color-neutral-500)",
                }}
              >
                This slide
              </button>
              <button
                type="button"
                onClick={() => setCorrectionScope("all")}
                className="rounded px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase transition-colors"
                style={{
                  letterSpacing: "1px",
                  backgroundColor:
                    correctionScope === "all"
                      ? "rgba(178, 40, 72, 0.25)"
                      : "transparent",
                  color:
                    correctionScope === "all"
                      ? "var(--color-brand-pink)"
                      : "var(--color-neutral-500)",
                }}
              >
                All slides
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !correcting) handleCorrect();
            }}
            placeholder={
              isCarousel && correctionScope === "slide"
                ? `e.g. slide ${activeSlide + 1} headline is too long`
                : "e.g. headline is too long, make it punchier"
            }
            className="flex-1 rounded-lg border px-4 py-2.5 font-[family-name:var(--font-body)] text-[14px] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none"
            style={{
              backgroundColor: "var(--color-neutral-800)",
              color: "var(--color-brand-cream)",
              borderColor: "rgba(253, 245, 230, 0.08)",
            }}
          />
          <button
            type="button"
            onClick={handleCorrect}
            disabled={correcting || !correction.trim()}
            className="shrink-0 rounded-lg px-5 py-2.5 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity"
            style={{
              backgroundColor: "var(--color-neutral-700)",
              color: "var(--color-brand-cream)",
              opacity: correcting || !correction.trim() ? 0.5 : 1,
            }}
          >
            {correcting ? "Fixing…" : "Fix"}
          </button>
        </div>
      </div>

      {/* Render options */}
      <div
        className="rounded-lg p-5"
        style={{
          backgroundColor: "var(--color-neutral-800)",
          border: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      >
        <span
          className="mb-4 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Render & export
        </span>

        <div className="mb-4">
          <span className="mb-2 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
            Aspect ratios
          </span>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRatio(r)}
                className="rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] transition-all"
                style={{
                  backgroundColor: selectedRatios.has(r)
                    ? "var(--color-brand-red)"
                    : "var(--color-neutral-700)",
                  color: "var(--color-brand-cream)",
                  border: selectedRatios.has(r)
                    ? "1px solid var(--color-brand-red)"
                    : "1px solid rgba(253, 245, 230, 0.08)",
                }}
              >
                {RATIO_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <span className="mb-2 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
            Platforms
          </span>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className="rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[12px] transition-all"
                style={{
                  backgroundColor: selectedPlatforms.has(p)
                    ? "rgba(178, 40, 72, 0.25)"
                    : "var(--color-neutral-700)",
                  color: selectedPlatforms.has(p)
                    ? "var(--color-brand-pink)"
                    : "var(--color-brand-cream)",
                  border: selectedPlatforms.has(p)
                    ? "1px solid rgba(178, 40, 72, 0.4)"
                    : "1px solid rgba(253, 245, 230, 0.06)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRender}
          disabled={rendering || selectedRatios.size === 0}
          className="rounded-lg px-6 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium transition-opacity"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
            opacity: rendering || selectedRatios.size === 0 ? 0.5 : 1,
          }}
        >
          {rendering
            ? "Rendering…"
            : `Render ${totalRenderCount} image${totalRenderCount === 1 ? "" : "s"}`}
        </button>
      </div>

      {/* Rendered outputs */}
      {renders.length > 0 && (
        <div>
          <span
            className="mb-3 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Rendered{isCarousel ? ` — ${post.slides.length} slides × ${selectedRatios.size} ratio${selectedRatios.size === 1 ? "" : "s"}` : ""}
          </span>

          {isCarousel ? (
            Array.from(new Set(renders.map((r) => r.slideIndex)))
              .sort((a, b) => a - b)
              .map((si) => (
                <div key={si} className="mb-6">
                  <span
                    className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)]"
                    style={{ letterSpacing: "1px" }}
                  >
                    Slide {si + 1}
                  </span>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {renders
                      .filter((r) => r.slideIndex === si && r.url)
                      .map((r) => (
                        <RenderCard key={r.id} r={r} />
                      ))}
                  </div>
                </div>
              ))
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {renders
                .filter((r) => r.url)
                .map((r) => (
                  <RenderCard key={r.id} r={r} />
                ))}
            </div>
          )}
        </div>
      )}

      {/* New post */}
      <div className="pt-4">
        <button
          type="button"
          onClick={onNewPost}
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          + New post
        </button>
      </div>
    </div>
  );
}

function RenderCard({ r }: { r: { id: string; ratio: AspectRatio; url: string } }) {
  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      <img
        src={r.url}
        alt={`${r.ratio} render`}
        className="w-full"
      />
      <div
        className="flex items-center justify-between p-2"
        style={{ backgroundColor: "var(--color-neutral-800)" }}
      >
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1px" }}
        >
          {RATIO_LABELS[r.ratio]}
        </span>
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-pink)] hover:opacity-70"
          style={{ letterSpacing: "1px" }}
        >
          Open
        </a>
      </div>
    </div>
  );
}

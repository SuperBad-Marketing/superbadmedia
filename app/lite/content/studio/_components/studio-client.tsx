"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CONTENT_TYPES, type ContentType, type AspectRatio } from "@/lib/db/schema/content-studio";
import type { SlideCopy } from "@/lib/content-studio/generate-copy";
import {
  ALL_MOTION_TEMPLATES,
  getPairedMotionTemplates,
  getMotionOnlyTemplates,
  getMotionTemplatesForStatic,
} from "@/lib/content-studio/motion/registry";
import { getTemplatesForType } from "@/lib/content-studio/templates";
import type { MotionAspectRatio } from "@/lib/content-studio/motion/types";
import {
  createPostAction,
  correctCopyAction,
  renderPostAction,
  changeTemplateAction,
  createMotionPostAction,
  updateMotionPostAction,
} from "../actions";
import { PostPreview } from "./post-preview";
import { PostHistory } from "./post-history";
import { MotionPreview, type MotionPostData } from "./motion-preview";
import { InspirationPanel } from "./inspiration-panel";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  announcement: "Announcement",
  anti_motivation: "Anti-Motivation",
  portfolio: "Portfolio",
  tips: "Tips & Value",
  testimonial: "Testimonial",
  behind_the_scenes: "Behind the Scenes",
};

const SLIDE_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10] as const;

type StudioView = "create" | "preview" | "history";

export interface ActivePost {
  id: string;
  templateId: string;
  slides: SlideCopy[];
  contentType: ContentType;
  brief: string;
}

export function StudioClient() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<StudioView>("create");
  const [brief, setBrief] = useState(() => searchParams.get("prefill_brief") ?? "");
  const [contentType, setContentType] = useState<ContentType>(() => {
    const prefill = searchParams.get("prefill_type");
    if (prefill && CONTENT_TYPES.includes(prefill as ContentType)) {
      return prefill as ContentType;
    }
    return "announcement";
  });
  const [slideCount, setSlideCount] = useState(1);
  const [prefilled] = useState(
    () => !!(searchParams.get("prefill_brief") || searchParams.get("prefill_type")),
  );
  const [generating, setGenerating] = useState(false);
  const [activePost, setActivePost] = useState<ActivePost | null>(null);

  // Motion state
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [selectedMotionTemplate, setSelectedMotionTemplate] = useState<string | null>(null);
  const [motionPost, setMotionPost] = useState<MotionPostData | null>(null);
  const [inspirationRefs, setInspirationRefs] = useState<
    { id: string; source_type: "link" | "upload"; source_url: string; thumbnail_url: string | null; title: string | null; description: string | null }[]
  >([]);

  const handleCreate = useCallback(async () => {
    if (!brief.trim()) {
      toast.error("Enter a brief first.");
      return;
    }
    setGenerating(true);

    if (motionEnabled) {
      const templateId = selectedMotionTemplate ?? ALL_MOTION_TEMPLATES[0]?.id;
      if (!templateId) {
        toast.error("No motion template available.");
        setGenerating(false);
        return;
      }

      const result = await createMotionPostAction({
        brief: brief.trim(),
        contentType,
        motionTemplateId: templateId,
        slideCount,
      });
      setGenerating(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMotionPost({
        id: result.postId,
        motionTemplateId: result.motionTemplateId,
        slides: result.slides,
        brief: brief.trim(),
        paletteId: result.paletteId,
        animationParams: result.animationParams,
        primaryAspectRatio: result.primaryAspectRatio as MotionAspectRatio,
      });
      setView("preview");
      toast.success("Motion post generated.");
      return;
    }

    const result = await createPostAction({
      brief: brief.trim(),
      contentType,
      slideCount,
    });
    setGenerating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setActivePost({
      id: result.postId,
      templateId: result.templateId,
      slides: result.slides,
      contentType,
      brief: brief.trim(),
    });
    setMotionPost(null);
    setView("preview");
    toast.success(
      result.slideCount > 1
        ? `${result.slideCount}-slide carousel generated.`
        : "Copy generated.",
    );
  }, [brief, contentType, slideCount, motionEnabled, selectedMotionTemplate]);

  const handleCorrect = useCallback(
    async (correction: string, slideIndex?: number) => {
      if (!activePost) return;
      const result = await correctCopyAction({
        postId: activePost.id,
        correction,
        slideIndex,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActivePost((prev) => (prev ? { ...prev, slides: result.slides } : null));
      toast.success("Copy updated.");
    },
    [activePost],
  );

  const handleRender = useCallback(
    async (ratios: AspectRatio[], platforms: string) => {
      if (!activePost) return;
      const result = await renderPostAction({
        postId: activePost.id,
        ratios,
        platforms,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.renders.length} render${result.renders.length === 1 ? "" : "s"} complete.`);
      return result.renders;
    },
    [activePost],
  );

  const handleChangeTemplate = useCallback(
    async (templateId: string) => {
      if (!activePost) return;
      const result = await changeTemplateAction({
        postId: activePost.id,
        templateId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActivePost((prev) => (prev ? { ...prev, templateId } : null));
      toast.success("Template changed.");
    },
    [activePost],
  );

  // Motion editor callbacks
  const handleMotionCopyChange = useCallback(
    (slides: SlideCopy[]) => {
      if (!motionPost) return;
      setMotionPost((prev) => (prev ? { ...prev, slides } : null));
      updateMotionPostAction({ postId: motionPost.id, slides });
    },
    [motionPost],
  );

  const handleMotionPaletteChange = useCallback(
    (paletteId: string) => {
      if (!motionPost) return;
      setMotionPost((prev) => (prev ? { ...prev, paletteId } : null));
      updateMotionPostAction({ postId: motionPost.id, paletteId });
    },
    [motionPost],
  );

  const handleMotionAspectRatioChange = useCallback(
    (ratio: MotionAspectRatio) => {
      if (!motionPost) return;
      setMotionPost((prev) =>
        prev ? { ...prev, primaryAspectRatio: ratio } : null,
      );
      updateMotionPostAction({
        postId: motionPost.id,
        primaryAspectRatio: ratio,
      });
    },
    [motionPost],
  );

  const handleNewPost = useCallback(() => {
    setBrief("");
    setSlideCount(1);
    setActivePost(null);
    setMotionPost(null);
    setView("create");
  }, []);

  const hasActivePreview = activePost || motionPost;

  // Available motion templates for current content type
  const staticTemplates = getTemplatesForType(contentType);
  const pairedForType = staticTemplates.flatMap((st) =>
    getMotionTemplatesForStatic(st.id),
  );
  const motionOnly = getMotionOnlyTemplates();
  const availableMotionTemplates = [...pairedForType, ...motionOnly];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Content{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Content Studio
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Content Studio
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Describe what you want, pick the vibe, hit generate.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            brand-perfect every time.
          </em>
        </p>
      </header>

      <div className="mt-4 flex items-center gap-2 px-4">
        <button
          type="button"
          onClick={() => setView("create")}
          className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
          style={{
            letterSpacing: "1.5px",
            backgroundColor:
              view === "create"
                ? "var(--color-brand-red)"
                : "var(--color-neutral-800)",
            color: "var(--color-brand-cream)",
          }}
        >
          Create
        </button>
        {hasActivePreview && (
          <button
            type="button"
            onClick={() => setView("preview")}
            className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
            style={{
              letterSpacing: "1.5px",
              backgroundColor:
                view === "preview"
                  ? "var(--color-brand-red)"
                  : "var(--color-neutral-800)",
              color: "var(--color-brand-cream)",
            }}
          >
            Preview
          </button>
        )}
        <button
          type="button"
          onClick={() => setView("history")}
          className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
          style={{
            letterSpacing: "1.5px",
            backgroundColor:
              view === "history"
                ? "var(--color-brand-red)"
                : "var(--color-neutral-800)",
            color: "var(--color-brand-cream)",
          }}
        >
          History
        </button>
      </div>

      <div className="mt-6 px-4">
        {view === "create" && (
          <div className="space-y-6">
            {/* Motion toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMotionEnabled(!motionEnabled)}
                className="relative h-7 w-12 rounded-full transition-colors"
                style={{
                  backgroundColor: motionEnabled
                    ? "var(--color-brand-red)"
                    : "var(--color-neutral-800)",
                  border: "1px solid rgba(253, 245, 230, 0.12)",
                }}
              >
                <div
                  className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                  style={{
                    left: motionEnabled ? 22 : 3,
                    backgroundColor: "var(--color-brand-cream)",
                  }}
                />
              </button>
              <span
                className="font-[family-name:var(--font-label)] text-[11px] uppercase"
                style={{
                  letterSpacing: "1.5px",
                  color: motionEnabled
                    ? "var(--color-brand-cream)"
                    : "var(--color-neutral-500)",
                }}
              >
                Motion
              </span>
            </div>

            <div>
              <label
                className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Content type
              </label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => {
                      setContentType(ct);
                      setSelectedMotionTemplate(null);
                    }}
                    className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] transition-all"
                    style={{
                      backgroundColor:
                        contentType === ct
                          ? "var(--color-brand-red)"
                          : "var(--color-neutral-800)",
                      color: "var(--color-brand-cream)",
                      border:
                        contentType === ct
                          ? "1px solid var(--color-brand-red)"
                          : "1px solid rgba(253, 245, 230, 0.08)",
                    }}
                  >
                    {CONTENT_TYPE_LABELS[ct]}
                  </button>
                ))}
              </div>
            </div>

            {/* Slide count selector — always visible */}
            <div>
              <label
                className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Slides
              </label>
              <div className="flex items-center gap-2">
                {SLIDE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSlideCount(n)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg font-[family-name:var(--font-body)] text-[13px] font-medium transition-all"
                    style={{
                      backgroundColor:
                        slideCount === n
                          ? "var(--color-brand-red)"
                          : "var(--color-neutral-800)",
                      color: "var(--color-brand-cream)",
                      border:
                        slideCount === n
                          ? "1px solid var(--color-brand-red)"
                          : "1px solid rgba(253, 245, 230, 0.08)",
                    }}
                  >
                    {n}
                  </button>
                ))}
                <span className="ml-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                  {slideCount === 1 ? "Single post" : `${slideCount}-slide carousel`}
                </span>
              </div>
            </div>

            {/* Motion template selector — shown when motion is on */}
            {motionEnabled && (
              <div>
                <label
                  className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Motion template
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableMotionTemplates.map((mt) => (
                    <button
                      key={mt.id}
                      type="button"
                      onClick={() => setSelectedMotionTemplate(mt.id)}
                      className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] transition-all"
                      style={{
                        backgroundColor:
                          selectedMotionTemplate === mt.id
                            ? "var(--color-brand-red)"
                            : "var(--color-neutral-800)",
                        color: "var(--color-brand-cream)",
                        border:
                          selectedMotionTemplate === mt.id
                            ? "1px solid var(--color-brand-red)"
                            : "1px solid rgba(253, 245, 230, 0.08)",
                      }}
                    >
                      {mt.name}
                      {mt.overlayCapable && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 9,
                            opacity: 0.5,
                            verticalAlign: "super",
                          }}
                        >
                          overlay
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {prefilled && brief && (
              <div
                className="mb-3 rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-cream)]"
                style={{ background: "rgba(244, 160, 176, 0.10)" }}
              >
                Pre-filled from Instagram plan — review and generate when ready.
              </div>
            )}

            <div>
              <label
                className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Brief
              </label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={
                  motionEnabled
                    ? "e.g. We hit 500 clients this month. Big number, count it up. Dark and dramatic."
                    : slideCount > 1
                      ? "e.g. 5-slide carousel breaking down our content creation process. Each slide builds on the last."
                      : "e.g. Announce our new pricing tiers. Punchy, confident, a bit cheeky."
                }
                rows={4}
                className="w-full resize-y rounded-lg border px-4 py-3 font-[family-name:var(--font-body)] text-[14px] leading-[1.6] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none"
                style={{
                  backgroundColor: "var(--color-neutral-800)",
                  color: "var(--color-brand-cream)",
                  borderColor: "rgba(253, 245, 230, 0.08)",
                }}
              />
            </div>

            <InspirationPanel
              attached={inspirationRefs}
              onAttach={(ref) => setInspirationRefs((prev) => [...prev, ref])}
              onDetach={(id) =>
                setInspirationRefs((prev) => prev.filter((r) => r.id !== id))
              }
            />

            <button
              type="button"
              onClick={handleCreate}
              disabled={generating || !brief.trim()}
              className="rounded-lg px-6 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium transition-opacity"
              style={{
                backgroundColor: "var(--color-brand-red)",
                color: "var(--color-brand-cream)",
                opacity: generating || !brief.trim() ? 0.5 : 1,
              }}
            >
              {generating
                ? "Generating…"
                : motionEnabled
                  ? "Generate motion"
                  : slideCount > 1
                    ? `Generate ${slideCount} slides`
                    : "Generate"}
            </button>
          </div>
        )}

        {view === "preview" && motionPost && (
          <MotionPreview
            post={motionPost}
            onCopyChange={handleMotionCopyChange}
            onPaletteChange={handleMotionPaletteChange}
            onAspectRatioChange={handleMotionAspectRatioChange}
            onNewPost={handleNewPost}
          />
        )}

        {view === "preview" && activePost && !motionPost && (
          <PostPreview
            post={activePost}
            onCorrect={handleCorrect}
            onRender={handleRender}
            onChangeTemplate={handleChangeTemplate}
            onNewPost={handleNewPost}
          />
        )}

        {view === "history" && <PostHistory />}
      </div>
    </div>
  );
}

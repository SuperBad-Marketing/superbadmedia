"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PlusIcon, HistoryIcon, EyeIcon } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { CONTENT_TYPES, type ContentType, type AspectRatio } from "@/lib/db/schema/content-studio";
import type { SlideCopy } from "@/lib/content-studio/generate-copy";
import type { CustomPaletteInput, SfxCueData } from "@/lib/content-studio/motion/types";
import type { MotionLayoutConfig } from "@/lib/content-studio/motion/layouts";
import {
  ALL_MOTION_TEMPLATES,
  getMotionOnlyTemplates,
  getMotionTemplatesForStatic,
} from "@/lib/content-studio/motion/registry";
import { getTemplatesForType } from "@/lib/content-studio/templates";
import type { MotionAspectRatio } from "@/lib/content-studio/motion/types";
import type { ContentFormat } from "@/lib/content-studio/brief-parser";
import {
  createPostAction,
  correctCopyAction,
  renderPostAction,
  changeTemplateAction,
  createMotionPostAction,
  updateMotionPostAction,
  updateStaticPostAction,
  promoteToMotionAction,
  getClientNamesAction,
  createVideoFromStudioAction,
} from "../actions";
import { UnifiedBrief, type UnifiedBriefResult } from "./unified-brief";
import { PostPreview } from "./post-preview";
import { PostHistory } from "./post-history";
import { MotionPreview, type MotionPostData } from "./motion-preview";
import { WipSection, type WipProject } from "./wip-section";
import { GenerationProgress } from "./generation-progress";

const FORMAT_MAP: Record<ContentType, ContentFormat> = {
  anti_motivation: "animated",
  portfolio: "composite",
  testimonial: "animated",
  behind_the_scenes: "composite",
  tips: "static",
  announcement: "animated",
};

type StudioView = "create" | "preview" | "history";

export interface ActivePost {
  id: string;
  templateId: string;
  slides: SlideCopy[];
  contentType: ContentType;
  brief: string;
}

export function StudioClientUnified() {
  const shouldReduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const [view, setView] = useState<StudioView>("create");

  // Smart brief state
  const [briefResult, setBriefResult] = useState<UnifiedBriefResult | null>(null);
  const [knownClients, setKnownClients] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);

  // Active post state (shared with preview/edit)
  const [activePost, setActivePost] = useState<ActivePost | null>(null);
  const [motionPost, setMotionPost] = useState<MotionPostData | null>(null);
  const [fontPairingId, setFontPairingId] = useState<string | null>(null);
  const [staticPaletteId, setStaticPaletteId] = useState<string | null>(null);
  const [customPalette, setCustomPalette] = useState<CustomPaletteInput | null>(null);

  // Video state
  const [activeVideoJobId, setActiveVideoJobId] = useState<string | null>(null);

  // WIP projects (in-memory for now; persisted to DB in Wave 2)
  const [wipProjects] = useState<WipProject[]>([]);

  // Load client names on mount
  useEffect(() => {
    getClientNamesAction().then((res) => {
      if (res.ok) setKnownClients(res.clients);
    });
  }, []);

  // Determine the effective format for generation routing
  const getEffectiveFormat = useCallback(
    (result: UnifiedBriefResult): ContentFormat => {
      if (result.overrides.format) return result.overrides.format;
      if (result.parsed.format !== "static") return result.parsed.format;

      const ct = result.overrides.contentType ?? result.parsed.contentType;
      if (ct && FORMAT_MAP[ct]) return FORMAT_MAP[ct];

      return result.parsed.format;
    },
    [],
  );

  const handleGenerate = useCallback(
    async (result: UnifiedBriefResult) => {
      if (generating) return;
      setGenerating(true);
      setGenerationFailed(false);

      const format = getEffectiveFormat(result);
      const contentType =
        result.overrides.contentType ?? result.parsed.contentType ?? "announcement";
      const slideCount = result.parsed.wantsCarousel
        ? result.parsed.suggestedSlideCount
        : 1;

      try {
        if (format === "cinematic" || format === "composite") {
          // Route to Higgsfield via video pipeline
          const res = await createVideoFromStudioAction({
            brief: result.raw,
            format,
            brandSource: result.parsed.clientName ? "client" : "superbad",
          });

          if (!res.ok) {
            toast.error(res.error);
            setGenerationFailed(true);
            return;
          }

          setActiveVideoJobId(res.jobId);
          toast.success("Video queued — generating footage.");
          setView("preview");
          return;
        }

        if (format === "animated") {
          // Route to Remotion motion
          const templates = getTemplatesForType(contentType);
          const pairedTemplates = templates.flatMap((st) =>
            getMotionTemplatesForStatic(st.id),
          );
          const motionOnly = getMotionOnlyTemplates();
          const allMotion = [...pairedTemplates, ...motionOnly];
          const templateId = allMotion[0]?.id;

          if (!templateId) {
            toast.error("No motion template available for this type.");
            setGenerationFailed(true);
            return;
          }

          const res = await createMotionPostAction({
            brief: result.raw,
            contentType,
            motionTemplateId: templateId,
            slideCount,
            fontPairingId: fontPairingId ?? undefined,
          });

          if (!res.ok) {
            toast.error(res.error);
            setGenerationFailed(true);
            return;
          }

          const sfxRaw = res.animationParams._sfxCues;
          setMotionPost({
            id: res.postId,
            motionTemplateId: res.motionTemplateId,
            slides: res.slides,
            brief: result.raw,
            paletteId: res.paletteId,
            animationParams: res.animationParams,
            primaryAspectRatio: res.primaryAspectRatio as MotionAspectRatio,
            fontPairingId,
            sfxCues: typeof sfxRaw === "string" ? JSON.parse(sfxRaw) : [],
          });
          setActivePost(null);
          setView("preview");
          toast.success("Motion post generated.");
          return;
        }

        // Static path
        const res = await createPostAction({
          brief: result.raw,
          contentType,
          slideCount,
          fontPairingId: fontPairingId ?? undefined,
          paletteId: staticPaletteId ?? undefined,
          customPalette: customPalette ?? undefined,
        });

        if (!res.ok) {
          toast.error(res.error);
          setGenerationFailed(true);
          return;
        }

        setActivePost({
          id: res.postId,
          templateId: res.templateId,
          slides: res.slides,
          contentType,
          brief: result.raw,
        });
        setMotionPost(null);
        setView("preview");
        toast.success(
          res.slideCount > 1
            ? `${res.slideCount}-slide carousel generated.`
            : "Post generated.",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(msg || "Generation failed. Try again.");
        setGenerationFailed(true);
      } finally {
        setGenerating(false);
      }
    },
    [generating, getEffectiveFormat, fontPairingId, staticPaletteId, customPalette],
  );

  /* ------------------------------------------------------------------ */
  /* Preview callbacks (unchanged from original)                        */
  /* ------------------------------------------------------------------ */

  const handleCorrect = useCallback(
    async (correction: string, slideIndex?: number) => {
      if (!activePost) return;
      try {
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
      } catch {
        toast.error("Correction failed. Try again.");
      }
    },
    [activePost],
  );

  const handleRender = useCallback(
    async (ratios: AspectRatio[], platforms: string) => {
      if (!activePost) return;
      try {
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(msg || "Rendering failed. Try again.");
      }
    },
    [activePost],
  );

  const handleChangeTemplate = useCallback(
    async (templateId: string) => {
      if (!activePost) return;
      try {
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
      } catch {
        toast.error("Template change failed. Try again.");
      }
    },
    [activePost],
  );

  const handleStaticCopyChange = useCallback(
    (slides: SlideCopy[]) => {
      if (!activePost) return;
      setActivePost((prev) => (prev ? { ...prev, slides } : null));
      updateStaticPostAction({ postId: activePost.id, slides }).catch(() =>
        toast.error("Failed to save copy changes."),
      );
    },
    [activePost],
  );

  const handleStaticFontChange = useCallback(
    (id: string | null) => {
      setFontPairingId(id);
      if (!activePost) return;
      updateStaticPostAction({ postId: activePost.id, fontPairingId: id }).catch(() =>
        toast.error("Failed to save font change."),
      );
    },
    [activePost],
  );

  const handleStaticLayoutChange = useCallback(
    (layout: MotionLayoutConfig) => {
      if (!activePost) return;
      updateStaticPostAction({
        postId: activePost.id,
        layoutJson: JSON.stringify(layout),
      }).catch(() => toast.error("Failed to save layout change."));
    },
    [activePost],
  );

  const handleStaticPaletteChange = useCallback(
    (paletteId: string | null, custom?: CustomPaletteInput | null) => {
      setStaticPaletteId(paletteId);
      if (custom !== undefined) setCustomPalette(custom);
      if (!activePost) return;
      updateStaticPostAction({
        postId: activePost.id,
        paletteId,
        customPalette: custom ?? (paletteId !== "custom" ? null : undefined),
      }).catch(() => toast.error("Failed to save palette change."));
    },
    [activePost],
  );

  const handlePromoteToMotion = useCallback(
    async (motionTemplateId: string, slideIndex: number) => {
      if (!activePost) return;
      try {
        const result = await promoteToMotionAction({
          postId: activePost.id,
          slideIndex,
          motionTemplateId,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const sfxRaw2 = result.animationParams._sfxCues;
        setMotionPost({
          id: result.postId,
          motionTemplateId: result.motionTemplateId,
          slides: result.slides,
          brief: activePost.brief,
          paletteId: result.paletteId,
          animationParams: result.animationParams,
          primaryAspectRatio: result.primaryAspectRatio as MotionAspectRatio,
          fontPairingId,
          sfxCues: typeof sfxRaw2 === "string" ? JSON.parse(sfxRaw2) : [],
        });
        setView("preview");
        toast.success("Motion version created.");
      } catch {
        toast.error("Failed to create motion version.");
      }
    },
    [activePost, fontPairingId],
  );

  const handleMotionCopyChange = useCallback(
    (slides: SlideCopy[]) => {
      if (!motionPost) return;
      setMotionPost((prev) => (prev ? { ...prev, slides } : null));
      updateMotionPostAction({ postId: motionPost.id, slides }).catch(() =>
        toast.error("Failed to save copy changes."),
      );
    },
    [motionPost],
  );

  const handleMotionPaletteChange = useCallback(
    (paletteId: string) => {
      if (!motionPost) return;
      setMotionPost((prev) => (prev ? { ...prev, paletteId } : null));
      updateMotionPostAction({ postId: motionPost.id, paletteId }).catch(() =>
        toast.error("Failed to save palette change."),
      );
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
      }).catch(() => toast.error("Failed to save aspect ratio change."));
    },
    [motionPost],
  );

  const handleMotionFontChange = useCallback(
    (id: string | null) => {
      setFontPairingId(id);
      if (!motionPost) return;
      setMotionPost((prev) => (prev ? { ...prev, fontPairingId: id } : null));
      updateMotionPostAction({ postId: motionPost.id, fontPairingId: id }).catch(() =>
        toast.error("Failed to save font change."),
      );
    },
    [motionPost],
  );

  const handleMotionDurationChange = useCallback(
    (frames: number) => {
      if (!motionPost) return;
      setMotionPost((prev) => (prev ? { ...prev, durationInFrames: frames } : null));
      updateMotionPostAction({ postId: motionPost.id, durationInFrames: frames }).catch(() =>
        toast.error("Failed to save duration change."),
      );
    },
    [motionPost],
  );

  const handleMotionSfxChange = useCallback(
    (cues: SfxCueData[]) => {
      if (!motionPost) return;
      setMotionPost((prev) => (prev ? { ...prev, sfxCues: cues } : null));
      updateMotionPostAction({
        postId: motionPost.id,
        animationParams: {
          ...motionPost.animationParams,
          _sfxCues: JSON.stringify(cues),
        },
      }).catch(() => toast.error("Failed to save SFX changes."));
    },
    [motionPost],
  );

  const handleMotionLayoutChange = useCallback(
    (layout: MotionLayoutConfig) => {
      if (!motionPost) return;
      const updated = {
        ...motionPost.animationParams,
        _layout: JSON.stringify(layout),
      };
      setMotionPost((prev) =>
        prev ? { ...prev, animationParams: updated } : null,
      );
      updateMotionPostAction({
        postId: motionPost.id,
        animationParams: updated,
      }).catch(() => toast.error("Failed to save layout change."));
    },
    [motionPost],
  );

  const handleNewPost = useCallback(() => {
    setActivePost(null);
    setMotionPost(null);
    setActiveVideoJobId(null);
    setFontPairingId(null);
    setStaticPaletteId(null);
    setCustomPalette(null);
    setBriefResult(null);
    setView("create");
  }, []);

  const hasActivePreview = activePost || motionPost || activeVideoJobId;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Content{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">Studio</span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Content Studio
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Describe what you want to make.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            the platform figures out the rest.
          </em>
        </p>
      </header>

      {/* View tabs */}
      <div className="mt-4 flex items-center gap-2 px-4">
        <ViewTab
          label="Create"
          icon={PlusIcon}
          active={view === "create"}
          onClick={() => setView("create")}
        />
        {hasActivePreview && (
          <ViewTab
            label="Preview"
            icon={EyeIcon}
            active={view === "preview"}
            onClick={() => setView("preview")}
          />
        )}
        <ViewTab
          label="History"
          icon={HistoryIcon}
          active={view === "history"}
          onClick={() => setView("history")}
        />
      </div>

      {/* Content area */}
      <div className="mt-6 px-4">
        {view === "create" && (
          <div className="space-y-6">
            {/* WIP section */}
            <WipSection
              projects={wipProjects}
              onSelect={(id) => {
                // Wave 2: load project and switch to preview
                toast.info("Project loading coming soon.");
              }}
            />

            {/* Unified brief input */}
            <UnifiedBrief
              knownClients={knownClients}
              onBriefChange={setBriefResult}
              onGenerate={handleGenerate}
              generating={generating}
              initialValue={searchParams.get("prefill_brief") ?? ""}
            />

            <GenerationProgress
              active={generating}
              isMotion={
                briefResult
                  ? getEffectiveFormat(briefResult) !== "static"
                  : false
              }
              failed={generationFailed}
            />

            {/* Video generation status */}
            <AnimatePresence>
              {activeVideoJobId && generating && (
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: "rgba(242, 140, 82, 0.08)",
                    border: "1px solid rgba(242, 140, 82, 0.15)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="size-2 animate-pulse rounded-full"
                      style={{ backgroundColor: "var(--color-brand-orange)" }}
                    />
                    <span
                      className="font-[family-name:var(--font-body)] text-[13px]"
                      style={{ color: "var(--color-brand-orange)" }}
                    >
                      Generating footage — this takes 30-60 seconds
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {view === "preview" && motionPost && (
          <MotionPreview
            post={motionPost}
            onCopyChange={handleMotionCopyChange}
            onPaletteChange={handleMotionPaletteChange}
            onAspectRatioChange={handleMotionAspectRatioChange}
            onFontPairingChange={handleMotionFontChange}
            onDurationChange={handleMotionDurationChange}
            onSfxChange={handleMotionSfxChange}
            onLayoutChange={handleMotionLayoutChange}
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
            onCopyChange={handleStaticCopyChange}
            onFontPairingChange={handleStaticFontChange}
            onPaletteChange={handleStaticPaletteChange}
            onPromoteToMotion={handlePromoteToMotion}
            onLayoutChange={handleStaticLayoutChange}
            fontPairingId={fontPairingId}
            paletteId={staticPaletteId}
            customPalette={customPalette}
          />
        )}

        {view === "preview" && activeVideoJobId && !activePost && !motionPost && (
          <div className="space-y-4">
            <div
              className="rounded-xl p-6 text-center"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                border: "1px solid rgba(253, 245, 230, 0.06)",
              }}
            >
              <div
                className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(242, 140, 82, 0.1)" }}
              >
                <div
                  className="size-3 animate-pulse rounded-full"
                  style={{ backgroundColor: "var(--color-brand-orange)" }}
                />
              </div>
              <p
                className="font-[family-name:var(--font-body)] text-[15px]"
                style={{ color: "var(--color-brand-cream)" }}
              >
                Your footage is being generated
              </p>
              <p
                className="mt-1 font-[family-name:var(--font-body)] text-[13px]"
                style={{ color: "var(--color-neutral-500)" }}
              >
                Check the Video Library tab for progress, or start another piece.
              </p>
              <button
                type="button"
                onClick={handleNewPost}
                className="mt-4 rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: "rgba(253, 245, 230, 0.06)",
                  color: "var(--color-brand-cream)",
                  border: "1px solid rgba(253, 245, 230, 0.08)",
                }}
              >
                Create another
              </button>
            </div>
          </div>
        )}

        {view === "history" && <PostHistory />}
      </div>
    </div>
  );
}

function ViewTab({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof PlusIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
      style={{
        letterSpacing: "1.5px",
        backgroundColor: active
          ? "var(--color-brand-red)"
          : "var(--color-neutral-800)",
        color: active
          ? "var(--color-brand-cream)"
          : "var(--color-neutral-500)",
      }}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

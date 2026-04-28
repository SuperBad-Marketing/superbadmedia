"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PlusIcon, HistoryIcon, EyeIcon, BookmarkIcon, CopyIcon, SendIcon, DollarSignIcon } from "lucide-react";
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
  getWipProjectsAction,
  getCompositeJobAction,
  configureCompositeAction,
  renderOverlayAction,
  compositeVideoAction,
  retryCompositeStageAction,
  listPromptsAction,
  savePromptAction,
  createMultiVariantAction,
  publishToInstagramAction,
  getMonthlyCostsAction,
} from "../actions";
import { suggestProjectName } from "@/lib/content-studio/project-name";
import { UnifiedBrief, type UnifiedBriefResult } from "./unified-brief";
import { PostPreview } from "./post-preview";
import { PostHistory } from "./post-history";
import { MotionPreview, type MotionPostData } from "./motion-preview";
import { WipSection, type WipProject } from "./wip-section";
import { GenerationProgress } from "./generation-progress";
import { CompositeEditor, type CompositeJob } from "./composite-editor";
import {
  PromptLibraryDrawer,
  type SavedPrompt,
} from "./prompt-library-drawer";
import { CostTag } from "./cost-tag";
import { CostDashboard, type MonthlyCostData } from "./cost-dashboard";
import type { PipelineStage } from "@/lib/db/schema/video-jobs";

const FORMAT_MAP: Record<ContentType, ContentFormat> = {
  anti_motivation: "animated",
  portfolio: "composite",
  testimonial: "animated",
  behind_the_scenes: "composite",
  tips: "static",
  announcement: "animated",
};

type StudioView = "create" | "preview" | "history" | "costs";

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
  const [compositeJob, setCompositeJob] = useState<CompositeJob | null>(null);
  const [isComposite, setIsComposite] = useState(false);

  // WIP projects from DB
  const [wipProjects, setWipProjects] = useState<WipProject[]>([]);

  // Prompt library
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);

  // Multi-variant toggle
  const [multiVariant, setMultiVariant] = useState(false);

  // Cost dashboard
  const [costData, setCostData] = useState<MonthlyCostData[]>([]);
  const [costsLoading, setCostsLoading] = useState(false);

  // Publishing
  const [publishing, setPublishing] = useState(false);

  // Load client names + WIP projects on mount
  useEffect(() => {
    getClientNamesAction().then((res) => {
      if (res.ok) setKnownClients(res.clients);
    });
    loadWipProjects();
  }, []);

  const loadWipProjects = useCallback(() => {
    getWipProjectsAction().then((res) => {
      if (res.ok) setWipProjects(res.projects);
    });
  }, []);

  const loadCompositeJob = useCallback((jobId: string) => {
    getCompositeJobAction(jobId).then((res) => {
      if (res.ok) setCompositeJob(res.job);
    });
  }, []);

  const loadCosts = useCallback(() => {
    setCostsLoading(true);
    getMonthlyCostsAction()
      .then((res) => {
        if (res.ok) setCostData(res.data);
      })
      .finally(() => setCostsLoading(false));
  }, []);

  const handlePublishToInstagram = useCallback(
    async (caption: string) => {
      setPublishing(true);
      try {
        const input: { postId?: string; videoJobId?: string; caption: string } = { caption };
        if (activeVideoJobId) input.videoJobId = activeVideoJobId;
        else if (activePost) input.postId = activePost.id;
        else if (motionPost) input.postId = motionPost.id;
        else {
          toast.error("Nothing to publish.");
          return;
        }
        const res = await publishToInstagramAction(input);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Published to Instagram.");
      } catch {
        toast.error("Publishing failed.");
      } finally {
        setPublishing(false);
      }
    },
    [activeVideoJobId, activePost, motionPost],
  );

  const loadPrompts = useCallback(() => {
    setPromptsLoading(true);
    listPromptsAction()
      .then((res) => {
        if (res.ok) setSavedPrompts(res.prompts);
      })
      .finally(() => setPromptsLoading(false));
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
      const projectName = suggestProjectName(
        result.raw,
        format,
        contentType,
        result.parsed.clientName,
      );

      try {
        if (format === "cinematic" || format === "composite") {
          if (multiVariant) {
            const res = await createMultiVariantAction({
              brief: result.raw,
              format,
              variantCount: 3,
              brandSource: result.parsed.clientName ? "client" : "superbad",
            });
            if (!res.ok) {
              toast.error(res.error);
              setGenerationFailed(true);
              return;
            }
            loadWipProjects();
            toast.success(`${res.variantCount} variants queued.`);
            setView("create");
            return;
          }

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
          setIsComposite(res.isComposite ?? false);
          if (res.isComposite) {
            loadCompositeJob(res.jobId);
          }
          loadWipProjects();
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
            projectName,
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
          loadWipProjects();
          setView("preview");
          toast.success("Motion post generated.");
          return;
        }

        const res = await createPostAction({
          brief: result.raw,
          contentType,
          slideCount,
          fontPairingId: fontPairingId ?? undefined,
          paletteId: staticPaletteId ?? undefined,
          customPalette: customPalette ?? undefined,
          projectName,
          contentFormat: format,
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
        loadWipProjects();
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
    [generating, getEffectiveFormat, fontPairingId, staticPaletteId, customPalette, loadWipProjects],
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
    setCompositeJob(null);
    setIsComposite(false);
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
        <ViewTab
          label="Costs"
          icon={DollarSignIcon}
          active={view === "costs"}
          onClick={() => {
            setView("costs");
            loadCosts();
          }}
        />
      </div>

      {/* Content area */}
      <div className="mt-6 px-4">
        {view === "create" && (
          <div className="space-y-6">
            {/* WIP section */}
            <WipSection
              projects={wipProjects}
              onSelect={async (id) => {
                const project = wipProjects.find((p) => p.id === id);
                if (!project) return;

                if (project.source === "video") {
                  setActiveVideoJobId(id);
                  setActivePost(null);
                  setMotionPost(null);
                  setView("preview");
                  return;
                }

                const res = await import("../actions").then((m) =>
                  m.getPostAction(id),
                );
                if (!res.ok || !res.post) {
                  toast.error("Couldn't load project.");
                  return;
                }

                const slides = Array.isArray(res.post.generated_copy_json)
                  ? (res.post.generated_copy_json as SlideCopy[])
                  : res.post.generated_copy_json
                    ? [res.post.generated_copy_json as SlideCopy]
                    : [];

                if (res.post.motion_enabled) {
                  const sfxRaw = res.post.animation_params_json
                    ? JSON.parse(res.post.animation_params_json)._sfxCues
                    : undefined;
                  setMotionPost({
                    id: res.post.id,
                    motionTemplateId: res.post.motion_template_id ?? "",
                    slides,
                    brief: res.post.brief,
                    paletteId: res.post.palette_id ?? "",
                    animationParams: res.post.animation_params_json
                      ? JSON.parse(res.post.animation_params_json)
                      : {},
                    primaryAspectRatio: (res.post.primary_aspect_ratio ?? "square") as MotionAspectRatio,
                    fontPairingId: res.post.font_pairing_id ?? null,
                    sfxCues: typeof sfxRaw === "string" ? JSON.parse(sfxRaw) : [],
                  });
                  setActivePost(null);
                } else {
                  setActivePost({
                    id: res.post.id,
                    templateId: res.post.template_id,
                    slides,
                    contentType: res.post.content_type,
                    brief: res.post.brief,
                  });
                  setMotionPost(null);
                }
                setFontPairingId(res.post.font_pairing_id ?? null);
                setStaticPaletteId(res.post.static_palette_id ?? null);
                setView("preview");
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

            {/* Tools row: prompt library + multi-variant toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setLibraryOpen(true);
                  loadPrompts();
                }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[12px] transition-colors"
                style={{
                  backgroundColor: "rgba(253, 245, 230, 0.04)",
                  color: "var(--color-neutral-400)",
                  border: "1px solid rgba(253, 245, 230, 0.06)",
                }}
              >
                <BookmarkIcon className="size-3" />
                Prompt library
              </button>

              <label
                className="flex cursor-pointer items-center gap-2"
              >
                <div
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: multiVariant
                      ? "var(--color-brand-red)"
                      : "rgba(253, 245, 230, 0.08)",
                  }}
                  onClick={() => setMultiVariant((v) => !v)}
                  role="switch"
                  aria-checked={multiVariant}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setMultiVariant((v) => !v);
                    }
                  }}
                >
                  <div
                    className="size-3.5 rounded-full transition-transform"
                    style={{
                      backgroundColor: "var(--color-brand-cream)",
                      transform: multiVariant
                        ? "translateX(18px)"
                        : "translateX(3px)",
                    }}
                  />
                </div>
                <span
                  className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[12px]"
                  style={{
                    color: multiVariant
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-500)",
                  }}
                >
                  <CopyIcon className="size-3" />
                  Render 3 variants
                </span>
              </label>

              {briefResult && (
                <CostTag
                  format={getEffectiveFormat(briefResult)}
                  variants={multiVariant ? 3 : 1}
                />
              )}
            </div>

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
          isComposite && compositeJob ? (
            <div className="space-y-4">
              <CompositeEditor
                job={compositeJob}
                onConfigureOverlay={async (config) => {
                  const res = await configureCompositeAction({
                    jobId: activeVideoJobId,
                    ...config,
                  });
                  if (!res.ok) toast.error("error" in res ? res.error : "Failed");
                  loadCompositeJob(activeVideoJobId);
                }}
                onRenderOverlay={async () => {
                  const res = await renderOverlayAction(activeVideoJobId);
                  if (!res.ok) toast.error("error" in res ? res.error : "Overlay render failed");
                  loadCompositeJob(activeVideoJobId);
                }}
                onComposite={async () => {
                  const res = await compositeVideoAction(activeVideoJobId);
                  if (!res.ok) toast.error("error" in res ? res.error : "Compositing failed");
                  loadCompositeJob(activeVideoJobId);
                }}
                onRetryStage={async (stage) => {
                  const res = await retryCompositeStageAction(activeVideoJobId, stage);
                  if (!res.ok) toast.error("error" in res ? res.error : "Retry failed");
                  loadCompositeJob(activeVideoJobId);
                }}
              />
              {compositeJob.compositeUrl && (
                <PublishBar
                  onPublish={handlePublishToInstagram}
                  publishing={publishing}
                />
              )}
            </div>
          ) : (
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
          )
        )}

        {view === "history" && <PostHistory />}

        {view === "costs" && (
          <CostDashboard data={costData} loading={costsLoading} />
        )}
      </div>

      {/* Prompt library drawer */}
      <PromptLibraryDrawer
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={(prompt) => {
          setBriefResult(null);
        }}
        onSave={async (data) => {
          const res = await savePromptAction(data);
          if (!res.ok) throw new Error("save failed");
          loadPrompts();
        }}
        currentBrief={briefResult?.raw}
        prompts={savedPrompts}
        loading={promptsLoading}
      />
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

function PublishBar({
  onPublish,
  publishing,
}: {
  onPublish: (caption: string) => void;
  publishing: boolean;
}) {
  const [caption, setCaption] = useState("");

  return (
    <div
      className="flex items-end gap-3 rounded-xl p-4"
      style={{
        backgroundColor: "var(--color-neutral-800)",
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      <div className="min-w-0 flex-1">
        <label
          className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Caption
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption..."
          rows={3}
          className="w-full resize-none rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[13px] outline-none"
          style={{
            backgroundColor: "rgba(253, 245, 230, 0.03)",
            color: "var(--color-brand-cream)",
            border: "1px solid rgba(253, 245, 230, 0.06)",
          }}
        />
      </div>
      <button
        type="button"
        onClick={() => onPublish(caption)}
        disabled={publishing || !caption.trim()}
        className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity disabled:opacity-40"
        style={{
          backgroundColor: "var(--color-brand-red)",
          color: "var(--color-brand-cream)",
        }}
      >
        <SendIcon className="size-3.5" />
        {publishing ? "Publishing..." : "Publish to IG"}
      </button>
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CONTENT_TYPES, type ContentType, type AspectRatio } from "@/lib/db/schema/content-studio";
import type { SlideCopy } from "@/lib/content-studio/generate-copy";
import type { CustomPaletteInput, SfxCueData } from "@/lib/content-studio/motion/types";
import type { MotionLayoutConfig } from "@/lib/content-studio/motion/layouts";
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
  updateStaticPostAction,
  promoteToMotionAction,
} from "../actions";
import { PostPreview } from "./post-preview";
import { PostHistory } from "./post-history";
import { MotionPreview, type MotionPostData } from "./motion-preview";
import { InspirationPanel } from "./inspiration-panel";
import { GenerationProgress } from "./generation-progress";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  announcement: "Announcement",
  anti_motivation: "Anti-Motivation",
  portfolio: "Portfolio",
  tips: "Tips & Value",
  testimonial: "Testimonial",
  behind_the_scenes: "Behind the Scenes",
};

const SLIDE_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10] as const;

/* ------------------------------------------------------------------ */
/* Structured brief options                                            */
/* ------------------------------------------------------------------ */

const POST_GOALS = [
  { id: "awareness", label: "Brand awareness", hint: "Get seen, make an impression" },
  { id: "engagement", label: "Engagement", hint: "Spark conversation, get shares" },
  { id: "social_proof", label: "Social proof", hint: "Show credibility & results" },
  { id: "education", label: "Education", hint: "Teach something, share value" },
  { id: "conversion", label: "Conversion", hint: "Drive action — book, buy, enquire" },
  { id: "community", label: "Community", hint: "Connect, relate, behind the scenes" },
] as const;
type PostGoal = (typeof POST_GOALS)[number]["id"];

const POST_TONES = [
  { id: "dry_witty", label: "Dry & witty", hint: "The house voice" },
  { id: "bold_confident", label: "Bold & confident", hint: "Big energy" },
  { id: "warm_genuine", label: "Warm & genuine", hint: "Heart on sleeve" },
  { id: "provocative", label: "Provocative", hint: "Challenge assumptions" },
  { id: "understated", label: "Understated", hint: "Let the work speak" },
] as const;
type PostTone = (typeof POST_TONES)[number]["id"];

const POST_AUDIENCES = [
  { id: "existing_clients", label: "Existing clients" },
  { id: "prospects", label: "Prospects" },
  { id: "industry_peers", label: "Industry peers" },
  { id: "general", label: "General audience" },
] as const;
type PostAudience = (typeof POST_AUDIENCES)[number]["id"];

const POST_CTAS = [
  { id: "none", label: "No CTA", hint: "Pure content" },
  { id: "soft", label: "Soft CTA", hint: "DM us, link in bio" },
  { id: "direct", label: "Direct CTA", hint: "Book now, get started" },
] as const;
type PostCta = (typeof POST_CTAS)[number]["id"];

const POST_HOOKS = [
  { id: "question", label: "Question", hint: "Ask something provocative" },
  { id: "statement", label: "Bold statement", hint: "Lead with a claim" },
  { id: "story", label: "Story", hint: "Start with a scenario" },
  { id: "statistic", label: "Statistic", hint: "Lead with a number" },
  { id: "any", label: "Surprise me", hint: "Let the AI decide" },
] as const;
type PostHook = (typeof POST_HOOKS)[number]["id"];

function compileBrief(opts: {
  topic: string;
  goal: PostGoal;
  tone: PostTone;
  audience: PostAudience;
  cta: PostCta;
  hook: PostHook;
  extraContext: string;
  contentType: ContentType;
  slideCount: number;
}): string {
  const goalLabel = POST_GOALS.find((g) => g.id === opts.goal)?.label ?? opts.goal;
  const toneLabel = POST_TONES.find((t) => t.id === opts.tone)?.label ?? opts.tone;
  const audienceLabel = POST_AUDIENCES.find((a) => a.id === opts.audience)?.label ?? opts.audience;
  const ctaLabel = POST_CTAS.find((c) => c.id === opts.cta);
  const hookLabel = POST_HOOKS.find((h) => h.id === opts.hook);

  const parts = [
    `Topic: ${opts.topic}`,
    `Goal: ${goalLabel}`,
    `Tone: ${toneLabel}`,
    `Audience: ${audienceLabel}`,
  ];

  if (opts.cta !== "none" && ctaLabel) {
    parts.push(`Call to action: ${ctaLabel.label} (${ctaLabel.hint})`);
  }

  if (opts.hook !== "any" && hookLabel) {
    parts.push(`Hook style: ${hookLabel.label}`);
  }

  if (opts.slideCount > 1) {
    parts.push(`Format: ${opts.slideCount}-slide carousel`);
  }

  if (opts.extraContext.trim()) {
    parts.push(`Additional context: ${opts.extraContext.trim()}`);
  }

  return parts.join("\n");
}

/* ------------------------------------------------------------------ */

type StudioView = "create" | "preview" | "history";

export interface ActivePost {
  id: string;
  templateId: string;
  slides: SlideCopy[];
  contentType: ContentType;
  brief: string;
}

function ChipSelector<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label
        className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] transition-all"
            style={{
              backgroundColor:
                value === opt.id
                  ? "var(--color-brand-red)"
                  : "var(--color-neutral-800)",
              color: "var(--color-brand-cream)",
              border:
                value === opt.id
                  ? "1px solid var(--color-brand-red)"
                  : "1px solid rgba(253, 245, 230, 0.08)",
            }}
          >
            {opt.label}
            {opt.hint && value !== opt.id && (
              <span className="ml-1.5 text-[11px] opacity-40">{opt.hint}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StudioClient() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<StudioView>("create");

  // Structured brief state
  const [topic, setTopic] = useState(() => searchParams.get("prefill_brief") ?? "");
  const [postGoal, setPostGoal] = useState<PostGoal>("awareness");
  const [postTone, setPostTone] = useState<PostTone>("dry_witty");
  const [postAudience, setPostAudience] = useState<PostAudience>("prospects");
  const [postCta, setPostCta] = useState<PostCta>("none");
  const [postHook, setPostHook] = useState<PostHook>("any");
  const [extraContext, setExtraContext] = useState("");

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
  const [generationFailed, setGenerationFailed] = useState(false);
  const [activePost, setActivePost] = useState<ActivePost | null>(null);

  // Motion state
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [selectedMotionTemplate, setSelectedMotionTemplate] = useState<string | null>(null);
  const [motionPost, setMotionPost] = useState<MotionPostData | null>(null);
  const [inspirationRefs, setInspirationRefs] = useState<
    { id: string; source_type: "link" | "upload"; source_url: string; thumbnail_url: string | null; title: string | null; description: string | null }[]
  >([]);

  // Style customisation state (shared between static and motion)
  const [fontPairingId, setFontPairingId] = useState<string | null>(null);
  const [staticPaletteId, setStaticPaletteId] = useState<string | null>(null);
  const [customPalette, setCustomPalette] = useState<CustomPaletteInput | null>(null);

  const handleCreate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic first.");
      return;
    }

    const brief = compileBrief({
      topic: topic.trim(),
      goal: postGoal,
      tone: postTone,
      audience: postAudience,
      cta: postCta,
      hook: postHook,
      extraContext,
      contentType,
      slideCount,
    });

    setGenerating(true);
    setGenerationFailed(false);

    try {
      if (motionEnabled) {
        const templateId = selectedMotionTemplate ?? ALL_MOTION_TEMPLATES[0]?.id;
        if (!templateId) {
          toast.error("No motion template available.");
          setGenerationFailed(true);
          return;
        }

        const result = await createMotionPostAction({
          brief,
          contentType,
          motionTemplateId: templateId,
          slideCount,
          fontPairingId: fontPairingId ?? undefined,
        });
        if (!result.ok) {
          toast.error(result.error);
          setGenerationFailed(true);
          return;
        }
        const sfxRaw = result.animationParams._sfxCues;
        setMotionPost({
          id: result.postId,
          motionTemplateId: result.motionTemplateId,
          slides: result.slides,
          brief,
          paletteId: result.paletteId,
          animationParams: result.animationParams,
          primaryAspectRatio: result.primaryAspectRatio as MotionAspectRatio,
          fontPairingId,
          sfxCues: typeof sfxRaw === "string" ? JSON.parse(sfxRaw) : [],
        });
        setView("preview");
        toast.success("Motion post generated.");
        return;
      }

      const result = await createPostAction({
        brief,
        contentType,
        slideCount,
        fontPairingId: fontPairingId ?? undefined,
        paletteId: staticPaletteId ?? undefined,
        customPalette: customPalette ?? undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        setGenerationFailed(true);
        return;
      }
      setActivePost({
        id: result.postId,
        templateId: result.templateId,
        slides: result.slides,
        contentType,
        brief,
      });
      setMotionPost(null);
      setView("preview");
      toast.success(
        result.slideCount > 1
          ? `${result.slideCount}-slide carousel generated.`
          : "Copy generated.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Generation failed. Try again.");
      setGenerationFailed(true);
    } finally {
      setGenerating(false);
    }
  }, [topic, postGoal, postTone, postAudience, postCta, postHook, extraContext, contentType, slideCount, motionEnabled, selectedMotionTemplate, fontPairingId, staticPaletteId, customPalette]);

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
      } catch {
        toast.error("Rendering failed. Try again.");
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

  // Static post callbacks
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

  // Motion editor callbacks
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
    setTopic("");
    setPostGoal("awareness");
    setPostTone("dry_witty");
    setPostAudience("prospects");
    setPostCta("none");
    setPostHook("any");
    setExtraContext("");
    setSlideCount(1);
    setActivePost(null);
    setMotionPost(null);
    setFontPairingId(null);
    setStaticPaletteId(null);
    setCustomPalette(null);
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
          Pick the goal, set the tone, tell us the topic.{" "}
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

            {/* Structured brief inputs */}
            <ChipSelector
              label="Goal"
              options={POST_GOALS}
              value={postGoal}
              onChange={setPostGoal}
            />

            <ChipSelector
              label="Tone"
              options={POST_TONES}
              value={postTone}
              onChange={setPostTone}
            />

            <ChipSelector
              label="Audience"
              options={POST_AUDIENCES}
              value={postAudience}
              onChange={setPostAudience}
            />

            <ChipSelector
              label="Call to action"
              options={POST_CTAS}
              value={postCta}
              onChange={setPostCta}
            />

            <ChipSelector
              label="Hook style"
              options={POST_HOOKS}
              value={postHook}
              onChange={setPostHook}
            />

            {/* Slide count selector */}
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

            {prefilled && topic && (
              <div
                className="mb-3 rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-cream)]"
                style={{ background: "rgba(244, 160, 176, 0.10)" }}
              >
                Pre-filled from Instagram plan — review and generate when ready.
              </div>
            )}

            {/* Topic — the only free-text field */}
            <div>
              <label
                className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Topic
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What's this post about? e.g. We just hit 500 clients, new pricing tiers, behind the scenes of a shoot day…"
                rows={3}
                className="w-full resize-y rounded-lg border px-4 py-3 font-[family-name:var(--font-body)] text-[14px] leading-[1.6] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none"
                style={{
                  backgroundColor: "var(--color-neutral-800)",
                  color: "var(--color-brand-cream)",
                  borderColor: "rgba(253, 245, 230, 0.08)",
                }}
              />
            </div>

            {/* Optional extra context */}
            <div>
              <label
                className="mb-2 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Extra context{" "}
                <span className="normal-case opacity-50">optional</span>
              </label>
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="Anything else the AI should know — specific phrases, things to avoid, reference points…"
                rows={2}
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
              disabled={generating || !topic.trim()}
              className="rounded-lg px-6 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium transition-opacity"
              style={{
                backgroundColor: "var(--color-brand-red)",
                color: "var(--color-brand-cream)",
                opacity: generating || !topic.trim() ? 0.5 : 1,
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

            <GenerationProgress
              active={generating}
              isMotion={motionEnabled}
              failed={generationFailed}
            />
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
            fontPairingId={fontPairingId}
            paletteId={staticPaletteId}
            customPalette={customPalette}
          />
        )}

        {view === "history" && <PostHistory />}
      </div>
    </div>
  );
}

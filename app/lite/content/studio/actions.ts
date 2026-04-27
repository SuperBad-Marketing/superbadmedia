"use server";

import { auth } from "@/lib/auth/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { eq, desc, inArray } from "drizzle-orm";
import {
  contentStudioPosts,
  contentStudioRenders,
  CONTENT_TYPES,
  ASPECT_RATIOS,
  type AspectRatio,
} from "@/lib/db/schema/content-studio";
import { videoJobs } from "@/lib/db/schema/video-jobs";
import { generateCopy, correctCopy, type SlideCopy } from "@/lib/content-studio/generate-copy";
import { getTemplate, type RenderOptions } from "@/lib/content-studio/templates";
import { getMotionTemplate, getMotionTemplatesForStatic } from "@/lib/content-studio/motion/registry";
import { BRAND_PALETTES, getPalette, buildCustomPalette } from "@/lib/content-studio/motion/palettes";
import { MOTION_DIMENSIONS, type MotionAspectRatio, type CustomPaletteInput } from "@/lib/content-studio/motion/types";
import { getFontFacesForServer } from "@/lib/content-studio/font-pairings";

function resolveRenderOptions(post: {
  font_pairing_id: string | null;
  static_palette_id: string | null;
  custom_palette_json: string | null;
  palette_id: string | null;
}): RenderOptions {
  const opts: RenderOptions = {};

  if (post.font_pairing_id) {
    opts.fontFaces = getFontFacesForServer(post.font_pairing_id);
  }

  const paletteId = post.static_palette_id ?? post.palette_id;
  if (paletteId === "custom" && post.custom_palette_json) {
    const colors = JSON.parse(post.custom_palette_json) as CustomPaletteInput;
    opts.palette = buildCustomPalette(colors);
  } else if (paletteId) {
    const palette = getPalette(paletteId);
    if (palette) opts.palette = palette;
  }

  return opts;
}

const createSchema = z.object({
  brief: z.string().min(1).max(2000),
  contentType: z.enum(CONTENT_TYPES),
  slideCount: z.number().int().min(1).max(10).default(1),
  templateId: z.string().optional(),
  fontPairingId: z.string().optional(),
  paletteId: z.string().optional(),
  customPalette: z.object({
    background: z.string(),
    primary: z.string(),
    accent: z.string(),
    text: z.string(),
  }).optional(),
});

export async function createPostAction(input: z.infer<typeof createSchema>) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  try {
    const { brief, contentType, slideCount, templateId, fontPairingId, paletteId, customPalette } = parsed.data;

    const result = await generateCopy(brief, contentType, slideCount, templateId);
    if (!result.ok) return { ok: false as const, error: result.error };

    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(contentStudioPosts).values({
      id,
      brief,
      content_type: contentType,
      template_id: result.templateId,
      slide_count: slideCount,
      generated_copy_json: result.slides as SlideCopy[],
      correction_history_json: [] as unknown[],
      status: "draft",
      font_pairing_id: fontPairingId ?? null,
      static_palette_id: paletteId ?? null,
      custom_palette_json: customPalette ? JSON.stringify(customPalette) : null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    revalidatePath("/lite/content/studio");
    return {
      ok: true as const,
      postId: id,
      slides: result.slides,
      templateId: result.templateId,
      slideCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[content-studio] createPostAction failed:", msg);
    return { ok: false as const, error: msg };
  }
}

const correctSchema = z.object({
  postId: z.string().uuid(),
  correction: z.string().min(1).max(2000),
  slideIndex: z.number().int().min(0).optional(),
});

export async function correctCopyAction(input: z.infer<typeof correctSchema>) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = correctSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const post = await db.query.contentStudioPosts.findFirst({
    where: eq(contentStudioPosts.id, parsed.data.postId),
  });
  if (!post) return { ok: false as const, error: "post_not_found" };

  const template = getTemplate(post.template_id);
  if (!template) return { ok: false as const, error: "template_not_found" };

  const currentSlides = normaliseSlideCopy(post.generated_copy_json);
  const result = await correctCopy(
    currentSlides,
    parsed.data.correction,
    template,
    parsed.data.slideIndex,
  );
  if (!result.ok) return { ok: false as const, error: result.error };

  const history = Array.isArray(post.correction_history_json)
    ? [...(post.correction_history_json as { correction: string; timestamp: number; slideIndex?: number }[])]
    : [];
  history.push({
    correction: parsed.data.correction,
    timestamp: Date.now(),
    slideIndex: parsed.data.slideIndex,
  });

  await db
    .update(contentStudioPosts)
    .set({
      generated_copy_json: result.slides as SlideCopy[],
      correction_history_json: history as unknown[],
      updated_at_ms: Date.now(),
    })
    .where(eq(contentStudioPosts.id, parsed.data.postId));

  revalidatePath("/lite/content/studio");
  return { ok: true as const, slides: result.slides };
}

const updateStaticSchema = z.object({
  postId: z.string().uuid(),
  slides: z.array(z.record(z.string(), z.string())).optional(),
  fontPairingId: z.string().nullable().optional(),
  paletteId: z.string().nullable().optional(),
  customPalette: z.object({
    background: z.string(),
    primary: z.string(),
    accent: z.string(),
    text: z.string(),
  }).nullable().optional(),
});

export async function updateStaticPostAction(
  input: z.infer<typeof updateStaticSchema>,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = updateStaticSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const updates: Record<string, unknown> = { updated_at_ms: Date.now() };

  if (parsed.data.slides) {
    updates.generated_copy_json = parsed.data.slides;
  }
  if (parsed.data.fontPairingId !== undefined) {
    updates.font_pairing_id = parsed.data.fontPairingId;
  }
  if (parsed.data.paletteId !== undefined) {
    updates.static_palette_id = parsed.data.paletteId;
  }
  if (parsed.data.customPalette !== undefined) {
    updates.custom_palette_json = parsed.data.customPalette
      ? JSON.stringify(parsed.data.customPalette)
      : null;
  }

  await db
    .update(contentStudioPosts)
    .set(updates)
    .where(eq(contentStudioPosts.id, parsed.data.postId));

  return { ok: true as const };
}

const renderSchema = z.object({
  postId: z.string().uuid(),
  ratios: z.array(z.enum(ASPECT_RATIOS)).min(1),
  platforms: z.string().min(1),
});

export async function renderPostAction(input: z.infer<typeof renderSchema>) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = renderSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const post = await db.query.contentStudioPosts.findFirst({
    where: eq(contentStudioPosts.id, parsed.data.postId),
  });
  if (!post) return { ok: false as const, error: "post_not_found" };

  const slides = normaliseSlideCopy(post.generated_copy_json);
  const isCarousel = slides.length > 1;
  const renderOptions = resolveRenderOptions(post);

  const { uploadRenderBuffer } = await import("@/lib/content-studio/upload");
  const now = Date.now();
  const insertedRenders: { id: string; slideIndex: number; ratio: AspectRatio; url: string }[] = [];

  if (isCarousel) {
    const { renderCarousel } = await import("@/lib/content-studio/render-image");
    const renders = await renderCarousel(post.template_id, slides, parsed.data.ratios, renderOptions);

    for (const [, result] of renders) {
      const renderId = crypto.randomUUID();
      let cloudinaryPublicId: string | null = null;
      let cloudinaryUrl: string | null = null;
      let renderStatus: "rendered" | "failed" = "rendered";

      try {
        const upload = await uploadRenderBuffer(
          result.buffer,
          parsed.data.postId,
          `s${result.slideIndex}-${result.ratio}`,
        );
        cloudinaryPublicId = upload.publicId;
        cloudinaryUrl = upload.url;
      } catch {
        renderStatus = "failed";
      }

      await db.insert(contentStudioRenders).values({
        id: renderId,
        post_id: parsed.data.postId,
        slide_index: result.slideIndex,
        aspect_ratio: result.ratio,
        platforms: parsed.data.platforms,
        width: result.width,
        height: result.height,
        cloudinary_public_id: cloudinaryPublicId,
        cloudinary_url: cloudinaryUrl,
        render_status: renderStatus,
        created_at_ms: now,
      });

      insertedRenders.push({
        id: renderId,
        slideIndex: result.slideIndex,
        ratio: result.ratio,
        url: cloudinaryUrl ?? "",
      });
    }
  } else {
    const { renderAllRatios } = await import("@/lib/content-studio/render-image");
    const renders = await renderAllRatios(post.template_id, slides[0], parsed.data.ratios, renderOptions);

    for (const [ratio, result] of renders) {
      const renderId = crypto.randomUUID();
      let cloudinaryPublicId: string | null = null;
      let cloudinaryUrl: string | null = null;
      let renderStatus: "rendered" | "failed" = "rendered";

      try {
        const upload = await uploadRenderBuffer(result.buffer, parsed.data.postId, ratio);
        cloudinaryPublicId = upload.publicId;
        cloudinaryUrl = upload.url;
      } catch {
        renderStatus = "failed";
      }

      await db.insert(contentStudioRenders).values({
        id: renderId,
        post_id: parsed.data.postId,
        slide_index: 0,
        aspect_ratio: ratio,
        platforms: parsed.data.platforms,
        width: result.width,
        height: result.height,
        cloudinary_public_id: cloudinaryPublicId,
        cloudinary_url: cloudinaryUrl,
        render_status: renderStatus,
        created_at_ms: now,
      });

      insertedRenders.push({
        id: renderId,
        slideIndex: 0,
        ratio,
        url: cloudinaryUrl ?? "",
      });
    }
  }

  await db
    .update(contentStudioPosts)
    .set({ status: "rendered", updated_at_ms: Date.now() })
    .where(eq(contentStudioPosts.id, parsed.data.postId));

  revalidatePath("/lite/content/studio");
  return { ok: true as const, renders: insertedRenders };
}

const changeTemplateSchema = z.object({
  postId: z.string().uuid(),
  templateId: z.string().min(1),
});

export async function changeTemplateAction(input: z.infer<typeof changeTemplateSchema>) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = changeTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const template = getTemplate(parsed.data.templateId);
  if (!template) return { ok: false as const, error: "template_not_found" };

  const post = await db.query.contentStudioPosts.findFirst({
    where: eq(contentStudioPosts.id, parsed.data.postId),
  });
  if (!post) return { ok: false as const, error: "post_not_found" };

  await db
    .update(contentStudioPosts)
    .set({
      template_id: parsed.data.templateId,
      updated_at_ms: Date.now(),
    })
    .where(eq(contentStudioPosts.id, parsed.data.postId));

  revalidatePath("/lite/content/studio");
  return { ok: true as const };
}

export async function listPostsAction() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const posts = await db.query.contentStudioPosts.findMany({
    orderBy: desc(contentStudioPosts.created_at_ms),
    limit: 50,
  });

  const postIds = posts.map((p) => p.id);
  const allRenders = postIds.length > 0
    ? await db
        .select()
        .from(contentStudioRenders)
        .where(inArray(contentStudioRenders.post_id, postIds))
    : [];

  const rendersByPost = new Map<string, typeof allRenders>();
  for (const r of allRenders) {
    const existing = rendersByPost.get(r.post_id) ?? [];
    existing.push(r);
    rendersByPost.set(r.post_id, existing);
  }

  return {
    ok: true as const,
    posts: posts.map((p) => ({
      ...p,
      renders: rendersByPost.get(p.id) ?? [],
    })),
  };
}

export async function getPostAction(postId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const post = await db.query.contentStudioPosts.findFirst({
    where: eq(contentStudioPosts.id, postId),
  });
  if (!post) return { ok: false as const, error: "post_not_found" };

  const renders = await db
    .select()
    .from(contentStudioRenders)
    .where(eq(contentStudioRenders.post_id, postId));

  return { ok: true as const, post, renders };
}

// --- Motion post actions ---

const createMotionSchema = z.object({
  brief: z.string().min(1).max(2000),
  contentType: z.enum(CONTENT_TYPES),
  motionTemplateId: z.string().min(1),
  slideCount: z.number().int().min(1).max(10).optional(),
  paletteId: z.string().optional(),
  primaryAspectRatio: z.string().optional(),
  fontPairingId: z.string().optional(),
});

export async function createMotionPostAction(
  input: z.infer<typeof createMotionSchema>,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = createMotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  try {
    const { brief, contentType, motionTemplateId, slideCount: reqSlides, paletteId, primaryAspectRatio, fontPairingId } =
      parsed.data;
    const slideCount = reqSlides ?? 1;

    const motionTemplate = getMotionTemplate(motionTemplateId);
    if (!motionTemplate) return { ok: false as const, error: "template_not_found" };

    const result = await generateCopy(brief, contentType, slideCount);
    if (!result.ok) return { ok: false as const, error: result.error };

    const now = Date.now();
    const id = crypto.randomUUID();
    const resolvedPalette = paletteId ?? BRAND_PALETTES[0].id;
    const resolvedRatio = primaryAspectRatio ?? "square";
    const defaultParams = Object.fromEntries(
      motionTemplate.animationParams.map((p) => [p.key, p.default]),
    );

    await db.insert(contentStudioPosts).values({
      id,
      brief,
      content_type: contentType,
      template_id: motionTemplate.staticCounterpart ?? motionTemplateId,
      slide_count: slideCount,
      generated_copy_json: result.slides as SlideCopy[],
      correction_history_json: [] as unknown[],
      status: "draft",
      motion_enabled: 1,
      motion_template_id: motionTemplateId,
      palette_id: resolvedPalette,
      animation_params_json: JSON.stringify(defaultParams),
      primary_aspect_ratio: resolvedRatio,
      font_pairing_id: fontPairingId ?? null,
      created_at_ms: now,
      updated_at_ms: now,
    });

    revalidatePath("/lite/content/studio");
    return {
      ok: true as const,
      postId: id,
      slides: result.slides,
      motionTemplateId,
      paletteId: resolvedPalette,
      animationParams: defaultParams,
      primaryAspectRatio: resolvedRatio,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[content-studio] createMotionPostAction failed:", msg);
    return { ok: false as const, error: msg };
  }
}

const updateMotionSchema = z.object({
  postId: z.string().uuid(),
  slides: z.array(z.record(z.string(), z.string())).optional(),
  paletteId: z.string().optional(),
  animationParams: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  primaryAspectRatio: z.string().optional(),
  fontPairingId: z.string().nullable().optional(),
  durationInFrames: z.number().int().min(1).optional(),
});

export async function updateMotionPostAction(
  input: z.infer<typeof updateMotionSchema>,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = updateMotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const updates: Record<string, unknown> = { updated_at_ms: Date.now() };

  if (parsed.data.slides) {
    updates.generated_copy_json = parsed.data.slides;
  }
  if (parsed.data.paletteId) {
    updates.palette_id = parsed.data.paletteId;
  }
  if (parsed.data.animationParams) {
    updates.animation_params_json = JSON.stringify(parsed.data.animationParams);
  }
  if (parsed.data.primaryAspectRatio) {
    updates.primary_aspect_ratio = parsed.data.primaryAspectRatio;
  }
  if (parsed.data.fontPairingId !== undefined) {
    updates.font_pairing_id = parsed.data.fontPairingId;
  }
  if (parsed.data.durationInFrames !== undefined) {
    updates.motion_duration_frames = parsed.data.durationInFrames;
  }

  await db
    .update(contentStudioPosts)
    .set(updates)
    .where(eq(contentStudioPosts.id, parsed.data.postId));

  return { ok: true as const };
}

// --- Motion export action ---

const exportMotionSchema = z.object({
  postId: z.string().uuid(),
  ratios: z.array(z.string()).min(1),
  format: z.enum(["mp4", "webm"]),
  transparent: z.boolean().default(false),
});

export async function exportMotionPostAction(
  input: z.infer<typeof exportMotionSchema>,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = exportMotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const post = await db.query.contentStudioPosts.findFirst({
    where: eq(contentStudioPosts.id, parsed.data.postId),
  });
  if (!post || !post.motion_enabled) {
    return { ok: false as const, error: "post_not_found" };
  }

  const motionTemplate = getMotionTemplate(post.motion_template_id ?? "");
  if (!motionTemplate) {
    return { ok: false as const, error: "template_not_found" };
  }

  const palette = getPalette(post.palette_id ?? "") ?? BRAND_PALETTES[0];
  const slides = normaliseSlideCopy(post.generated_copy_json);
  const copy = slides[0] ?? {};
  const animationParams = post.animation_params_json
    ? JSON.parse(post.animation_params_json as string)
    : {};
  const durationInFrames = post.motion_duration_frames ?? motionTemplate.defaultDuration;

  const { renderAndUploadMotion } = await import(
    "@/lib/content-studio/render-motion"
  );
  const now = Date.now();
  const results: {
    id: string;
    ratio: string;
    format: string;
    url: string;
  }[] = [];

  const errors: string[] = [];

  for (const ratio of parsed.data.ratios) {
    const motionRatio = ratio as MotionAspectRatio;
    const dims = MOTION_DIMENSIONS[motionRatio];
    if (!dims) continue;

    try {
      const result = await renderAndUploadMotion(
        {
          templateId: motionTemplate.id,
          copy,
          palette,
          aspectRatio: motionRatio,
          transparent: parsed.data.transparent,
          animationParams,
          durationInFrames,
          format: parsed.data.format,
        },
        parsed.data.postId,
        ratio,
      );

      const renderId = crypto.randomUUID();
      const videoJobId = crypto.randomUUID();

      const dbRatio = motionRatio === "story" ? "portrait" as const : motionRatio;
      await db.insert(contentStudioRenders).values({
        id: renderId,
        post_id: parsed.data.postId,
        slide_index: 0,
        aspect_ratio: dbRatio,
        platforms: "motion-export",
        width: result.width,
        height: result.height,
        cloudinary_public_id: result.publicId,
        cloudinary_url: result.url,
        render_status: "rendered",
        render_type: "motion",
        format: result.format,
        video_job_id: videoJobId,
        created_at_ms: now,
      });

      await db.insert(videoJobs).values({
        id: videoJobId,
        video_type: "motion_design",
        engine: "remotion",
        status: "ready",
        initial_prompt: post.brief,
        aspect_ratio: ratio,
        output_url: result.url,
        content_studio_post_id: parsed.data.postId,
        created_at: new Date(now),
        completed_at: new Date(),
      });

      results.push({
        id: renderId,
        ratio,
        format: result.format,
        url: result.url,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[motion-export] ${ratio} render failed:`, msg);
      errors.push(`${ratio}: ${msg}`);
    }
  }

  if (results.length === 0) {
    return {
      ok: false as const,
      error: `All renders failed. ${errors.join("; ")}`,
    };
  }

  await db
    .update(contentStudioPosts)
    .set({ status: "rendered", updated_at_ms: Date.now() })
    .where(eq(contentStudioPosts.id, parsed.data.postId));

  revalidatePath("/lite/content/studio");
  return {
    ok: true as const,
    renders: results,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  };
}

// --- Promote static to motion ---

const promoteToMotionSchema = z.object({
  postId: z.string().uuid(),
  slideIndex: z.number().int().min(0),
  motionTemplateId: z.string().min(1),
});

export async function promoteToMotionAction(
  input: z.infer<typeof promoteToMotionSchema>,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = promoteToMotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const sourcePost = await db.query.contentStudioPosts.findFirst({
    where: eq(contentStudioPosts.id, parsed.data.postId),
  });
  if (!sourcePost) return { ok: false as const, error: "post_not_found" };

  const motionTemplate = getMotionTemplate(parsed.data.motionTemplateId);
  if (!motionTemplate) return { ok: false as const, error: "template_not_found" };

  const slides = normaliseSlideCopy(sourcePost.generated_copy_json);
  const sourceCopy = slides[parsed.data.slideIndex] ?? slides[0] ?? {};

  const mappedCopy: Record<string, string> = {};
  for (const slot of motionTemplate.copySlots) {
    mappedCopy[slot] = sourceCopy[slot] ?? "";
  }

  const now = Date.now();
  const id = crypto.randomUUID();
  const defaultPalette = sourcePost.palette_id ?? sourcePost.static_palette_id ?? BRAND_PALETTES[0].id;
  const defaultParams = Object.fromEntries(
    motionTemplate.animationParams.map((p) => [p.key, p.default]),
  );

  await db.insert(contentStudioPosts).values({
    id,
    brief: sourcePost.brief,
    content_type: sourcePost.content_type,
    template_id: motionTemplate.staticCounterpart ?? parsed.data.motionTemplateId,
    slide_count: 1,
    generated_copy_json: [mappedCopy] as SlideCopy[],
    correction_history_json: [] as unknown[],
    status: "draft",
    motion_enabled: 1,
    motion_template_id: parsed.data.motionTemplateId,
    palette_id: defaultPalette,
    animation_params_json: JSON.stringify(defaultParams),
    primary_aspect_ratio: "square",
    font_pairing_id: sourcePost.font_pairing_id,
    custom_palette_json: sourcePost.custom_palette_json,
    promoted_from_post_id: sourcePost.id,
    created_at_ms: now,
    updated_at_ms: now,
  });

  revalidatePath("/lite/content/studio");
  return {
    ok: true as const,
    postId: id,
    slides: [mappedCopy] as SlideCopy[],
    motionTemplateId: parsed.data.motionTemplateId,
    paletteId: defaultPalette,
    animationParams: defaultParams,
    primaryAspectRatio: "square" as const,
  };
}

function normaliseSlideCopy(json: unknown): SlideCopy[] {
  if (Array.isArray(json)) return json as SlideCopy[];
  if (json && typeof json === "object") return [json as SlideCopy];
  return [{}];
}

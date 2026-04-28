import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { videoJobs, type PipelineStage, type VideoJobRow } from "@/lib/db/schema/video-jobs";
import { getMotionTemplate } from "@/lib/content-studio/motion/registry";
import { BRAND_PALETTES, getPalette } from "@/lib/content-studio/motion/palettes";
import { renderAndUploadMotion } from "@/lib/content-studio/render-motion";
import type { MotionAspectRatio, ColourPalette } from "@/lib/content-studio/motion/types";

const ASPECT_MAP: Record<string, MotionAspectRatio> = {
  "16:9": "landscape_16x9",
  "9:16": "story",
  "1:1": "square",
  "4:5": "portrait_4x5",
  "3:4": "portrait_3x4",
};

export interface CompositeConfig {
  overlayTemplateId: string;
  overlayCopy: Record<string, string>;
  overlayParams?: Record<string, number | string | boolean>;
  paletteId?: string;
  trimInFrame?: number;
  trimOutFrame?: number;
}

export async function configureComposite(
  jobId: string,
  config: CompositeConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });
  if (!job) return { ok: false, error: "Job not found" };

  const template = getMotionTemplate(config.overlayTemplateId);
  if (!template) return { ok: false, error: "Overlay template not found" };
  if (!template.overlayCapable) {
    return { ok: false, error: "Template does not support overlay mode" };
  }

  await db
    .update(videoJobs)
    .set({
      overlay_template_id: config.overlayTemplateId,
      overlay_copy_json: config.overlayCopy as unknown as Record<string, unknown>,
      overlay_params_json: (config.overlayParams ?? {}) as unknown as Record<string, unknown>,
      trim_in_frame: config.trimInFrame ?? 0,
      trim_out_frame: config.trimOutFrame ?? null,
      pipeline_stage: "overlay",
    })
    .where(eq(videoJobs.id, jobId));

  return { ok: true };
}

export async function renderOverlay(
  jobId: string,
): Promise<{ ok: true; overlayUrl: string } | { ok: false; error: string }> {
  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });
  if (!job) return { ok: false, error: "Job not found" };
  if (!job.overlay_template_id) {
    return { ok: false, error: "No overlay template configured" };
  }

  const template = getMotionTemplate(job.overlay_template_id);
  if (!template) return { ok: false, error: "Overlay template not found" };

  const copy = (job.overlay_copy_json as Record<string, string>) ?? {};
  const params = (job.overlay_params_json as Record<string, number | string | boolean>) ?? {};
  const palette = resolvePalette(job);
  const motionRatio = ASPECT_MAP[job.aspect_ratio ?? "16:9"] ?? "landscape_16x9";

  const fps = 30;
  const totalFrames = (job.duration_sec ?? 5) * fps;
  const trimIn = job.trim_in_frame ?? 0;
  const trimOut = job.trim_out_frame ?? totalFrames;
  const durationInFrames = trimOut - trimIn;

  try {
    const result = await renderAndUploadMotion(
      {
        templateId: job.overlay_template_id,
        copy,
        palette,
        aspectRatio: motionRatio,
        transparent: true,
        animationParams: params,
        durationInFrames,
        format: "webm",
      },
      jobId,
      `overlay-${motionRatio}`,
    );

    await db
      .update(videoJobs)
      .set({
        overlay_url: result.url,
        pipeline_stage: "composite",
      })
      .where(eq(videoJobs.id, jobId));

    return { ok: true, overlayUrl: result.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(videoJobs)
      .set({ error_message: `Overlay render failed: ${msg}`, status: "failed" })
      .where(eq(videoJobs.id, jobId));
    return { ok: false, error: msg };
  }
}

export async function compositeVideo(
  jobId: string,
): Promise<{ ok: true; compositeUrl: string } | { ok: false; error: string }> {
  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });
  if (!job) return { ok: false, error: "Job not found" };

  const footageUrl = job.footage_url ?? job.output_url;
  if (!footageUrl) return { ok: false, error: "No footage available" };
  if (!job.overlay_url) return { ok: false, error: "No overlay rendered" };

  try {
    const { compositeWithFfmpeg } = await import("./ffmpeg-composite");
    const result = await compositeWithFfmpeg(footageUrl, job.overlay_url, jobId);

    await db
      .update(videoJobs)
      .set({
        composite_url: result.url,
        pipeline_stage: "export",
        status: "ready",
      })
      .where(eq(videoJobs.id, jobId));

    return { ok: true, compositeUrl: result.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(videoJobs)
      .set({ error_message: `Compositing failed: ${msg}`, status: "failed" })
      .where(eq(videoJobs.id, jobId));
    return { ok: false, error: msg };
  }
}

export async function retryStage(
  jobId: string,
  stage: PipelineStage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });
  if (!job) return { ok: false, error: "Job not found" };

  await db
    .update(videoJobs)
    .set({ status: "queued", error_message: null, pipeline_stage: stage })
    .where(eq(videoJobs.id, jobId));

  switch (stage) {
    case "overlay":
      return renderOverlay(jobId);
    case "composite":
      return compositeVideo(jobId);
    default:
      return { ok: false, error: `Stage "${stage}" cannot be retried from here` };
  }
}

export function getStageLabel(stage: PipelineStage): string {
  const labels: Record<PipelineStage, string> = {
    brief: "Brief",
    footage: "Generating Footage",
    overlay: "Rendering Overlay",
    composite: "Compositing",
    export: "Ready to Export",
    complete: "Complete",
  };
  return labels[stage];
}

export function getStageIndex(stage: PipelineStage): number {
  const order: PipelineStage[] = [
    "brief", "footage", "overlay", "composite", "export", "complete",
  ];
  return order.indexOf(stage);
}

function resolvePalette(job: VideoJobRow): ColourPalette {
  const briefJson = job.brief_json as Record<string, unknown> | null;
  const paletteId = briefJson?.paletteId as string | undefined;
  if (paletteId) {
    const p = getPalette(paletteId);
    if (p) return p;
  }
  return BRAND_PALETTES[0];
}

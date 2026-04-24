"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { videoJobs, type VideoStatus } from "@/lib/db/schema/video-jobs";
import { killSwitches } from "@/lib/kill-switches";
import { buildBriefFromPrompt, type VideoBrief } from "@/lib/video/brief-builder";
import { submitVideoJob, getVideoJobStatus } from "@/lib/video/higgsfield";

type ActionResult<T = void> =
  | { ok: true } & (T extends void ? Record<string, never> : T)
  | { ok: false; error: string };

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return `user:${session.user.id ?? "admin"}`;
}

export async function analyseBriefAction(
  initialPrompt: string,
  brandSource: "superbad" | "client" | "adhoc",
  clientId?: string,
): Promise<ActionResult<{ brief: VideoBrief }>> {
  const by = await requireAdmin();
  if (!by) return { ok: false, error: "Not authorised." };
  if (!killSwitches.llm_calls_enabled) return { ok: false, error: "LLM calls are paused." };

  try {
    const brief = await buildBriefFromPrompt(initialPrompt);
    return { ok: true, brief };
  } catch {
    return { ok: false, error: "Brief analysis failed — try again." };
  }
}

export async function createVideoJobAction(input: {
  initialPrompt: string;
  brief: VideoBrief;
  brandSource: "superbad" | "client" | "adhoc";
  clientId?: string;
}): Promise<ActionResult<{ jobId: string }>> {
  const by = await requireAdmin();
  if (!by) return { ok: false, error: "Not authorised." };

  const jobId = randomUUID();

  await db.insert(videoJobs).values({
    id: jobId,
    video_type: input.brief.videoType,
    engine: input.brief.engine,
    status: "queued",
    initial_prompt: input.initialPrompt,
    resolved_prompt: input.brief.resolvedPrompt,
    brief_json: input.brief as unknown as Record<string, unknown>,
    brand_source: input.brandSource,
    client_id: input.clientId ?? null,
    aspect_ratio: input.brief.aspectRatio,
    duration_sec: input.brief.duration,
    created_at: new Date(),
    queued_at: new Date(),
  });

  if (input.brief.engine === "higgsfield") {
    try {
      const result = await submitVideoJob({
        prompt: input.brief.resolvedPrompt,
        aspectRatio: input.brief.aspectRatio,
        duration: input.brief.duration,
      });

      await db
        .update(videoJobs)
        .set({
          external_job_id: result.jobId,
          status: "generating",
        })
        .where(eq(videoJobs.id, jobId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed";
      await db
        .update(videoJobs)
        .set({ status: "failed", error_message: message })
        .where(eq(videoJobs.id, jobId));
      return { ok: false, error: message };
    }
  }

  revalidatePath("/lite/content/video-studio");
  return { ok: true, jobId };
}

export async function pollVideoJobAction(
  jobId: string,
): Promise<ActionResult<{ status: VideoStatus; outputUrl?: string }>> {
  const by = await requireAdmin();
  if (!by) return { ok: false, error: "Not authorised." };

  const [job] = await db
    .select()
    .from(videoJobs)
    .where(eq(videoJobs.id, jobId))
    .limit(1);

  if (!job) return { ok: false, error: "Job not found." };
  if (job.status === "ready" || job.status === "failed") {
    return { ok: true, status: job.status, outputUrl: job.output_url ?? undefined };
  }
  if (!job.external_job_id) {
    return { ok: true, status: job.status };
  }

  try {
    const result = await getVideoJobStatus(job.external_job_id);

    if (result.status === "completed" && result.outputUrl) {
      const generationMs = job.queued_at
        ? Date.now() - new Date(job.queued_at).getTime()
        : null;

      await db
        .update(videoJobs)
        .set({
          status: "ready",
          output_url: result.outputUrl,
          thumbnail_url: result.thumbnailUrl ?? null,
          credits_used: result.creditsUsed ?? null,
          model_used: result.modelUsed ?? null,
          completed_at: new Date(),
          generation_ms: generationMs,
        })
        .where(eq(videoJobs.id, jobId));

      revalidatePath("/lite/content/video-studio");
      return { ok: true, status: "ready", outputUrl: result.outputUrl };
    }

    if (result.status === "failed") {
      await db
        .update(videoJobs)
        .set({
          status: "failed",
          error_message: result.error ?? "Generation failed",
          completed_at: new Date(),
        })
        .where(eq(videoJobs.id, jobId));

      revalidatePath("/lite/content/video-studio");
      return { ok: true, status: "failed" };
    }

    return { ok: true, status: job.status as VideoStatus };
  } catch {
    return { ok: true, status: job.status as VideoStatus };
  }
}

export async function getVideoLibraryAction(): Promise<
  ActionResult<{ jobs: Array<typeof videoJobs.$inferSelect> }>
> {
  const by = await requireAdmin();
  if (!by) return { ok: false, error: "Not authorised." };

  const jobs = await db
    .select()
    .from(videoJobs)
    .orderBy(desc(videoJobs.created_at))
    .limit(50);

  return { ok: true, jobs };
}

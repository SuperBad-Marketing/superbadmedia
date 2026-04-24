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
import { generateCopy, correctCopy } from "@/lib/content-studio/generate-copy";
import { getTemplate } from "@/lib/content-studio/templates";

const createSchema = z.object({
  brief: z.string().min(1).max(2000),
  contentType: z.enum(CONTENT_TYPES),
  templateId: z.string().optional(),
});

export async function createPostAction(input: z.infer<typeof createSchema>) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const { brief, contentType, templateId } = parsed.data;

  const result = await generateCopy(brief, contentType, templateId);
  if (!result.ok) return { ok: false as const, error: result.error };

  const now = Date.now();
  const id = crypto.randomUUID();

  await db.insert(contentStudioPosts).values({
    id,
    brief,
    content_type: contentType,
    template_id: result.templateId,
    generated_copy_json: result.copy as Record<string, string>,
    correction_history_json: [] as unknown[],
    status: "draft",
    created_at_ms: now,
    updated_at_ms: now,
  });

  revalidatePath("/lite/content/studio");
  return { ok: true as const, postId: id, copy: result.copy, templateId: result.templateId };
}

const correctSchema = z.object({
  postId: z.string().uuid(),
  correction: z.string().min(1).max(2000),
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

  const currentCopy = (post.generated_copy_json ?? {}) as Record<string, string>;
  const result = await correctCopy(currentCopy, parsed.data.correction, template);
  if (!result.ok) return { ok: false as const, error: result.error };

  const history = Array.isArray(post.correction_history_json)
    ? [...(post.correction_history_json as { correction: string; timestamp: number }[])]
    : [];
  history.push({ correction: parsed.data.correction, timestamp: Date.now() });

  await db
    .update(contentStudioPosts)
    .set({
      generated_copy_json: result.copy as Record<string, string>,
      correction_history_json: history as unknown[],
      updated_at_ms: Date.now(),
    })
    .where(eq(contentStudioPosts.id, parsed.data.postId));

  revalidatePath("/lite/content/studio");
  return { ok: true as const, copy: result.copy };
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

  const copy = (post.generated_copy_json ?? {}) as Record<string, string>;

  const { renderAllRatios } = await import("@/lib/content-studio/render-image");
  const { uploadRenderBuffer } = await import("@/lib/content-studio/upload");

  const renders = await renderAllRatios(post.template_id, copy, parsed.data.ratios);
  const now = Date.now();
  const insertedRenders: { id: string; ratio: AspectRatio; url: string }[] = [];

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
      ratio,
      url: cloudinaryUrl ?? "",
    });
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

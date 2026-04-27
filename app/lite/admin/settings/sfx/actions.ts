"use server";

import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sfxLibrary } from "@/lib/db/schema";
import { auth } from "@/lib/auth/session";
import type { SfxSound } from "@/lib/content-studio/motion/types";
import { BUILTIN_SFX } from "@/lib/content-studio/motion/types";

export async function getSfxLibraryAction(): Promise<{
  ok: true;
  sounds: SfxSound[];
}> {
  const rows = await db
    .select()
    .from(sfxLibrary)
    .orderBy(asc(sfxLibrary.sort_order), asc(sfxLibrary.created_at_ms));

  const custom: SfxSound[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    fileUrl: r.file_url,
    color: r.color,
    isBuiltin: false,
  }));

  return { ok: true, sounds: [...BUILTIN_SFX, ...custom] };
}

const addSfxSchema = z.object({
  name: z.string().min(1).max(60),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  fileUrl: z.string().url(),
  cloudinaryPublicId: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function addSfxAction(input: z.infer<typeof addSfxSchema>) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = addSfxSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const existing = await db
    .select()
    .from(sfxLibrary)
    .where(eq(sfxLibrary.slug, parsed.data.slug));
  if (existing.length > 0) {
    return { ok: false as const, error: "Slug already exists." };
  }

  const builtinSlugs = BUILTIN_SFX.map((s) => s.slug);
  if (builtinSlugs.includes(parsed.data.slug)) {
    return { ok: false as const, error: "That slug is reserved." };
  }

  const count = await db.select().from(sfxLibrary);
  const id = crypto.randomUUID();

  await db.insert(sfxLibrary).values({
    id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    file_url: parsed.data.fileUrl,
    cloudinary_public_id: parsed.data.cloudinaryPublicId ?? null,
    color: parsed.data.color,
    sort_order: count.length,
    created_at_ms: Date.now(),
  });

  return { ok: true as const, id };
}

export async function deleteSfxAction(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  await db.delete(sfxLibrary).where(eq(sfxLibrary.id, id));
  return { ok: true as const };
}

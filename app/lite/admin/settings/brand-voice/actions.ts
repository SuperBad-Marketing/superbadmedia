"use server";

import { randomUUID } from "node:crypto";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { brand_voice_examples } from "@/lib/db/schema/brand-voice-examples";

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return !!session?.user && session.user.role === "admin";
}

function revalidate() {
  revalidatePath("/lite/admin/settings/brand-voice");
}

export async function createExampleAction(input: {
  surface: string;
  title: string;
  body_markdown: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  const title = input.title.trim();
  const body = input.body_markdown.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (!body) return { ok: false, error: "Example body is required." };

  const existing = await db
    .select({ sort_order: brand_voice_examples.sort_order })
    .from(brand_voice_examples)
    .where(eq(brand_voice_examples.surface, input.surface))
    .orderBy(asc(brand_voice_examples.sort_order));

  const maxOrder =
    existing.length > 0 ? existing[existing.length - 1].sort_order : -1;

  const id = randomUUID();
  const now = Date.now();
  await db.insert(brand_voice_examples).values({
    id,
    surface: input.surface,
    title,
    body_markdown: body,
    sort_order: maxOrder + 1,
    created_at_ms: now,
    updated_at_ms: now,
  });

  revalidate();
  return { ok: true, data: { id } };
}

export async function updateExampleAction(
  id: string,
  input: { title: string; body_markdown: string },
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  const title = input.title.trim();
  const body = input.body_markdown.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (!body) return { ok: false, error: "Example body is required." };

  await db
    .update(brand_voice_examples)
    .set({ title, body_markdown: body, updated_at_ms: Date.now() })
    .where(eq(brand_voice_examples.id, id));

  revalidate();
  return { ok: true, data: null };
}

export async function deleteExampleAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  await db
    .delete(brand_voice_examples)
    .where(eq(brand_voice_examples.id, id));

  revalidate();
  return { ok: true, data: null };
}

export async function reorderExamplesAction(
  surface: string,
  orderedIds: string[],
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };

  const now = Date.now();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(brand_voice_examples)
      .set({ sort_order: i, updated_at_ms: now })
      .where(eq(brand_voice_examples.id, orderedIds[i]));
  }

  revalidate();
  return { ok: true, data: null };
}

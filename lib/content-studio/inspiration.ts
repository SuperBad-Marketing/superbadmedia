"use server";

import { db } from "@/lib/db";
import { inspirationLibrary } from "@/lib/db/schema/inspiration-library";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth/session";

export async function addInspirationLink(url: string, title?: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  let resolvedTitle = title || url;
  let thumbnailUrl: string | null = null;
  let description: string | null = null;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SuperBad-ContentStudio/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      const ogTitle = html.match(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
      )?.[1];
      const ogImage = html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      )?.[1];
      const ogDesc = html.match(
        /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      )?.[1];
      if (ogTitle) resolvedTitle = ogTitle;
      if (ogImage) thumbnailUrl = ogImage;
      if (ogDesc) description = ogDesc;
    }
  } catch {
    // Scrape failed — proceed with URL as title
  }

  const id = crypto.randomUUID();
  await db.insert(inspirationLibrary).values({
    id,
    source_type: "link",
    source_url: url,
    thumbnail_url: thumbnailUrl,
    title: resolvedTitle,
    description,
    tags: null,
    created_at_ms: Date.now(),
  });

  return {
    ok: true as const,
    ref: {
      id,
      source_type: "link" as const,
      source_url: url,
      thumbnail_url: thumbnailUrl,
      title: resolvedTitle,
      description,
    },
  };
}

export async function addInspirationUpload(
  cloudinaryUrl: string,
  title: string,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const id = crypto.randomUUID();
  await db.insert(inspirationLibrary).values({
    id,
    source_type: "upload",
    source_url: cloudinaryUrl,
    thumbnail_url: cloudinaryUrl,
    title,
    description: null,
    tags: null,
    created_at_ms: Date.now(),
  });

  return {
    ok: true as const,
    ref: {
      id,
      source_type: "upload" as const,
      source_url: cloudinaryUrl,
      thumbnail_url: cloudinaryUrl,
      title,
      description: null,
    },
  };
}

export async function listInspirationLibrary() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const items = await db
    .select()
    .from(inspirationLibrary)
    .orderBy(desc(inspirationLibrary.created_at_ms))
    .limit(100);

  return { ok: true as const, items };
}

export async function deleteInspirationRef(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  await db.delete(inspirationLibrary).where(eq(inspirationLibrary.id, id));
  return { ok: true as const };
}

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { instagram_accounts, instagram_media } from "@/lib/db/schema/instagram";
import {
  createMediaContainer,
  publishMedia,
  getContainerStatus,
} from "./client";

export type PublishResult =
  | { ok: true; igMediaId: string; mediaRowId: string; permalink: string | null }
  | { ok: false; error: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForContainer(
  containerId: string,
  accessToken: string,
  maxWaitMs = 30_000,
): Promise<{ ready: boolean; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await getContainerStatus(containerId, accessToken);
    if (!res.ok) return { ready: false, error: res.error };
    if (res.data.status_code === "FINISHED") return { ready: true };
    if (res.data.status_code === "ERROR")
      return { ready: false, error: "Container processing failed" };
    await sleep(2000);
  }
  return { ready: false, error: "Container processing timed out" };
}

export async function publishSingleImage(
  accountId: string,
  imageUrl: string,
  caption: string,
  opts?: { altText?: string; sourcePostId?: string },
): Promise<PublishResult> {
  const account = await db.query.instagram_accounts.findFirst({
    where: eq(instagram_accounts.id, accountId),
  });
  if (!account) return { ok: false, error: "Account not found." };
  if (account.status !== "active")
    return { ok: false, error: "Account is not active." };

  const containerRes = await createMediaContainer(
    account.instagram_user_id,
    account.access_token,
    {
      image_url: imageUrl,
      caption,
      alt_text: opts?.altText,
    },
  );
  if (!containerRes.ok) return { ok: false, error: containerRes.error };

  const { ready, error: waitError } = await waitForContainer(
    containerRes.data.id,
    account.access_token,
  );
  if (!ready)
    return { ok: false, error: waitError ?? "Container not ready." };

  const pubRes = await publishMedia(
    account.instagram_user_id,
    account.access_token,
    containerRes.data.id,
  );
  if (!pubRes.ok) return { ok: false, error: pubRes.error };

  const mediaRowId = randomUUID();
  await db.insert(instagram_media).values({
    id: mediaRowId,
    account_id: accountId,
    ig_media_id: pubRes.data.id,
    media_type: "IMAGE",
    source_post_id: opts?.sourcePostId ?? null,
    caption,
    permalink: null,
    thumbnail_url: imageUrl,
    published_at_ms: Date.now(),
    boost_status: "none",
    last_synced_at_ms: Date.now(),
  });

  return { ok: true, igMediaId: pubRes.data.id, mediaRowId, permalink: null };
}

export async function publishCarousel(
  accountId: string,
  imageUrls: string[],
  caption: string,
  opts?: { altTexts?: string[]; sourcePostId?: string },
): Promise<PublishResult> {
  if (imageUrls.length < 2)
    return { ok: false, error: "Carousels need at least 2 images." };
  if (imageUrls.length > 10)
    return { ok: false, error: "Instagram carousels support max 10 slides." };

  const account = await db.query.instagram_accounts.findFirst({
    where: eq(instagram_accounts.id, accountId),
  });
  if (!account) return { ok: false, error: "Account not found." };
  if (account.status !== "active")
    return { ok: false, error: "Account is not active." };

  const childIds: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const childRes = await createMediaContainer(
      account.instagram_user_id,
      account.access_token,
      {
        image_url: imageUrls[i],
        is_carousel_item: true,
        alt_text: opts?.altTexts?.[i],
      },
    );
    if (!childRes.ok)
      return { ok: false, error: `Slide ${i + 1}: ${childRes.error}` };
    childIds.push(childRes.data.id);
  }

  const carouselRes = await createMediaContainer(
    account.instagram_user_id,
    account.access_token,
    {
      media_type: "CAROUSEL",
      caption,
      children: childIds,
    },
  );
  if (!carouselRes.ok) return { ok: false, error: carouselRes.error };

  const { ready, error: waitError } = await waitForContainer(
    carouselRes.data.id,
    account.access_token,
  );
  if (!ready)
    return { ok: false, error: waitError ?? "Carousel not ready." };

  const pubRes = await publishMedia(
    account.instagram_user_id,
    account.access_token,
    carouselRes.data.id,
  );
  if (!pubRes.ok) return { ok: false, error: pubRes.error };

  const mediaRowId = randomUUID();
  await db.insert(instagram_media).values({
    id: mediaRowId,
    account_id: accountId,
    ig_media_id: pubRes.data.id,
    media_type: "CAROUSEL_ALBUM",
    source_post_id: opts?.sourcePostId ?? null,
    caption,
    permalink: null,
    thumbnail_url: imageUrls[0],
    published_at_ms: Date.now(),
    boost_status: "none",
    last_synced_at_ms: Date.now(),
  });

  return { ok: true, igMediaId: pubRes.data.id, mediaRowId, permalink: null };
}

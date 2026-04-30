import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  instagram_accounts,
  instagram_metrics_snapshots,
  instagram_media,
} from "@/lib/db/schema/instagram";
import {
  getAccountInfo,
  getAccountInsights,
  getMediaList,
  getMediaInsights,
} from "@/lib/channels/instagram/client";

export const dynamic = "force-dynamic";

interface SyncEvent {
  phase: string;
  progress: number;
  label: string;
  detail?: string;
  followers?: number;
  postsSynced?: number;
  error?: string;
}

export async function POST(): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: SyncEvent) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // Stream closed
        }
      }

      try {
        emit({ phase: "connect", progress: 0, label: "Connecting to Instagram" });

        const account = await db.query.instagram_accounts.findFirst({
          where: (t, { eq: e }) => e(t.status, "active"),
        });
        if (!account) {
          emit({ phase: "error", progress: 0, label: "No active Instagram account.", error: "No active Instagram account." });
          controller.close();
          return;
        }

        emit({ phase: "connect", progress: 8, label: "Account found" });

        const now = Date.now();
        const today = new Date().toISOString().slice(0, 10);

        // Step 1: Account info
        emit({ phase: "metrics", progress: 12, label: "Pulling account metrics" });
        const info = await getAccountInfo(account.instagram_user_id, account.access_token);
        if (!info.ok) {
          emit({ phase: "error", progress: 12, label: `Account info: ${info.error}`, error: info.error });
          controller.close();
          return;
        }
        emit({ phase: "metrics", progress: 22, label: "Account metrics received", detail: `${info.data.followers_count.toLocaleString()} followers` });

        // Step 2: Account insights
        emit({ phase: "insights", progress: 28, label: "Analysing reach & impressions" });
        let reach = 0;
        let impressions = 0;
        let profileViews = 0;

        const insightsResult = await getAccountInsights(
          account.instagram_user_id,
          account.access_token,
          "impressions,reach,profile_views",
          "day",
        );
        if (insightsResult.ok) {
          const metrics = insightsResult.data.data as {
            name: string;
            values: { value: number }[];
          }[];
          for (const m of metrics) {
            const val = m.values?.[m.values.length - 1]?.value ?? 0;
            if (m.name === "reach") reach = val;
            if (m.name === "impressions") impressions = val;
            if (m.name === "profile_views") profileViews = val;
          }
        }
        emit({ phase: "insights", progress: 38, label: "Insights captured" });

        // Step 3: Save snapshot
        emit({ phase: "snapshot", progress: 42, label: "Saving metrics snapshot" });
        const existingSnapshot = await db
          .select({ id: instagram_metrics_snapshots.id })
          .from(instagram_metrics_snapshots)
          .where(eq(instagram_metrics_snapshots.account_id, account.id))
          .limit(1)
          .then((rows) => rows.find(() => true));

        const snapshotId = existingSnapshot?.id ?? randomUUID();
        await db
          .insert(instagram_metrics_snapshots)
          .values({
            id: snapshotId,
            account_id: account.id,
            snapshot_date: today,
            followers: info.data.followers_count,
            reach,
            impressions,
            profile_views: profileViews,
            synced_at_ms: now,
          })
          .onConflictDoUpdate({
            target: instagram_metrics_snapshots.id,
            set: {
              followers: info.data.followers_count,
              reach,
              impressions,
              profile_views: profileViews,
              synced_at_ms: now,
            },
          });
        emit({ phase: "snapshot", progress: 48, label: "Snapshot saved" });

        // Step 4: Sync posts
        emit({ phase: "posts", progress: 50, label: "Syncing posts", detail: "Fetching media list" });
        let postsSynced = 0;
        const mediaResult = await getMediaList(account.instagram_user_id, account.access_token, 25);

        if (mediaResult.ok) {
          const total = mediaResult.data.data.length;
          for (let idx = 0; idx < total; idx++) {
            const media = mediaResult.data.data[idx];
            const postProgress = 50 + Math.round((idx / total) * 45);
            emit({ phase: "posts", progress: postProgress, label: "Syncing posts", detail: `${idx + 1} of ${total}` });

            const insRes = await getMediaInsights(media.id, account.access_token, media.media_type);
            let likes = 0, comments = 0, saves = 0, shares = 0, mediaReach = 0, mediaImpressions = 0, videoViews = 0;

            if (insRes.ok) {
              for (const m of insRes.data.data) {
                const v = m.values?.[0]?.value ?? 0;
                if (m.name === "likes") likes = v;
                if (m.name === "comments") comments = v;
                if (m.name === "saves") saves = v;
                if (m.name === "shares") shares = v;
                if (m.name === "reach") mediaReach = v;
                if (m.name === "impressions") mediaImpressions = v;
                if (m.name === "plays") videoViews = v;
              }
            }

            const existing = await db
              .select({ id: instagram_media.id })
              .from(instagram_media)
              .where(eq(instagram_media.ig_media_id, media.id))
              .limit(1)
              .then((rows) => rows[0] ?? null);

            const publishedMs = new Date((media as { timestamp: string }).timestamp).getTime();
            const caption = (media as { caption?: string }).caption ?? null;
            const permalink = (media as { permalink?: string }).permalink ?? null;
            const thumbnailUrl = (media as { thumbnail_url?: string }).thumbnail_url ?? null;

            if (existing) {
              await db
                .update(instagram_media)
                .set({
                  likes,
                  comments_count: comments,
                  saves,
                  shares,
                  reach: mediaReach,
                  impressions: mediaImpressions,
                  video_views: videoViews || null,
                  last_synced_at_ms: now,
                })
                .where(eq(instagram_media.id, existing.id));
            } else {
              await db.insert(instagram_media).values({
                id: randomUUID(),
                account_id: account.id,
                ig_media_id: media.id,
                media_type: media.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL",
                caption,
                permalink,
                thumbnail_url: thumbnailUrl,
                published_at_ms: publishedMs,
                likes,
                comments_count: comments,
                saves,
                shares,
                reach: mediaReach,
                impressions: mediaImpressions,
                video_views: videoViews || null,
                last_synced_at_ms: now,
              });
            }
            postsSynced++;
          }
        }

        emit({
          phase: "done",
          progress: 100,
          label: "Sync complete",
          followers: info.data.followers_count,
          postsSynced,
        });

        revalidatePath("/lite/content/instagram");
      } catch (err) {
        emit({
          phase: "error",
          progress: 0,
          label: err instanceof Error ? err.message : "Sync failed",
          error: err instanceof Error ? err.message : "Sync failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

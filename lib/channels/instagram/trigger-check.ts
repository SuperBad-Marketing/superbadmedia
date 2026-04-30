import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_comment_triggers,
  instagram_trigger_fires,
} from "@/lib/db/schema/instagram";
import {
  sendPrivateReplyToComment,
  type IGComment,
} from "@/lib/channels/instagram/client";
import type { InstagramAccountRow } from "@/lib/db/schema/instagram";
import { logActivity } from "@/lib/activity-log";
import { getCredential } from "@/lib/integrations/getCredential";

export async function checkAndFireTriggersForComment(
  triggers: (typeof instagram_comment_triggers.$inferSelect)[],
  comment: IGComment,
  account: InstagramAccountRow,
): Promise<void> {
  const userToken = await getCredential("meta");

  for (const trigger of triggers) {
    const alreadyFired = await db
      .select({ id: instagram_trigger_fires.id })
      .from(instagram_trigger_fires)
      .where(
        and(
          eq(instagram_trigger_fires.trigger_id, trigger.id),
          eq(instagram_trigger_fires.ig_comment_id, comment.id),
        ),
      )
      .limit(1);

    if (alreadyFired.length > 0) continue;

    if (
      trigger.trigger_type === "keyword_match" &&
      trigger.keyword &&
      !comment.text.toLowerCase().includes(trigger.keyword.toLowerCase())
    ) {
      continue;
    }

    const fireId = randomUUID();
    let dmSent = false;
    let error: string | null = null;

    try {
      const messagingToken = userToken ?? account.access_token;
      const senderId = account.page_id ?? account.instagram_user_id;
      const dmRes = await sendPrivateReplyToComment(
        senderId,
        messagingToken,
        comment.id,
        trigger.dm_message_text,
      );

      if (dmRes.ok) {
        dmSent = true;
      } else {
        error = dmRes.error;
      }
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Unknown error sending trigger DM";
    }

    await db.insert(instagram_trigger_fires).values({
      id: fireId,
      trigger_id: trigger.id,
      ig_comment_id: comment.id,
      commenter_username: comment.username,
      dm_sent: dmSent,
      error,
      fired_at_ms: Date.now(),
    });

    await db
      .update(instagram_comment_triggers)
      .set({
        fires_count: sql`${instagram_comment_triggers.fires_count} + 1`,
      })
      .where(eq(instagram_comment_triggers.id, trigger.id));

    if (dmSent) {
      await logActivity({
        kind: "instagram_trigger_fired",
        body: `Automation DM sent to @${comment.username} (trigger on comment)`,
        meta: { trigger_id: trigger.id, comment_id: comment.id },
      });
    } else {
      console.error(
        `[instagram-trigger] Trigger fire failed for comment ${comment.id}:`,
        error,
      );
    }
  }
}

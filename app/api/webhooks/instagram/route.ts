import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_accounts,
  instagram_media,
  instagram_comment_triggers,
  instagram_trigger_fires,
} from "@/lib/db/schema/instagram";
import { getComment, type IGComment } from "@/lib/channels/instagram/client";
import {
  processInbound,
  type InboundMessage,
} from "@/lib/channels/instagram/reply-pipeline";
import { sendAllApproved } from "@/lib/channels/instagram/send-reply";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
const APP_SECRET = process.env.META_APP_SECRET ?? "";

function verifySignature(body: string, signature: string | null): boolean {
  if (!APP_SECRET || !signature) return false;
  const expected = createHmac("sha256", APP_SECRET)
    .update(body)
    .digest("hex");
  return signature === `sha256=${expected}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

interface WebhookCommentValue {
  id: string;
  text: string;
  from?: { id: string; username?: string };
  media?: { id: string };
}

interface WebhookEntry {
  id: string;
  time: number;
  changes?: Array<{
    field: string;
    value: WebhookCommentValue;
  }>;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: { mid: string; text?: string };
  }>;
}

interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (APP_SECRET) {
    const sig = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, sig)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  const payload: WebhookPayload = JSON.parse(rawBody);

  if (payload.object !== "instagram") {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // Process async — acknowledge immediately so Meta doesn't retry
  processWebhookEntries(payload.entry).catch((err) =>
    console.error("[instagram-webhook] Processing failed:", err),
  );

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

async function processWebhookEntries(entries: WebhookEntry[]): Promise<void> {
  for (const entry of entries) {
    const igPageId = entry.id;

    const account = await db
      .select()
      .from(instagram_accounts)
      .where(
        and(
          eq(instagram_accounts.instagram_user_id, igPageId),
          eq(instagram_accounts.status, "active"),
        ),
      )
      .get();

    if (!account) continue;

    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === "comments") {
          await handleCommentEvent(account, change.value);
        }
      }
    }

    if (entry.messaging) {
      for (const event of entry.messaging) {
        if (event.message?.text && event.sender.id !== igPageId) {
          await handleMessageEvent(account, event);
        }
      }
    }

    await sendAllApproved(account.id);
  }
}

async function handleCommentEvent(
  account: typeof instagram_accounts.$inferSelect,
  value: WebhookCommentValue,
): Promise<void> {
  const igCommentId = value.id;

  const { instagram_replies } = await import("@/lib/db/schema/instagram");
  const existing = await db
    .select({ id: instagram_replies.id })
    .from(instagram_replies)
    .where(
      and(
        eq(instagram_replies.account_id, account.id),
        eq(instagram_replies.ig_comment_id, igCommentId),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  let comment: IGComment;
  if (value.text && value.from?.username) {
    comment = {
      id: igCommentId,
      text: value.text,
      username: value.from.username,
      timestamp: new Date().toISOString(),
    };
  } else {
    const res = await getComment(igCommentId, account.access_token);
    if (!res.ok) {
      console.error(`[instagram-webhook] Failed to fetch comment ${igCommentId}:`, res.error);
      return;
    }
    comment = res.data;
  }

  if (comment.username.toLowerCase() === account.username.toLowerCase()) return;

  let mediaCaption: string | null = null;
  if (value.media?.id) {
    const media = await db
      .select({ caption: instagram_media.caption })
      .from(instagram_media)
      .where(eq(instagram_media.ig_media_id, value.media.id))
      .get();
    mediaCaption = media?.caption ?? null;
  }

  const activeTriggers = await db
    .select()
    .from(instagram_comment_triggers)
    .where(eq(instagram_comment_triggers.is_active, true));

  if (activeTriggers.length > 0) {
    const { checkAndFireTriggersForComment } = await import(
      "@/lib/channels/instagram/trigger-check"
    );
    await checkAndFireTriggersForComment(activeTriggers, comment, account);
  }

  const msg: InboundMessage = {
    replyType: "comment",
    igCommentId: comment.id,
    inboundText: comment.text,
    inboundAuthor: comment.username,
    mediaCaption,
  };

  await processInbound(account.id, msg);
}

async function handleMessageEvent(
  account: typeof instagram_accounts.$inferSelect,
  event: NonNullable<WebhookEntry["messaging"]>[number],
): Promise<void> {
  const igMessageId = event.message!.mid;
  const text = event.message!.text!;

  const { instagram_replies } = await import("@/lib/db/schema/instagram");
  const existing = await db
    .select({ id: instagram_replies.id })
    .from(instagram_replies)
    .where(
      and(
        eq(instagram_replies.account_id, account.id),
        eq(instagram_replies.ig_message_id, igMessageId),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  const msg: InboundMessage = {
    replyType: "dm",
    igMessageId,
    inboundText: text,
    inboundAuthor: null,
  };

  await processInbound(account.id, msg);
}

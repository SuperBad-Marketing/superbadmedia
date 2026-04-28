import { randomUUID } from "node:crypto";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_replies,
  instagram_voice_corrections,
  type InstagramReplyRow,
} from "@/lib/db/schema/instagram";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";
import settings from "@/lib/settings";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(process.cwd(), "lib/ai/prompts/instagram-channel");

function loadPrompt(name: string): string {
  return readFileSync(join(PROMPTS_DIR, `${name}.md`), "utf-8");
}

// ── Types ────────────────────────────────────────────────────────────────

export type InboundClassification =
  | "lead"
  | "complaint"
  | "collab"
  | "question"
  | "praise"
  | "spam"
  | "simple";

export interface InboundMessage {
  replyType: "comment" | "dm";
  igCommentId?: string | null;
  igConversationId?: string | null;
  igMessageId?: string | null;
  inboundText: string;
  inboundAuthor: string | null;
  mediaCaption?: string | null;
  conversationHistory?: string | null;
}

// ── Classification ───────────────────────────────────────────────────────

const VALID_CLASSIFICATIONS = new Set<InboundClassification>([
  "lead", "complaint", "collab", "question", "praise", "spam", "simple",
]);

export async function classifyInbound(
  msg: InboundMessage,
): Promise<InboundClassification> {
  const systemPrompt = loadPrompt("classify-inbound");

  const userPrompt = [
    `reply_type: ${msg.replyType}`,
    `inbound_text: ${msg.inboundText}`,
    msg.inboundAuthor ? `inbound_author: ${msg.inboundAuthor}` : null,
    msg.mediaCaption ? `media_caption: ${msg.mediaCaption}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await invokeLlmText({
    job: "instagram-classify-inbound",
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 16,
    actorType: "internal",
  });

  const label = raw.trim().toLowerCase() as InboundClassification;
  return VALID_CLASSIFICATIONS.has(label) ? label : "simple";
}

// ── Recent corrections for few-shot learning ─────────────────────────────

async function getRecentCorrections(
  accountId: string,
  replyType: "comment" | "dm",
  limit = 20,
): Promise<string> {
  const rows = await db
    .select({
      ai_draft: instagram_voice_corrections.ai_draft,
      andy_version: instagram_voice_corrections.andy_version,
      correction_note: instagram_voice_corrections.correction_note,
    })
    .from(instagram_voice_corrections)
    .where(
      and(
        eq(instagram_voice_corrections.account_id, accountId),
        eq(instagram_voice_corrections.reply_type, replyType),
      ),
    )
    .orderBy(desc(instagram_voice_corrections.created_at_ms))
    .limit(limit);

  if (rows.length === 0) return "No corrections yet.";

  return rows
    .map((r, i) => {
      let entry = `${i + 1}. AI draft: "${r.ai_draft}" → Andy's version: "${r.andy_version}"`;
      if (r.correction_note) entry += ` (note: ${r.correction_note})`;
      return entry;
    })
    .join("\n");
}

// ── Draft generation ─────────────────────────────────────────────────────

export async function draftReply(
  accountId: string,
  msg: InboundMessage,
  classification: InboundClassification,
): Promise<string> {
  const isComment = msg.replyType === "comment";
  const systemPrompt = loadPrompt(
    isComment ? "draft-comment-reply" : "draft-dm-reply",
  );

  const corrections = await getRecentCorrections(accountId, msg.replyType);

  const parts = [
    `classification: ${classification}`,
    `inbound_text: ${msg.inboundText}`,
    msg.inboundAuthor ? `inbound_author: ${msg.inboundAuthor}` : null,
    isComment && msg.mediaCaption
      ? `media_caption: ${msg.mediaCaption}`
      : null,
    !isComment && msg.conversationHistory
      ? `conversation_history:\n${msg.conversationHistory}`
      : null,
    `recent_corrections:\n${corrections}`,
    `brand_context: SuperBad Marketing — Melbourne marketing agency. Voice: dry, observational, self-deprecating, slow burn. Never explain the joke. Short sentences.`,
  ];

  const userPrompt = parts.filter(Boolean).join("\n\n");

  const raw = await invokeLlmText({
    job: isComment
      ? "instagram-draft-comment-reply"
      : "instagram-draft-dm-reply",
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 256,
    actorType: "internal",
  });

  return raw.trim();
}

// ── Escalation summary ──────────────────────────────────────────────────

export async function generateEscalationSummary(
  msg: InboundMessage,
  classification: InboundClassification,
): Promise<string> {
  const systemPrompt = loadPrompt("escalation-summary");

  const parts = [
    `reply_type: ${msg.replyType}`,
    `classification: ${classification}`,
    `inbound_text: ${msg.inboundText}`,
    msg.inboundAuthor ? `inbound_author: ${msg.inboundAuthor}` : null,
    msg.mediaCaption ? `media_caption: ${msg.mediaCaption}` : null,
    msg.conversationHistory
      ? `conversation_history:\n${msg.conversationHistory}`
      : null,
  ];

  return invokeLlmText({
    job: "instagram-escalation-summary",
    system: systemPrompt,
    prompt: parts.filter(Boolean).join("\n\n"),
    maxTokens: 256,
    actorType: "internal",
  });
}

// ── Full pipeline ────────────────────────────────────────────────────────

export interface ProcessResult {
  replyRow: InstagramReplyRow;
  classification: InboundClassification;
  action: "queued" | "sent" | "escalated" | "skipped";
}

export async function processInbound(
  accountId: string,
  msg: InboundMessage,
): Promise<ProcessResult> {
  const classification = await classifyInbound(msg);

  if (classification === "spam") {
    const replyRow = await insertReply(accountId, msg, classification, "", "skipped");
    return { replyRow, classification, action: "skipped" };
  }

  if (classification === "complaint" || classification === "collab") {
    const summary = await generateEscalationSummary(msg, classification);
    const holdingReply =
      classification === "collab"
        ? await draftReply(accountId, msg, classification)
        : "";

    const replyRow = await insertReply(
      accountId,
      msg,
      classification,
      holdingReply || summary,
      "escalated",
    );

    await db
      .update(instagram_replies)
      .set({ escalated_at_ms: Date.now() })
      .where(eq(instagram_replies.id, replyRow.id));

    await logActivity({
      kind: "instagram_reply_escalated",
      body: `${classification} from @${msg.inboundAuthor ?? "unknown"}: ${msg.inboundText.slice(0, 120)}`,
      meta: { reply_id: replyRow.id, classification, summary },
    });

    return { replyRow, classification, action: "escalated" };
  }

  const draftText = await draftReply(accountId, msg, classification);

  const mode = await settings.get(
    msg.replyType === "comment"
      ? "instagram.reply.comment_mode"
      : "instagram.reply.dm_mode",
  );

  const isAutonomous = mode === "autonomous" && classification === "simple"
    ? true
    : mode === "autonomous";

  if (isAutonomous) {
    const replyRow = await insertReply(
      accountId, msg, classification, draftText, "approved",
    );
    return { replyRow, classification, action: "sent" };
  }

  const replyRow = await insertReply(
    accountId, msg, classification, draftText, "pending_review",
  );

  await logActivity({
    kind: "instagram_reply_drafted",
    body: `${msg.replyType} reply drafted for @${msg.inboundAuthor ?? "unknown"} (${classification})`,
    meta: { reply_id: replyRow.id, classification },
  });

  return { replyRow, classification, action: "queued" };
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function insertReply(
  accountId: string,
  msg: InboundMessage,
  classification: InboundClassification,
  draftText: string,
  status: "pending_review" | "approved" | "escalated" | "skipped",
): Promise<InstagramReplyRow> {
  const id = randomUUID();
  const [row] = await db
    .insert(instagram_replies)
    .values({
      id,
      account_id: accountId,
      ig_comment_id: msg.igCommentId ?? null,
      ig_conversation_id: msg.igConversationId ?? null,
      ig_message_id: msg.igMessageId ?? null,
      reply_type: msg.replyType,
      inbound_text: msg.inboundText,
      inbound_author: msg.inboundAuthor ?? null,
      classification,
      draft_text: draftText || "(no draft)",
      status,
      created_at_ms: Date.now(),
    })
    .returning();
  return row;
}

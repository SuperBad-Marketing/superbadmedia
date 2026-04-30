import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { invokeLlmText } from "@/lib/ai/invoke";
import { cancelPendingSequenceForSession } from "./sequence-cancel";
import { logActivity } from "@/lib/activity-log";

const REPLY_CLASSIFICATIONS = [
  "positive",
  "question",
  "objection",
  "unsubscribe",
  "auto_reply",
  "negative",
] as const;

type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];

export interface HandleRundownReplyResult {
  matched: boolean;
  classification?: ReplyClassification;
  sessionId?: string;
  emailId?: string;
}

export async function handleRundownSequenceReply(
  senderEmail: string,
  replyText: string,
  inReplyToMessageId: string | null,
): Promise<HandleRundownReplyResult> {
  const normalised = senderEmail.toLowerCase().trim();

  let seqEmail = inReplyToMessageId
    ? await db
        .select()
        .from(rundown_sequence_emails)
        .where(eq(rundown_sequence_emails.resend_message_id, inReplyToMessageId))
        .then((rows) => rows[0] ?? null)
    : null;

  if (!seqEmail) {
    const session = await db
      .select({ id: rundownSessions.id })
      .from(rundownSessions)
      .where(eq(rundownSessions.email_normalised, normalised))
      .then((rows) => rows[0] ?? null);

    if (!session) return { matched: false };

    seqEmail = await db
      .select()
      .from(rundown_sequence_emails)
      .where(eq(rundown_sequence_emails.session_id, session.id))
      .orderBy(rundown_sequence_emails.email_number)
      .then((rows) => rows.filter((r) => r.status === "sent").pop() ?? null);

    if (!seqEmail) return { matched: false };
  }

  const classification = await classifyReply(replyText);
  const now = Date.now();

  await db
    .update(rundown_sequence_emails)
    .set({
      reply_received_at_ms: now,
      reply_classification: classification,
    })
    .where(eq(rundown_sequence_emails.id, seqEmail.id));

  await cancelPendingSequenceForSession(
    seqEmail.session_id,
    `reply_received:${classification}`,
  );

  await logActivity({
    kind: "rundown_sequence_cancelled",
    body: `Reply received on sequence email ${seqEmail.email_number} (${classification}), remaining emails cancelled`,
    meta: {
      emailId: seqEmail.id,
      sessionId: seqEmail.session_id,
      classification,
      senderEmail: normalised,
    },
  });

  return {
    matched: true,
    classification,
    sessionId: seqEmail.session_id,
    emailId: seqEmail.id,
  };
}

async function classifyReply(text: string): Promise<ReplyClassification> {
  try {
    const raw = await invokeLlmText({
      job: "rundown-sequence-classify-reply",
      maxTokens: 20,
      system: `Classify this email reply into exactly one category. Respond with ONLY the category name, nothing else.

Categories:
- positive: interested, wants to learn more, asks to meet
- question: asks a specific question about services or pricing
- objection: pushback on price, timing, or relevance
- unsubscribe: asks to stop emails or be removed
- auto_reply: out of office, delivery failure, automated response
- negative: rude, hostile, or clearly not interested`,
      prompt: text.slice(0, 500),
    });

    const normalised = raw.toLowerCase().trim().replace(/[^a-z_]/g, "");
    if (REPLY_CLASSIFICATIONS.includes(normalised as ReplyClassification)) {
      return normalised as ReplyClassification;
    }
    return "positive";
  } catch {
    return "positive";
  }
}

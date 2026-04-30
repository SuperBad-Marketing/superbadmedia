import { db } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { replyDrafts } from "@/lib/db/schema/reply-drafts";
import { eq, desc, and, isNotNull } from "drizzle-orm";

export interface InboxSendItem {
  kind: "sent";
  id: string;
  candidateId: string;
  companyName: string;
  domain: string | null;
  contactEmail: string | null;
  track: string;
  subject: string;
  bodyMarkdown: string;
  touchKind: string;
  touchIndex: number;
  sentAt: Date;
  deliveredAt: Date | null;
  openCount: number;
  clickCount: number;
  repliedAt: Date | null;
  bouncedAt: Date | null;
  sequenceStatus: string | null;
}

export interface InboxReplyItem {
  kind: "reply";
  id: string;
  candidateId: string;
  companyName: string;
  domain: string | null;
  contactEmail: string | null;
  track: string;
  classification: string;
  prospectReplyText: string;
  responseSubject: string;
  responseBody: string;
  responseStatus: string;
  createdAtMs: number;
}

export type InboxItem = InboxSendItem | InboxReplyItem;

export async function getInboxItems(limit = 100): Promise<InboxItem[]> {
  const [sends, replies] = await Promise.all([
    getRecentSends(limit),
    getRecentReplies(limit),
  ]);

  const combined: InboxItem[] = [...sends, ...replies];

  combined.sort((a, b) => {
    const aTime = a.kind === "sent" ? a.sentAt.getTime() : a.createdAtMs;
    const bTime = b.kind === "sent" ? b.sentAt.getTime() : b.createdAtMs;
    return bTime - aTime;
  });

  return combined.slice(0, limit);
}

async function getRecentSends(limit: number): Promise<InboxSendItem[]> {
  const rows = await db
    .select({
      sendId: outreachSends.id,
      candidateId: outreachDrafts.candidate_id,
      subject: outreachDrafts.subject,
      bodyMarkdown: outreachDrafts.body_markdown,
      touchKind: outreachDrafts.touch_kind,
      touchIndex: outreachDrafts.touch_index,
      sentAt: outreachSends.sent_at,
      deliveredAt: outreachSends.delivered_at,
      openCount: outreachSends.open_count,
      clickCount: outreachSends.click_count,
      repliedAt: outreachSends.replied_at,
      bouncedAt: outreachSends.bounced_at,
      sequenceId: outreachSends.sequence_id,
      companyName: leadCandidates.company_name,
      domain: leadCandidates.domain,
      contactEmail: leadCandidates.contact_email,
      track: leadCandidates.qualified_track,
    })
    .from(outreachSends)
    .innerJoin(outreachDrafts, eq(outreachSends.draft_id, outreachDrafts.id))
    .innerJoin(
      leadCandidates,
      eq(outreachDrafts.candidate_id, leadCandidates.id),
    )
    .orderBy(desc(outreachSends.sent_at))
    .limit(limit);

  const sequenceIds = [...new Set(rows.map((r) => r.sequenceId))];
  const seqMap = new Map<string, string>();
  if (sequenceIds.length > 0) {
    const seqs = await db
      .select({ id: outreachSequences.id, status: outreachSequences.status })
      .from(outreachSequences);
    for (const s of seqs) seqMap.set(s.id, s.status);
  }

  return rows.map((r) => ({
    kind: "sent" as const,
    id: r.sendId,
    candidateId: r.candidateId!,
    companyName: r.companyName,
    domain: r.domain,
    contactEmail: r.contactEmail,
    track: r.track,
    subject: r.subject,
    bodyMarkdown: r.bodyMarkdown,
    touchKind: r.touchKind,
    touchIndex: r.touchIndex,
    sentAt: r.sentAt,
    deliveredAt: r.deliveredAt,
    openCount: r.openCount,
    clickCount: r.clickCount,
    repliedAt: r.repliedAt,
    bouncedAt: r.bouncedAt,
    sequenceStatus: seqMap.get(r.sequenceId) ?? null,
  }));
}

async function getRecentReplies(limit: number): Promise<InboxReplyItem[]> {
  const rows = await db
    .select({
      replyId: replyDrafts.id,
      candidateId: replyDrafts.candidate_id,
      classification: replyDrafts.prospect_reply_classification,
      prospectReplyText: replyDrafts.prospect_reply_text,
      responseSubject: replyDrafts.subject,
      responseBody: replyDrafts.body_markdown,
      responseStatus: replyDrafts.status,
      createdAtMs: replyDrafts.created_at_ms,
      companyName: leadCandidates.company_name,
      domain: leadCandidates.domain,
      contactEmail: leadCandidates.contact_email,
      track: leadCandidates.qualified_track,
    })
    .from(replyDrafts)
    .innerJoin(leadCandidates, eq(replyDrafts.candidate_id, leadCandidates.id))
    .orderBy(desc(replyDrafts.created_at_ms))
    .limit(limit);

  return rows.map((r) => ({
    kind: "reply" as const,
    id: r.replyId,
    candidateId: r.candidateId,
    companyName: r.companyName,
    domain: r.domain,
    contactEmail: r.contactEmail,
    track: r.track,
    classification: r.classification,
    prospectReplyText: r.prospectReplyText,
    responseSubject: r.responseSubject,
    responseBody: r.responseBody,
    responseStatus: r.responseStatus,
    createdAtMs: r.createdAtMs,
  }));
}

export async function getInboxSummary() {
  const [sends, replies] = await Promise.all([
    db
      .select({ id: outreachSends.id })
      .from(outreachSends),
    db
      .select({ id: replyDrafts.id })
      .from(replyDrafts),
  ]);

  const pendingReplies = await db
    .select({ id: replyDrafts.id })
    .from(replyDrafts)
    .where(eq(replyDrafts.status, "pending_approval"));

  return {
    totalSent: sends.length,
    totalReplies: replies.length,
    pendingReplyDrafts: pendingReplies.length,
  };
}

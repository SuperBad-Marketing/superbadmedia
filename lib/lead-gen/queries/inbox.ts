import { db } from "@/lib/db";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { replyDrafts } from "@/lib/db/schema/reply-drafts";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { eq, desc, isNotNull } from "drizzle-orm";

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

export interface InboxRundownItem {
  kind: "rundown";
  id: string;
  sessionId: string;
  candidateId: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  emailNumber: number;
  track: string;
  subject: string | null;
  bodyHtml: string | null;
  sentAtMs: number;
  openedAtMs: number | null;
  openCount: number;
  clickedAtMs: number | null;
  repliedAtMs: number | null;
  replyClassification: string | null;
}

export type InboxItem = InboxSendItem | InboxReplyItem | InboxRundownItem;

function itemTimestamp(item: InboxItem): number {
  if (item.kind === "sent") return item.sentAt.getTime();
  if (item.kind === "rundown") return item.sentAtMs;
  return item.createdAtMs;
}

export async function getInboxItems(limit = 100): Promise<InboxItem[]> {
  const [sends, replies, rundowns] = await Promise.all([
    getRecentSends(limit),
    getRecentReplies(limit),
    getRecentRundownSends(limit),
  ]);

  const combined: InboxItem[] = [...sends, ...replies, ...rundowns];
  combined.sort((a, b) => itemTimestamp(b) - itemTimestamp(a));

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

async function getRecentRundownSends(
  limit: number,
): Promise<InboxRundownItem[]> {
  const rows = await db
    .select({
      emailId: rundown_sequence_emails.id,
      sessionId: rundown_sequence_emails.session_id,
      candidateId: rundown_sequence_emails.candidate_id,
      emailNumber: rundown_sequence_emails.email_number,
      track: rundown_sequence_emails.track,
      subject: rundown_sequence_emails.subject,
      bodyHtml: rundown_sequence_emails.body_html,
      sentAtMs: rundown_sequence_emails.sent_at_ms,
      openedAtMs: rundown_sequence_emails.opened_at_ms,
      openCount: rundown_sequence_emails.open_count,
      clickedAtMs: rundown_sequence_emails.clicked_at_ms,
      repliedAtMs: rundown_sequence_emails.reply_received_at_ms,
      replyClassification: rundown_sequence_emails.reply_classification,
      businessName: rundownSessions.business_name,
      contactName: rundownSessions.name,
      contactEmail: rundownSessions.email,
    })
    .from(rundown_sequence_emails)
    .innerJoin(
      rundownSessions,
      eq(rundown_sequence_emails.session_id, rundownSessions.id),
    )
    .where(
      eq(rundown_sequence_emails.status, "sent"),
    )
    .orderBy(desc(rundown_sequence_emails.sent_at_ms))
    .limit(limit);

  return rows
    .filter((r) => r.sentAtMs !== null)
    .map((r) => ({
      kind: "rundown" as const,
      id: r.emailId,
      sessionId: r.sessionId,
      candidateId: r.candidateId,
      businessName: r.businessName,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      emailNumber: r.emailNumber,
      track: r.track,
      subject: r.subject,
      bodyHtml: r.bodyHtml,
      sentAtMs: r.sentAtMs!,
      openedAtMs: r.openedAtMs,
      openCount: r.openCount,
      clickedAtMs: r.clickedAtMs,
      repliedAtMs: r.repliedAtMs,
      replyClassification: r.replyClassification,
    }));
}

export interface InboxSummary {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  totalReplies: number;
  pendingReplyDrafts: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export async function getInboxSummary(): Promise<InboxSummary> {
  const [sendRows, rundownRows, replies, pendingReplies] = await Promise.all([
    db
      .select({
        id: outreachSends.id,
        deliveredAt: outreachSends.delivered_at,
        openCount: outreachSends.open_count,
        clickCount: outreachSends.click_count,
        repliedAt: outreachSends.replied_at,
        bouncedAt: outreachSends.bounced_at,
      })
      .from(outreachSends),
    db
      .select({
        id: rundown_sequence_emails.id,
        openCount: rundown_sequence_emails.open_count,
        clickedAtMs: rundown_sequence_emails.clicked_at_ms,
        repliedAtMs: rundown_sequence_emails.reply_received_at_ms,
      })
      .from(rundown_sequence_emails)
      .where(eq(rundown_sequence_emails.status, "sent")),
    db
      .select({ id: replyDrafts.id })
      .from(replyDrafts),
    db
      .select({ id: replyDrafts.id })
      .from(replyDrafts)
      .where(eq(replyDrafts.status, "pending_approval")),
  ]);

  const outreachSent = sendRows.length;
  const rundownSent = rundownRows.length;
  const totalSent = outreachSent + rundownSent;

  const totalDelivered = sendRows.filter((r) => r.deliveredAt !== null).length;
  const totalOpened =
    sendRows.filter((r) => r.openCount > 0).length +
    rundownRows.filter((r) => r.openCount > 0).length;
  const totalClicked =
    sendRows.filter((r) => r.clickCount > 0).length +
    rundownRows.filter((r) => r.clickedAtMs !== null).length;
  const totalReplied =
    sendRows.filter((r) => r.repliedAt !== null).length +
    rundownRows.filter((r) => r.repliedAtMs !== null).length;
  const totalBounced = sendRows.filter((r) => r.bouncedAt !== null).length;

  const pct = (n: number, base: number) =>
    base > 0 ? Math.round((n / base) * 100) : 0;

  return {
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalReplied,
    totalBounced,
    totalReplies: replies.length,
    pendingReplyDrafts: pendingReplies.length,
    deliveryRate: pct(totalDelivered, outreachSent),
    openRate: pct(totalOpened, totalSent),
    clickRate: pct(totalClicked, totalSent),
    replyRate: pct(totalReplied, totalSent),
    bounceRate: pct(totalBounced, outreachSent),
  };
}

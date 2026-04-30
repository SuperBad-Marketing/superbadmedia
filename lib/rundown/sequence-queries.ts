import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";

export interface SequenceEmailStatus {
  id: string;
  emailNumber: number;
  track: string;
  status: string;
  subject: string | null;
  sentAtMs: number | null;
  openedAtMs: number | null;
  openCount: number;
  clickedAtMs: number | null;
  clickedLinks: string[];
  replyReceivedAtMs: number | null;
  replyClassification: string | null;
  cancelledAtMs: number | null;
  cancelReason: string | null;
}

export async function getSequenceEmailsForCandidate(
  candidateId: string,
): Promise<SequenceEmailStatus[]> {
  const rows = await db
    .select()
    .from(rundown_sequence_emails)
    .where(eq(rundown_sequence_emails.candidate_id, candidateId))
    .orderBy(rundown_sequence_emails.email_number);

  return rows.map((r) => ({
    id: r.id,
    emailNumber: r.email_number,
    track: r.track,
    status: r.status,
    subject: r.subject,
    sentAtMs: r.sent_at_ms,
    openedAtMs: r.opened_at_ms,
    openCount: r.open_count,
    clickedAtMs: r.clicked_at_ms,
    clickedLinks: (r.clicked_links ?? []) as string[],
    replyReceivedAtMs: r.reply_received_at_ms,
    replyClassification: r.reply_classification,
    cancelledAtMs: r.cancelled_at_ms,
    cancelReason: r.cancel_reason,
  }));
}

export interface RundownSequenceMetrics {
  totalScheduled: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalCancelled: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  byEmailNumber: {
    emailNumber: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
  }[];
  replyClassifications: Record<string, number>;
}

export async function getRundownSequenceMetrics(): Promise<RundownSequenceMetrics> {
  const allEmails = await db.select().from(rundown_sequence_emails);

  const sent = allEmails.filter((e) => e.status === "sent");
  const opened = sent.filter((e) => e.opened_at_ms !== null);
  const clicked = sent.filter((e) => e.clicked_at_ms !== null);
  const replied = allEmails.filter((e) => e.reply_received_at_ms !== null);
  const cancelled = allEmails.filter((e) => e.status === "cancelled");

  const byEmailNumber = [1, 2, 3].map((num) => {
    const numEmails = sent.filter((e) => e.email_number === num);
    return {
      emailNumber: num,
      sent: numEmails.length,
      opened: numEmails.filter((e) => e.opened_at_ms !== null).length,
      clicked: numEmails.filter((e) => e.clicked_at_ms !== null).length,
      replied: numEmails.filter((e) => e.reply_received_at_ms !== null).length,
    };
  });

  const replyClassifications: Record<string, number> = {};
  for (const e of replied) {
    const cls = e.reply_classification ?? "unknown";
    replyClassifications[cls] = (replyClassifications[cls] ?? 0) + 1;
  }

  const sentCount = sent.length;

  return {
    totalScheduled: allEmails.length,
    totalSent: sentCount,
    totalOpened: opened.length,
    totalClicked: clicked.length,
    totalReplied: replied.length,
    totalCancelled: cancelled.length,
    openRate: sentCount > 0 ? Math.round((opened.length / sentCount) * 100) : 0,
    clickRate: sentCount > 0 ? Math.round((clicked.length / sentCount) * 100) : 0,
    replyRate: sentCount > 0 ? Math.round((replied.length / sentCount) * 100) : 0,
    byEmailNumber,
    replyClassifications,
  };
}

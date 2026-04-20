import { redirect } from "next/navigation";
import { eq, and, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { invite_drafts } from "@/lib/db/schema/invite-drafts";
import { candidates } from "@/lib/db/schema/candidates";
import { role_briefs } from "@/lib/db/schema/role-briefs";
import {
  DraftsQueueClient,
  type DraftQueueRow,
} from "@/components/lite/hiring-pipeline/drafts-queue-client";

export const metadata: Metadata = {
  title: "SuperBad — Invite Drafts",
  robots: { index: false, follow: false },
};

export default async function DraftsQueuePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const drafts = await db
    .select({
      id: invite_drafts.id,
      candidate_id: invite_drafts.candidate_id,
      candidate_name: candidates.name,
      role_brief_id: invite_drafts.role_brief_id,
      role_name: role_briefs.role_name,
      subject: invite_drafts.subject,
      body: invite_drafts.body,
      confidence: invite_drafts.confidence,
      hold_reason: invite_drafts.hold_reason,
      drift_check_score: invite_drafts.drift_check_score,
      drift_check_pass: invite_drafts.drift_check_pass,
      created_at_ms: invite_drafts.created_at_ms,
    })
    .from(invite_drafts)
    .innerJoin(candidates, eq(invite_drafts.candidate_id, candidates.id))
    .leftJoin(role_briefs, eq(invite_drafts.role_brief_id, role_briefs.id))
    .where(eq(invite_drafts.status, "pending_review"))
    .orderBy(invite_drafts.created_at_ms)
    .all();

  const rows: DraftQueueRow[] = drafts.map((d) => ({
    id: d.id,
    candidate_id: d.candidate_id,
    candidate_name: d.candidate_name,
    role_name: d.role_name ?? "—",
    subject: d.subject,
    body: d.body,
    confidence: d.confidence,
    hold_reason: d.hold_reason,
    drift_check_score: d.drift_check_score,
    drift_check_pass: d.drift_check_pass,
    created_at_ms: d.created_at_ms,
  }));

  return <DraftsQueueClient rows={rows} />;
}

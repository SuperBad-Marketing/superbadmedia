"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  compliance_milestones,
  type ComplianceMilestoneKind,
} from "@/lib/db/schema/compliance-milestones";
import { logActivity } from "@/lib/activity-log";

export async function markComplianceMilestoneAction(
  kind: ComplianceMilestoneKind,
  periodLabel: string,
  note?: string,
): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  await db
    .insert(compliance_milestones)
    .values({
      id: randomUUID(),
      kind,
      period_label: periodLabel,
      filed_at_ms: Date.now(),
      note: note ?? null,
    })
    .onConflictDoNothing();

  await logActivity({
    kind: "finance_bas_filed",
    body: `${kind === "bas_filed" ? "BAS" : "EOFY"} marked as filed for ${periodLabel}`,
  });
}

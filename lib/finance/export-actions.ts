"use server";

import { randomUUID } from "node:crypto";
import { desc, eq, and, ne } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { finance_exports, type FinanceExportRow } from "@/lib/db/schema/finance-exports";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

export async function requestExportAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const periodStart = formData.get("period_start") as string;
  const periodEnd = formData.get("period_end") as string;
  const periodLabel = formData.get("period_label") as string;

  if (!periodStart || !periodEnd || !periodLabel) {
    throw new Error("Missing required period fields");
  }

  const exportId = randomUUID();
  const nowMs = Date.now();

  await db.insert(finance_exports).values({
    id: exportId,
    period_start: periodStart,
    period_end: periodEnd,
    period_label: periodLabel,
    status: "pending",
    requested_at_ms: nowMs,
    created_at_ms: nowMs,
  });

  await enqueueTask({
    task_type: "finance_export_generate",
    runAt: nowMs,
    idempotencyKey: `finance_export_generate:${exportId}`,
    payload: {
      export_id: exportId,
      period_start: periodStart,
      period_end: periodEnd,
      period_label: periodLabel,
    },
  });
}

export async function getExportStatus(
  exportId: string,
): Promise<FinanceExportRow | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;

  return (
    db
      .select()
      .from(finance_exports)
      .where(eq(finance_exports.id, exportId))
      .get() ?? null
  );
}

export async function getPastExports(): Promise<FinanceExportRow[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return [];

  return db
    .select()
    .from(finance_exports)
    .where(and(ne(finance_exports.status, "purged")))
    .orderBy(desc(finance_exports.created_at_ms))
    .limit(20)
    .all();
}

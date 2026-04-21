export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { finance_exports } from "@/lib/db/schema/finance-exports";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const periodStart = formData.get("period_start") as string;
  const periodEnd = formData.get("period_end") as string;
  const periodLabel = formData.get("period_label") as string;

  if (!periodStart || !periodEnd || !periodLabel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

  return NextResponse.json({ export_id: exportId });
}

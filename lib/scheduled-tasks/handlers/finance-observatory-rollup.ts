import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { and, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { expenses } from "@/lib/db/schema/expenses";
import { logActivity } from "@/lib/activity-log";

const MS_PER_DAY = 86_400_000;

const handleFinanceObservatoryRollup: TaskHandler = async (_task) => {
  const nowMs = Date.now();
  const todayStart = new Date(nowMs);
  todayStart.setUTCHours(0, 0, 0, 0);

  const yesterdayStartMs = todayStart.getTime() - MS_PER_DAY;
  const yesterdayEndMs = todayStart.getTime();

  const yesterdayDate = new Date(yesterdayStartMs).toISOString().slice(0, 10);

  const vendorAggregates = await db
    .select({
      job: external_call_log.job,
      total_aud: sql<number>`sum(${external_call_log.estimated_cost_aud})`,
    })
    .from(external_call_log)
    .where(
      and(
        gte(external_call_log.created_at_ms, yesterdayStartMs),
        lt(external_call_log.created_at_ms, yesterdayEndMs),
      ),
    )
    .groupBy(external_call_log.job);

  let rolledUp = 0;

  for (const row of vendorAggregates) {
    if (!row.total_aud || row.total_aud <= 0) continue;

    const vendor = row.job;
    const amountCents = Math.round(row.total_aud * 100);
    const sourceRef = `${vendor}:${yesterdayDate}`;

    const existing = await db
      .select({ id: expenses.id, manual_override: expenses.manual_override })
      .from(expenses)
      .where(
        and(
          sql`${expenses.source} = 'observatory_rollup'`,
          sql`${expenses.source_ref} = ${sourceRef}`,
        ),
      )
      .limit(1);

    if (existing.length > 0 && existing[0].manual_override) {
      continue;
    }

    const now = Date.now();

    if (existing.length > 0) {
      await db
        .update(expenses)
        .set({
          amount_inc_gst: amountCents,
          gst_amount: null,
          updated_at_ms: now,
        })
        .where(sql`${expenses.id} = ${existing[0].id}`);
    } else {
      const id = crypto.randomUUID();
      await db.insert(expenses).values({
        id,
        amount_inc_gst: amountCents,
        gst_amount: null,
        category: "api_costs",
        vendor,
        description: `API costs rollup — ${yesterdayDate}`,
        expense_date: yesterdayDate,
        source: "observatory_rollup",
        source_ref: sourceRef,
        status: "pending_review",
        manual_override: false,
        receipt_path: null,
        candidate_id: null,
        created_at_ms: now,
        updated_at_ms: now,
      });
    }

    rolledUp++;
  }

  if (rolledUp > 0) {
    await logActivity({
      kind: "finance_expense_created",
      body: `Observatory rollup: ${rolledUp} vendor(s) for ${yesterdayDate}.`,
      meta: { date: yesterdayDate, vendor_count: rolledUp },
    });
  }
};

export const FINANCE_OBSERVATORY_ROLLUP_HANDLERS: HandlerMap = {
  finance_observatory_rollup: handleFinanceObservatoryRollup,
};

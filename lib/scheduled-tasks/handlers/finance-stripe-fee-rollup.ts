import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { logActivity } from "@/lib/activity-log";
import { getStripe } from "@/lib/stripe/client";

const MS_PER_DAY = 86_400_000;

const handleFinanceStripeFeeRollup: TaskHandler = async (_task) => {
  const stripeConn = await db
    .select()
    .from(integration_connections)
    .where(
      and(
        eq(integration_connections.vendor_key, "stripe-admin"),
        eq(integration_connections.status, "active"),
      ),
    )
    .limit(1);

  if (stripeConn.length === 0) return;

  const nowMs = Date.now();
  const todayStart = new Date(nowMs);
  todayStart.setUTCHours(0, 0, 0, 0);

  const yesterdayStartMs = todayStart.getTime() - MS_PER_DAY;
  const yesterdayDate = new Date(yesterdayStartMs).toISOString().slice(0, 10);

  const stripe = getStripe();
  const yesterdayStartSec = Math.floor(yesterdayStartMs / 1000);
  const yesterdayEndSec = Math.floor(todayStart.getTime() / 1000);

  const feesByType: Record<string, number> = {};

  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Record<string, unknown> = {
      created: { gte: yesterdayStartSec, lt: yesterdayEndSec },
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;

    const txns = await stripe.balanceTransactions.list(
      params as Parameters<typeof stripe.balanceTransactions.list>[0],
    );

    for (const txn of txns.data) {
      if (txn.fee <= 0) continue;
      const feeType = txn.type || "other";
      feesByType[feeType] = (feesByType[feeType] ?? 0) + txn.fee;
    }

    hasMore = txns.has_more;
    if (txns.data.length > 0) {
      startingAfter = txns.data[txns.data.length - 1].id;
    }
  }

  let rolledUp = 0;

  for (const [feeType, totalCents] of Object.entries(feesByType)) {
    if (totalCents <= 0) continue;

    const sourceRef = `stripe_fee:${feeType}:${yesterdayDate}`;
    const vendor = `Stripe (${feeType})`;

    const existing = await db
      .select({ id: expenses.id, manual_override: expenses.manual_override })
      .from(expenses)
      .where(
        and(
          sql`${expenses.source} = 'stripe_fees'`,
          sql`${expenses.source_ref} = ${sourceRef}`,
        ),
      )
      .limit(1);

    if (existing.length > 0 && existing[0].manual_override) {
      continue;
    }

    const gstAmount = Math.round(totalCents / 11);
    const now = Date.now();

    if (existing.length > 0) {
      await db
        .update(expenses)
        .set({
          amount_inc_gst: totalCents,
          gst_amount: gstAmount,
          updated_at_ms: now,
        })
        .where(sql`${expenses.id} = ${existing[0].id}`);
    } else {
      const id = crypto.randomUUID();
      await db.insert(expenses).values({
        id,
        amount_inc_gst: totalCents,
        gst_amount: gstAmount,
        category: "payment_processing",
        vendor,
        description: `Stripe ${feeType} fees — ${yesterdayDate}`,
        expense_date: yesterdayDate,
        source: "stripe_fees",
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
      body: `Stripe fee rollup: ${rolledUp} fee type(s) for ${yesterdayDate}.`,
      meta: { date: yesterdayDate, fee_types: Object.keys(feesByType) },
    });
  }
};

export const FINANCE_STRIPE_FEE_ROLLUP_HANDLERS: HandlerMap = {
  finance_stripe_fee_rollup: handleFinanceStripeFeeRollup,
};

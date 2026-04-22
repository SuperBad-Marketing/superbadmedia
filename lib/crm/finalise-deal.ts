import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import {
  deals,
  type DealLossReason,
  type DealRow,
  type DealWonOutcome,
} from "@/lib/db/schema/deals";
import { transitionDealStage } from "./transition-deal-stage";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { createOnboardingCredentials } from "@/lib/onboarding/create-credentials";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface FinaliseWonPayload {
  won_outcome: DealWonOutcome;
  /** Optional — Stripe-driven Wons pass the canonical amount here.
   *  When provided, the deal's `value_cents` is stamped and
   *  `value_estimated` is flipped to `false` (the amount is no longer a
   *  guess, it's what the customer actually paid). Manual Wons omit it. */
  value_cents?: number;
}

export interface FinaliseLostPayload {
  loss_reason: DealLossReason;
  loss_notes: string | null;
}

export interface FinaliseDealOpts {
  /** Actor identity (matches `transitionDealStage`). */
  by: string | null;
  /** Extra structured meta for the `stage_change` activity row. */
  meta?: Record<string, unknown>;
  /** Test override. */
  nowMs?: number;
}

/**
 * Populate finalisation fields (`won_outcome` for Won, `loss_reason` +
 * `loss_notes` for Lost), then transition the deal. Both writes happen
 * inside the same SQLite transaction so a failure leaves the row
 * untouched.
 */
export function finaliseDealAsWon(
  dealId: string,
  payload: FinaliseWonPayload,
  opts: FinaliseDealOpts,
  dbArg: Db = defaultDb,
): DealRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;
  const result: DealRow = database.transaction((tx: Db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;
    const valueUpdate =
      typeof payload.value_cents === "number"
        ? { value_cents: payload.value_cents, value_estimated: false }
        : {};
    const subscriptionUpdate =
      typeof payload.value_cents !== "number"
        ? { subscription_state: "active_current" as const }
        : {};
    txDb
      .update(deals)
      .set({
        won_outcome: payload.won_outcome,
        loss_reason: null,
        loss_notes: null,
        ...valueUpdate,
        ...subscriptionUpdate,
      })
      .where(eq(deals.id, dealId))
      .run();
    return transitionDealStage(
      dealId,
      "won",
      {
        by: opts.by,
        meta: { won_outcome: payload.won_outcome, ...(opts.meta ?? {}) },
        nowMs: opts.nowMs,
      },
      tx,
    );
  });

  if (result.company_id) {
    enqueueTask({
      task_type: "six_week_plan_migrate_on_won",
      runAt: Date.now(),
      payload: { deal_id: dealId, company_id: result.company_id },
      idempotencyKey: `swp_migrate:${dealId}`,
    }).catch(() => {});
  }

  if (result.primary_contact_id && result.company_id) {
    createOnboardingCredentials({
      contactId: result.primary_contact_id,
      companyId: result.company_id,
    }).catch(() => {});
  }

  return result;
}

export function finaliseDealAsLost(
  dealId: string,
  payload: FinaliseLostPayload,
  opts: FinaliseDealOpts,
  dbArg: Db = defaultDb,
): DealRow {
  if (payload.loss_reason === "other") {
    const trimmed = payload.loss_notes?.trim() ?? "";
    if (trimmed.length === 0) {
      throw new Error(
        "finaliseDealAsLost: loss_notes required when loss_reason = 'other'",
      );
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;
  return database.transaction((tx: Db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;
    txDb
      .update(deals)
      .set({
        loss_reason: payload.loss_reason,
        loss_notes: payload.loss_notes,
      })
      .where(eq(deals.id, dealId))
      .run();
    return transitionDealStage(
      dealId,
      "lost",
      {
        by: opts.by,
        meta: {
          loss_reason: payload.loss_reason,
          loss_notes: payload.loss_notes,
          ...(opts.meta ?? {}),
        },
        nowMs: opts.nowMs,
      },
      tx,
    );
  });
}

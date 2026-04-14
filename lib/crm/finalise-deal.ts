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
  return database.transaction((tx: Db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;
    const valueUpdate =
      typeof payload.value_cents === "number"
        ? { value_cents: payload.value_cents, value_estimated: false }
        : {};
    txDb
      .update(deals)
      .set({
        won_outcome: payload.won_outcome,
        // Clear any stale loss fields in case of an earlier Lost that got
        // reversed in a prior session. Terminal-state hygiene.
        loss_reason: null,
        loss_notes: null,
        ...valueUpdate,
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

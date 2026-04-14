import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals, type DealRow, type DealStage } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { validateDeal } from "./validate-deal";

/**
 * Legal-transition matrix per sales-pipeline §3.2/§3.3.
 *
 * - Forward auto-transitions (§3.2) plus manual overrides (§3.3) collapse to
 *   one matrix keyed on the current stage.
 * - `won` is terminal (graduates to Client Management).
 * - `lost` is terminal *except* `lost → lead` which is an explicit rekindle
 *   path per brief §2.
 * - Re-opening a `won` deal is deliberately out of scope for SP-2 (see brief
 *   §4 notes + SP-3+ open thread); consumers must not call this helper to
 *   flip a won deal.
 */
export const LEGAL_TRANSITIONS: Record<DealStage, ReadonlyArray<DealStage>> = {
  lead: ["contacted", "conversation", "trial_shoot", "quoted", "lost"],
  contacted: ["lead", "conversation", "trial_shoot", "quoted", "lost"],
  conversation: [
    "lead",
    "contacted",
    "trial_shoot",
    "quoted",
    "negotiating",
    "lost",
  ],
  trial_shoot: ["conversation", "quoted", "negotiating", "lost"],
  quoted: ["conversation", "trial_shoot", "negotiating", "won", "lost"],
  negotiating: ["conversation", "trial_shoot", "quoted", "won", "lost"],
  won: [],
  lost: ["lead"],
};

export interface TransitionDealStageOpts {
  /** Identity of the actor triggering the transition (user id, webhook tag,
   *  cron name). Stored on both `activity_log.created_by` and `meta.by`. */
  by: string | null;
  /** Extra structured context to merge into the `stage_change` activity row
   *  (e.g. `{ source: "stripe_webhook", event_id: "evt_..." }`). `from_stage`
   *  / `to_stage` / `by` are reserved and overridden. */
  meta?: Record<string, unknown>;
  /** Test-override for `Date.now()`. */
  nowMs?: number;
}

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

/**
 * Apply a stage transition to a deal, validating against `LEGAL_TRANSITIONS`
 * and `validateDeal()`, and write a `stage_change` activity_log row inside
 * the same transaction. Returns the updated `DealRow`.
 *
 * Throws on: missing deal, identity transition (from === to), illegal edge,
 * or finalisation-rule failure (missing `won_outcome` / `loss_reason`).
 * Callers moving a deal into `won` / `lost` must populate the required
 * outcome fields on the row **before** invoking this helper.
 */
export function transitionDealStage(
  dealId: string,
  toStage: DealStage,
  opts: TransitionDealStageOpts,
  dbArg: Db = defaultDb,
): DealRow {
  const nowMs = opts.nowMs ?? Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;

  return database.transaction((tx: Db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;

    const existing: DealRow | undefined = txDb
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    if (!existing) {
      throw new Error(`transitionDealStage: deal '${dealId}' not found`);
    }

    const fromStage = existing.stage;
    if (fromStage === toStage) {
      throw new Error(
        `transitionDealStage: deal '${dealId}' already in stage '${toStage}'`,
      );
    }

    const legal = LEGAL_TRANSITIONS[fromStage];
    if (!legal.includes(toStage)) {
      throw new Error(
        `transitionDealStage: illegal transition '${fromStage}' → '${toStage}' for deal '${dealId}'`,
      );
    }

    const simulated: DealRow = {
      ...existing,
      stage: toStage,
      last_stage_change_at_ms: nowMs,
      updated_at_ms: nowMs,
    };
    const validation = validateDeal(simulated);
    if (!validation.ok) {
      throw new Error(
        `transitionDealStage: cannot move deal '${dealId}' to '${toStage}': ${validation.errors.join("; ")}`,
      );
    }

    txDb
      .update(deals)
      .set({
        stage: toStage,
        last_stage_change_at_ms: nowMs,
        next_action_overridden_at_ms: null,
        updated_at_ms: nowMs,
      })
      .where(eq(deals.id, dealId))
      .run();

    const extraMeta = { ...(opts.meta ?? {}) };
    delete extraMeta.from_stage;
    delete extraMeta.to_stage;
    delete extraMeta.by;

    txDb
      .insert(activity_log)
      .values({
        id: randomUUID(),
        company_id: existing.company_id,
        contact_id: existing.primary_contact_id,
        deal_id: dealId,
        kind: "stage_change",
        body: `Stage '${fromStage}' → '${toStage}'.`,
        meta: {
          from_stage: fromStage,
          to_stage: toStage,
          by: opts.by,
          ...extraMeta,
        },
        created_at_ms: nowMs,
        created_by: opts.by,
      })
      .run();

    return txDb
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get() as DealRow;
  });
}

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals, type DealRow } from "@/lib/db/schema/deals";
import {
  companies,
  type TrialShootStatus,
} from "@/lib/db/schema/companies";
import { activity_log } from "@/lib/db/schema/activity-log";
import { advanceTrialShootStatus } from "./advance-trial-shoot-status";
import { transitionDealStage } from "./transition-deal-stage";
import { isForwardTransition } from "./trial-shoot-status";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface MarkCompanyTrialShootBookedOpts {
  by: string | null;
  meta?: Record<string, unknown>;
  nowMs?: number;
}

export interface MarkCompanyTrialShootBookedResult {
  deal: DealRow;
  dealStageChanged: boolean;
  trialShootStatusChanged: boolean;
}

/**
 * Intro-funnel Stripe path. Advances the company's `trial_shoot_status`
 * to `booked` (skipped if already at or past `booked` — forward-only),
 * moves the deal to stage `trial_shoot` (skipped if already there), and
 * writes a `trial_shoot_booked` activity row. One SQLite transaction.
 */
export function markCompanyTrialShootBooked(
  dealId: string,
  opts: MarkCompanyTrialShootBookedOpts,
  dbArg: Db = defaultDb,
): MarkCompanyTrialShootBookedResult {
  const nowMs = opts.nowMs ?? Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;

  return database.transaction((tx: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;

    const existing: DealRow | undefined = txDb
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    if (!existing) {
      throw new Error(
        `markCompanyTrialShootBooked: deal '${dealId}' not found`,
      );
    }

    let dealStageChanged = false;
    if (existing.stage !== "trial_shoot") {
      transitionDealStage(
        dealId,
        "trial_shoot",
        { by: opts.by, meta: opts.meta, nowMs },
        tx as Db,
      );
      dealStageChanged = true;
    }

    const companyRow = txDb
      .select({ trial_shoot_status: companies.trial_shoot_status })
      .from(companies)
      .where(eq(companies.id, existing.company_id))
      .get() as { trial_shoot_status: TrialShootStatus } | undefined;

    let trialShootStatusChanged = false;
    if (
      companyRow &&
      isForwardTransition(companyRow.trial_shoot_status, "booked")
    ) {
      advanceTrialShootStatus(
        existing.company_id,
        "booked",
        { by: opts.by, nowMs },
        tx as Db,
      );
      trialShootStatusChanged = true;
    }

    txDb
      .insert(activity_log)
      .values({
        id: randomUUID(),
        company_id: existing.company_id,
        contact_id: existing.primary_contact_id,
        deal_id: dealId,
        kind: "trial_shoot_booked",
        body: "Trial shoot booked via Stripe.",
        meta: { by: opts.by, ...(opts.meta ?? {}) },
        created_at_ms: nowMs,
        created_by: opts.by,
      })
      .run();

    const updated: DealRow = txDb
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();

    return { deal: updated, dealStageChanged, trialShootStatusChanged };
  });
}

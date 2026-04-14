import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import {
  companies,
  type CompanyRow,
  type TrialShootStatus,
} from "@/lib/db/schema/companies";
import { activity_log } from "@/lib/db/schema/activity-log";
import {
  isForwardTransition,
  isTrialShootComplete,
} from "./trial-shoot-status";

export interface AdvanceTrialShootStatusOpts {
  by: string | null;
  nowMs?: number;
}

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface AdvanceTrialShootStatusResult {
  advanced: boolean;
  company: CompanyRow;
}

/**
 * Move a company's `trial_shoot_status` forward. Forward-only: identity
 * and regression throw. Stamps `trial_shoot_completed_at_ms` the first
 * time the status lands in a `completed_*` state. Writes one
 * `activity_log` row (`kind='note'`, `meta.kind='trial_shoot_status_change'`).
 *
 * Does not touch Deal stage — spec §9.3 keeps the Deal in `trial_shoot`
 * for the whole sub-lifecycle.
 */
export function advanceTrialShootStatus(
  companyId: string,
  toStatus: TrialShootStatus,
  opts: AdvanceTrialShootStatusOpts,
  dbArg: Db = defaultDb,
): AdvanceTrialShootStatusResult {
  const nowMs = opts.nowMs ?? Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;

  return database.transaction((tx: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;

    const existing: CompanyRow | undefined = txDb
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();
    if (!existing) {
      throw new Error(
        `advanceTrialShootStatus: company '${companyId}' not found`,
      );
    }

    const from = existing.trial_shoot_status;
    if (!isForwardTransition(from, toStatus)) {
      throw new Error(
        `advanceTrialShootStatus: illegal transition ${from} → ${toStatus}`,
      );
    }

    const completedAt =
      isTrialShootComplete(toStatus) && existing.trial_shoot_completed_at_ms == null
        ? nowMs
        : existing.trial_shoot_completed_at_ms;

    txDb
      .update(companies)
      .set({
        trial_shoot_status: toStatus,
        trial_shoot_completed_at_ms: completedAt,
        updated_at_ms: nowMs,
      })
      .where(eq(companies.id, companyId))
      .run();

    txDb
      .insert(activity_log)
      .values({
        id: randomUUID(),
        company_id: companyId,
        kind: "note",
        body: `Trial shoot status: ${from} → ${toStatus}.`,
        meta: {
          kind: "trial_shoot_status_change",
          from,
          to: toStatus,
          by: opts.by,
        },
        created_at_ms: nowMs,
        created_by: opts.by,
      })
      .run();

    const updated: CompanyRow = txDb
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();

    return { advanced: true, company: updated };
  });
}

/**
 * Convenience hook for the Intro Funnel feedback-questionnaire path.
 * If the company is in `completed_awaiting_feedback`, advances it to
 * `completed_feedback_provided`. Any other state is a silent no-op —
 * the caller doesn't need to know the current state.
 */
export function advanceTrialShootStatusOnFeedback(
  companyId: string,
  opts: AdvanceTrialShootStatusOpts,
  dbArg: Db = defaultDb,
): AdvanceTrialShootStatusResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;
  const existing: CompanyRow | undefined = database
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  if (!existing) {
    throw new Error(
      `advanceTrialShootStatusOnFeedback: company '${companyId}' not found`,
    );
  }
  if (existing.trial_shoot_status !== "completed_awaiting_feedback") {
    return { advanced: false, company: existing };
  }
  return advanceTrialShootStatus(
    companyId,
    "completed_feedback_provided",
    opts,
    dbArg,
  );
}

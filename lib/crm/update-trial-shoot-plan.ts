import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";
import { activity_log } from "@/lib/db/schema/activity-log";

export interface UpdateTrialShootPlanOpts {
  by: string | null;
  nowMs?: number;
}

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

const MAX_BODY_CHARS = 280;

/**
 * Write a free-form trial-shoot plan for a company and log the edit.
 * Empty/whitespace-only plan is stored as `null` (clears the field).
 */
export function updateTrialShootPlan(
  companyId: string,
  plan: string | null,
  opts: UpdateTrialShootPlanOpts,
  dbArg: Db = defaultDb,
): CompanyRow {
  const nowMs = opts.nowMs ?? Date.now();
  const normalised =
    plan == null || plan.trim().length === 0 ? null : plan.trim();
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
        `updateTrialShootPlan: company '${companyId}' not found`,
      );
    }

    txDb
      .update(companies)
      .set({ trial_shoot_plan: normalised, updated_at_ms: nowMs })
      .where(eq(companies.id, companyId))
      .run();

    const body = normalised
      ? `Trial shoot plan updated: ${normalised.slice(0, MAX_BODY_CHARS)}${normalised.length > MAX_BODY_CHARS ? "…" : ""}`
      : "Trial shoot plan cleared.";

    txDb
      .insert(activity_log)
      .values({
        id: randomUUID(),
        company_id: companyId,
        kind: "note",
        body,
        meta: {
          kind: "trial_shoot_plan_updated",
          by: opts.by,
          length: normalised?.length ?? 0,
        },
        created_at_ms: nowMs,
        created_by: opts.by,
      })
      .run();

    return txDb
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .get() as CompanyRow;
  });
}

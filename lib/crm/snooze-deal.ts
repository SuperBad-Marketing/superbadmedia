import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals, type DealRow } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";

export interface SnoozeDealOpts {
  /** Identity of the actor triggering the snooze. */
  by: string | null;
  /** Test-override for `Date.now()`. */
  nowMs?: number;
}

/**
 * Set `deals.snoozed_until_ms` and write a `note` activity row describing
 * the snooze. Runs in one transaction so the log stays consistent with
 * the deal row.
 *
 * Activity kind is `note` (spec sales-pipeline.md §4.1 has no dedicated
 * `deal_snoozed` enum value); `meta.kind = "snooze"` distinguishes it
 * from a human-authored note.
 *
 * Throws on: missing deal, untilMs not strictly in the future.
 */
export function snoozeDeal(
  dealId: string,
  untilMs: number,
  opts: SnoozeDealOpts,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbArg: BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb = defaultDb,
): DealRow {
  const nowMs = opts.nowMs ?? Date.now();
  if (!Number.isFinite(untilMs) || untilMs <= nowMs) {
    throw new Error("snoozeDeal: untilMs must be strictly in the future");
  }
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
      throw new Error(`snoozeDeal: deal '${dealId}' not found`);
    }

    txDb
      .update(deals)
      .set({
        snoozed_until_ms: untilMs,
        updated_at_ms: nowMs,
      })
      .where(eq(deals.id, dealId))
      .run();

    const untilISO = new Date(untilMs).toISOString().slice(0, 10);
    txDb
      .insert(activity_log)
      .values({
        id: randomUUID(),
        company_id: existing.company_id,
        contact_id: existing.primary_contact_id,
        deal_id: dealId,
        kind: "note",
        body: `Snoozed until ${untilISO}.`,
        meta: {
          kind: "snooze",
          until_ms: untilMs,
          by: opts.by,
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

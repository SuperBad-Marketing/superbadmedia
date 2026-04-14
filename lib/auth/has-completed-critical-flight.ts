/**
 * Critical-flight wizard completion check — SW-4 (real implementation).
 *
 * Returns true when every key in `settings.wizards.critical_flight_wizards`
 * has at least one row in `wizard_completions` for this user. Kill-switch
 * gated: when `setup_wizards_enabled` is false the whole sequencer is off
 * and this short-circuits to true — matches SW-2/SW-3's no-op semantics.
 *
 * Consumed by NextAuth's jwt callback to populate
 * `session.user.critical_flight_complete`, which middleware (proxy.ts)
 * reads for gate 2.
 *
 * Owner: SW-4.
 */
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { getCriticalFlightStatus } from "@/lib/wizards/critical-flight";
import { killSwitches } from "@/lib/kill-switches";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export async function hasCompletedCriticalFlight(
  userId: string,
  dbOverride?: AnyDb,
): Promise<boolean> {
  if (!killSwitches.setup_wizards_enabled) return true;
  if (!userId) return false;
  const { remaining } = await getCriticalFlightStatus(userId, dbOverride);
  return remaining.length === 0;
}

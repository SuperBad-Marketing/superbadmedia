/**
 * Critical-flight sequencer — SW-4.
 *
 * Reads `wizards.critical_flight_wizards` (ordered list from settings) and
 * `wizard_completions` to compute:
 *   - `getCriticalFlightStatus(userId)` — ordered list, completed set, and
 *     the remaining-in-order tail.
 *   - `nextCriticalWizardKey(userId)` — first incomplete wizard key, or
 *     `null` when every critical wizard has at least one completion row
 *     for this user.
 *
 * "Completed" = any row exists in `wizard_completions` for (user_id,
 * wizard_key). Per spec §6.1 wizard_completions has no (user, key) unique —
 * the earliest completion is enough to clear the flight slot.
 *
 * Spec: docs/specs/setup-wizards.md §8.1 / §8.2.
 * Owner: SW-4. Consumers: `has-completed-critical-flight.ts`, `/lite/first-run`.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import settings from "@/lib/settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type CriticalFlightStatus = {
  /** Ordered list of critical-flight wizard keys (from settings). */
  ordered: string[];
  /** Keys with at least one completion row for this user. */
  completedKeys: Set<string>;
  /** Ordered tail of wizards still to complete. */
  remaining: string[];
};

export async function getCriticalFlightStatus(
  userId: string,
  dbOverride?: AnyDb,
): Promise<CriticalFlightStatus> {
  const ordered = await settings.get("wizards.critical_flight_wizards");
  if (!userId || ordered.length === 0) {
    return { ordered, completedKeys: new Set(), remaining: [...ordered] };
  }
  const database: AnyDb = dbOverride ?? (defaultDb as unknown as AnyDb);
  const rows = await database
    .select({ wizard_key: wizard_completions.wizard_key })
    .from(wizard_completions)
    .where(
      and(
        eq(wizard_completions.user_id, userId),
        inArray(wizard_completions.wizard_key, ordered),
      ),
    );
  const completedKeys = new Set<string>(rows.map((r) => r.wizard_key));
  const remaining = ordered.filter((k) => !completedKeys.has(k));
  return { ordered, completedKeys, remaining };
}

export async function nextCriticalWizardKey(
  userId: string,
  dbOverride?: AnyDb,
): Promise<string | null> {
  const { remaining } = await getCriticalFlightStatus(userId, dbOverride);
  return remaining[0] ?? null;
}

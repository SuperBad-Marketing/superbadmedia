/**
 * hidden_egg_fire_cleanup — 30-day retention purge for hidden_egg_fires.
 *
 * Deletes rows older than 30 days to keep the table lean. Cadence checks
 * use relative time windows, so old rows have no functional purpose.
 *
 * Owner: SD-9. Spec: docs/specs/surprise-and-delight.md.
 */
import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const HIDDEN_EGG_FIRE_CLEANUP_HANDLERS: HandlerMap = {
  hidden_egg_fire_cleanup: async () => {
    const cutoff = Date.now() - RETENTION_MS;
    await db
      .delete(hidden_egg_fires)
      .where(lt(hidden_egg_fires.fired_at_ms, cutoff));
  },
};

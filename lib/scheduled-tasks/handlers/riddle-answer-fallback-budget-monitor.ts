/**
 * riddle_answer_fallback_budget_monitor — monthly check on per-riddle
 * novel-wrong cache size against the configured budget.
 *
 * Logs a warning to activity_log when any riddle's cache count exceeds
 * 80% of the budget, so Andy sees it in the cockpit brief before the
 * budget is fully exhausted.
 *
 * Owner: SD-10. Spec: docs/specs/surprise-and-delight.md.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { riddles, riddle_novel_wrong_cache } from "@/lib/db/schema/riddles";
import { logActivity } from "@/lib/activity-log";
import settingsRegistry from "@/lib/settings";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

export const RIDDLE_ANSWER_FALLBACK_BUDGET_MONITOR_HANDLERS: HandlerMap = {
  riddle_answer_fallback_budget_monitor: async () => {
    const budget = await settingsRegistry.get(
      "surprise.riddle_wrong_answer_fallback_budget_per_riddle",
    );

    const activeRiddles = await db
      .select({ id: riddles.id, slug: riddles.slug })
      .from(riddles)
      .where(sql`${riddles.retired_at_ms} IS NULL`)
      .all();

    for (const riddle of activeRiddles) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(riddle_novel_wrong_cache)
        .where(eq(riddle_novel_wrong_cache.riddle_id, riddle.id))
        .then((rows) => rows[0]?.count ?? 0);

      if (countResult >= budget) {
        await logActivity({
          kind: "riddle_budget_exhausted",
          body: `Riddle "${riddle.slug}" has exhausted its novel-wrong fallback budget (${countResult}/${budget}).`,
          meta: {
            riddle_id: riddle.id,
            riddle_slug: riddle.slug,
            cache_count: countResult,
            budget,
          },
        });
      } else if (countResult >= budget * 0.8) {
        await logActivity({
          kind: "riddle_budget_warning",
          body: `Riddle "${riddle.slug}" is at ${Math.round((countResult / budget) * 100)}% of its novel-wrong fallback budget (${countResult}/${budget}).`,
          meta: {
            riddle_id: riddle.id,
            riddle_slug: riddle.slug,
            cache_count: countResult,
            budget,
          },
        });
      }
    }
  },
};

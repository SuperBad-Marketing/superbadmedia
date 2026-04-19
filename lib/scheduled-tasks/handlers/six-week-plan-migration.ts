import { z } from "zod";
import { killSwitches } from "@/lib/kill-switches";
import { migratePlanOnWon } from "@/lib/six-week-plan/migration";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";

const PayloadSchema = z.object({
  deal_id: z.string().min(1),
  company_id: z.string().min(1),
});

export const handleSixWeekPlanMigrateOnWon: TaskHandler = async (task) => {
  if (!killSwitches.plan_automations_enabled) return;

  const parsed = PayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `six_week_plan_migrate_on_won: invalid payload (${parsed.error.message})`,
    );
  }

  const result = await migratePlanOnWon(
    parsed.data.deal_id,
    parsed.data.company_id,
  );

  if (!result.ok) {
    console.warn(
      `six_week_plan_migrate_on_won: skipped — ${result.error}`,
    );
  }
};

export const SIX_WEEK_PLAN_MIGRATION_HANDLERS: HandlerMap = {
  six_week_plan_migrate_on_won: handleSixWeekPlanMigrateOnWon,
};

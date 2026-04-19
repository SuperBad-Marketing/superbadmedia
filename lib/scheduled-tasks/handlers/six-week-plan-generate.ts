import { z } from "zod";
import { killSwitches } from "@/lib/kill-switches";
import { runFullPipeline } from "@/lib/six-week-plan/generate";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";

const PayloadSchema = z.object({
  plan_id: z.string().min(1),
  deal_id: z.string().min(1),
  regen_note: z.string().nullable().optional(),
});

export const handleSixWeekPlanGenerate: TaskHandler = async (task) => {
  if (!killSwitches.plan_automations_enabled) return;

  const parsed = PayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `six_week_plan_generate: invalid payload (${parsed.error.message})`,
    );
  }

  const { plan_id, deal_id, regen_note } = parsed.data;

  const result = await runFullPipeline(plan_id, deal_id, regen_note);
  if (!result.ok) {
    throw new Error(`six_week_plan_generate: ${result.reason}`);
  }
};

export const SIX_WEEK_PLAN_GENERATE_HANDLERS: HandlerMap = {
  six_week_plan_generate: handleSixWeekPlanGenerate,
};

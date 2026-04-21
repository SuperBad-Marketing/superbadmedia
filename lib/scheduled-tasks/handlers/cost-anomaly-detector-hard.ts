import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { sweepDailyThresholds } from "@/lib/observatory/hard-threshold-detector";

const handleHardThresholdSweep: TaskHandler = async (_task) => {
  await sweepDailyThresholds();
};

export const COST_ANOMALY_DETECTOR_HARD_HANDLERS: HandlerMap = {
  cost_anomaly_detector_hard: handleHardThresholdSweep,
};

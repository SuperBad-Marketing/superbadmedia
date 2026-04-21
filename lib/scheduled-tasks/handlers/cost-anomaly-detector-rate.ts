import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { sweepRateDetector } from "@/lib/observatory/rate-detector";

const handleRateDetectorSweep: TaskHandler = async (_task) => {
  await sweepRateDetector();
};

export const COST_ANOMALY_DETECTOR_RATE_HANDLERS: HandlerMap = {
  cost_anomaly_detector_rate: handleRateDetectorSweep,
};

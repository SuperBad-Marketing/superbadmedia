import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { sweepLearnedBandDetector } from "@/lib/observatory/learned-band-detector";

const handleLearnedBandSweep: TaskHandler = async (_task) => {
  await sweepLearnedBandDetector();
};

export const COST_ANOMALY_DETECTOR_LEARNED_HANDLERS: HandlerMap = {
  cost_anomaly_detector_learned: handleLearnedBandSweep,
};

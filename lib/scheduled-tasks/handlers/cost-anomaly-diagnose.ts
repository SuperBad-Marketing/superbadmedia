import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { diagnoseAnomaly } from "@/lib/observatory/diagnose-anomaly";

const handleDiagnose: TaskHandler = async (task) => {
  const anomalyId = (task.payload as { anomaly_id?: string })?.anomaly_id;
  if (!anomalyId) return;
  await diagnoseAnomaly(anomalyId);
};

export const COST_ANOMALY_DIAGNOSE_HANDLERS: HandlerMap = {
  cost_anomaly_diagnose: handleDiagnose,
};

/**
 * Fire-and-forget helper: sends a severe-tier alert email when a new
 * severe anomaly is created. Called by each detector alongside
 * `enqueueDiagnosis()`.
 *
 * Owner: COB-9 (Wave 21).
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { sendSevereAlertEmail } from "./severe-alert-email";

export async function maybeSendSevereAlert(anomalyId: string): Promise<void> {
  const row = await db
    .select()
    .from(cost_anomalies)
    .where(eq(cost_anomalies.id, anomalyId))
    .get();

  if (!row || row.tier !== "severe") return;

  await sendSevereAlertEmail(row);
}

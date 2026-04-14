import { db } from "../lib/db";
import { deals } from "../lib/db/schema/deals";
import settingsRegistry from "../lib/settings";
import { isDealStale } from "../lib/crm";

async function main() {
  const now = Date.now();
  const rows = await db.select().from(deals).all();
  const get = settingsRegistry.get;
  const thresholds = {
    lead_days: await get("pipeline.stale_thresholds.lead_days"),
    contacted_days: await get("pipeline.stale_thresholds.contacted_days"),
    conversation_days: await get("pipeline.stale_thresholds.conversation_days"),
    trial_shoot_days: await get("pipeline.stale_thresholds.trial_shoot_days"),
    quoted_days: await get("pipeline.stale_thresholds.quoted_days"),
    negotiating_days: await get("pipeline.stale_thresholds.negotiating_days"),
  };
  console.log("now:", new Date(now).toISOString());
  console.log("thresholds:", thresholds);
  for (const d of rows) {
    const stale = isDealStale(
      {
        stage: d.stage,
        last_stage_change_at_ms: d.last_stage_change_at_ms,
        snoozed_until_ms: d.snoozed_until_ms,
      },
      thresholds,
      now,
    );
    const snoozeISO = d.snoozed_until_ms
      ? new Date(d.snoozed_until_ms).toISOString()
      : null;
    const lastISO = d.last_stage_change_at_ms
      ? new Date(d.last_stage_change_at_ms).toISOString()
      : null;
    console.log(
      `${d.stage.padEnd(12)} stale=${stale}  last=${lastISO}  snooze=${snoozeISO}  ${d.title}`,
    );
  }
}
main();

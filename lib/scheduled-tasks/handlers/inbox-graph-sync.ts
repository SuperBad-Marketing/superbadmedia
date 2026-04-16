import { killSwitches } from "@/lib/kill-switches";
import { getActiveGraphState, createGraphClient, runDeltaSync, syncSentItems } from "@/lib/graph";

export async function runGraphSyncCycle(): Promise<{
  inserted: number;
  skipped: number;
  errors: number;
}> {
  if (!killSwitches.inbox_sync_enabled) {
    return { inserted: 0, skipped: 0, errors: 0 };
  }

  const state = await getActiveGraphState();
  if (!state) {
    return { inserted: 0, skipped: 0, errors: 0 };
  }

  const client = await createGraphClient(state.integration_connection_id);
  const delta = await runDeltaSync(client, state.id);
  const sent = await syncSentItems(client);

  return {
    inserted: delta.inserted + sent.inserted,
    skipped: delta.skipped + sent.skipped,
    errors: delta.errors,
  };
}

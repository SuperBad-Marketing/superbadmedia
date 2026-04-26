import { killSwitches } from "@/lib/kill-switches";
import { getActiveGraphState, createGraphClient, runDeltaSync, syncSentItems } from "@/lib/graph";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import settings from "@/lib/settings";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

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

export async function ensureGraphSyncEnqueued(): Promise<void> {
  const intervalSeconds = await settings.get(
    "inbox.graph_sync_interval_seconds",
  );
  await enqueueTask({
    task_type: "inbox_graph_sync",
    runAt: Date.now() + intervalSeconds * 1000,
    payload: {},
    idempotencyKey: "inbox_graph_sync_periodic",
  });
}

export const INBOX_GRAPH_SYNC_HANDLERS: HandlerMap = {
  inbox_graph_sync: async () => {
    await runGraphSyncCycle();
    await ensureGraphSyncEnqueued();
  },
};

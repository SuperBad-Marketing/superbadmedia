/**
 * Scheduled-task handler for `inbox_initial_import` — processes one
 * batch of history import and re-enqueues itself for the next batch
 * if more pages remain.
 *
 * Payload: `{ graph_state_id: string, months_back: number }`.
 *
 * The handler reads current progress from
 * `graph_api_state.initial_import_progress_json`, processes one page,
 * and either re-enqueues for the next page or marks import as complete.
 *
 * Gated by `inbox_sync_enabled` kill switch.
 *
 * Owner: UI-12. Spec: unified-inbox.md §11 Q11.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { killSwitches } from "@/lib/kill-switches";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { createGraphClient } from "@/lib/graph/client";
import {
  processImportBatch,
  getImportProgress,
} from "@/lib/graph/history-import";

export const InboxHistoryImportPayloadSchema = z.object({
  graph_state_id: z.string().min(1),
  months_back: z.number().int().positive(),
});

export type InboxHistoryImportPayload = z.infer<
  typeof InboxHistoryImportPayloadSchema
>;

export const handleInboxInitialImport: TaskHandler = async (task) => {
  if (!killSwitches.inbox_sync_enabled) {
    return; // no-op when disabled
  }

  const parsed = InboxHistoryImportPayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `inbox_initial_import: invalid payload (${parsed.error.message})`,
    );
  }

  const { graph_state_id, months_back } = parsed.data;

  // Re-read graph state at fire time (handler mistrusts the enqueue clock)
  const [stateRow] = await db
    .select({
      status: graph_api_state.initial_import_status,
      integrationConnectionId: graph_api_state.integration_connection_id,
    })
    .from(graph_api_state)
    .where(eq(graph_api_state.id, graph_state_id))
    .limit(1);

  if (!stateRow) {
    throw new Error(
      `inbox_initial_import: graph_api_state ${graph_state_id} not found`,
    );
  }

  // Already complete or not yet started — stale task, skip
  if (
    stateRow.status === "complete" ||
    stateRow.status === "not_started"
  ) {
    return;
  }

  const client = await createGraphClient(stateRow.integrationConnectionId);
  const currentProgress = await getImportProgress(graph_state_id);

  const updated = await processImportBatch(
    client,
    graph_state_id,
    months_back,
    currentProgress,
  );

  // If more pages remain, re-enqueue for the next batch
  if (updated.status === "in_progress" && updated.nextCursor) {
    await enqueueTask({
      task_type: "inbox_initial_import",
      runAt: Date.now() + 1000, // 1s delay between batches
      payload: { graph_state_id, months_back },
      idempotencyKey: `inbox_initial_import|${graph_state_id}|${updated.imported}`,
    });
  }
};

export const INBOX_HISTORY_IMPORT_HANDLERS: HandlerMap = {
  inbox_initial_import: handleInboxInitialImport,
};

/**
 * Graph API paginated history import — fetches the last N months of email
 * and processes each page through the standard inbound classifier pipeline.
 *
 * Called by the `inbox_initial_import` scheduled-task handler. Each batch
 * fetches one page of messages (50 per page), normalizes, inserts, classifies,
 * and updates progress on `graph_api_state.initial_import_progress_json`.
 *
 * Owner: UI-12. Spec: unified-inbox.md §11 Q11, §13 Steps 3–5.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema/messages";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { killSwitches } from "@/lib/kill-switches";
import type { GraphClient } from "./client";
import { GraphMessageSchema } from "./types";
import { normalizeGraphMessage } from "./normalize";
import { resolveThread, updateThreadTimestamps } from "./thread";
import { classifyAndRouteInbound } from "./router";
import { classifyNotificationPriority } from "./notifier";
import { classifySignalNoise, type SignalNoiseResult } from "./signal-noise";
import { z } from "zod";

const PAGE_SIZE = 50;

const HISTORY_SELECT_FIELDS =
  "id,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,internetMessageHeaders,hasAttachments,isRead,isDraft,conversationId";

const HistoryPageResponseSchema = z.object({
  value: z.array(GraphMessageSchema).default([]),
  "@odata.nextLink": z.string().optional(),
  "@odata.count": z.number().optional(),
});

export type ImportProgress = {
  status: "in_progress" | "complete" | "failed";
  imported: number;
  skipped: number;
  errors: number;
  estimatedTotal: number | null;
  signal: number;
  noise: number;
  spam: number;
  contactsCreated: number;
  nextCursor: string | null;
  lastError: string | null;
  startedAtMs: number;
  updatedAtMs: number;
};

function freshProgress(): ImportProgress {
  return {
    status: "in_progress",
    imported: 0,
    skipped: 0,
    errors: 0,
    estimatedTotal: null,
    signal: 0,
    noise: 0,
    spam: 0,
    contactsCreated: 0,
    nextCursor: null,
    lastError: null,
    startedAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };
}

function isOutbound(fromAddress: string): boolean {
  const lower = fromAddress.toLowerCase();
  return lower.includes("andy@") || lower.includes("support@");
}

function detectSendingAddress(fromAddress: string): string | null {
  const lower = fromAddress.toLowerCase();
  if (lower.includes("support@")) return "support@";
  if (lower.includes("andy@")) return "andy@";
  return null;
}

async function isMessageDuplicate(graphMessageId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.graph_message_id, graphMessageId))
    .limit(1);
  return !!existing;
}

/**
 * Build the initial Graph API URL for fetching history.
 * Uses `$filter` with `receivedDateTime ge` to scope to the last N months.
 * Requests `$count=true` so the first page includes an estimated total.
 */
function buildHistoryUrl(monthsBack: number): string {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const isoDate = cutoff.toISOString();
  return `/me/messages?$filter=receivedDateTime ge ${isoDate}&$select=${HISTORY_SELECT_FIELDS}&$top=${PAGE_SIZE}&$orderby=receivedDateTime desc&$count=true`;
}

/**
 * Process one page of history import. Returns updated progress.
 *
 * - Fetches one page from Graph API (using cursor if resuming)
 * - Normalizes and inserts each message
 * - Runs the 3-way classifier pipeline on inbound messages
 * - Updates progress on graph_api_state
 */
export async function processImportBatch(
  client: GraphClient,
  graphStateId: string,
  monthsBack: number,
  currentProgress: ImportProgress | null,
): Promise<ImportProgress> {
  if (!killSwitches.inbox_sync_enabled) {
    const progress = currentProgress ?? freshProgress();
    return { ...progress, status: "failed", lastError: "inbox_sync_enabled is off" };
  }

  const progress = currentProgress ?? freshProgress();

  const url = progress.nextCursor ?? buildHistoryUrl(monthsBack);

  let response: z.infer<typeof HistoryPageResponseSchema>;
  try {
    const raw = await client.fetchJson<unknown>(url, {
      headers: { Prefer: 'odata.maxpagesize=50, odata.include-annotations="*"' },
    });
    response = HistoryPageResponseSchema.parse(raw);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const updated: ImportProgress = {
      ...progress,
      lastError: errorMsg,
      updatedAtMs: Date.now(),
    };
    await updateGraphStateProgress(graphStateId, updated);
    throw err;
  }

  if (response["@odata.count"] != null && progress.estimatedTotal === null) {
    progress.estimatedTotal = response["@odata.count"];
  }

  let batchImported = 0;
  let batchSkipped = 0;
  let batchErrors = 0;
  let batchSignal = 0;
  let batchNoise = 0;
  let batchSpam = 0;

  for (const gm of response.value) {
    try {
      if (await isMessageDuplicate(gm.id)) {
        batchSkipped++;
        continue;
      }

      const direction = isOutbound(gm.from?.emailAddress?.address ?? "")
        ? "outbound"
        : "inbound";
      const sendingAddress = detectSendingAddress(
        gm.from?.emailAddress?.address ?? "",
      );

      const normalized = normalizeGraphMessage(gm, direction, sendingAddress);
      // Override import_source for history import
      const importMsg: typeof normalized = {
        ...normalized,
        import_source: "backfill_12mo",
      };

      const threadId = await resolveThread(importMsg, sendingAddress);

      await db.insert(messages).values({
        ...importMsg,
        thread_id: threadId,
        internetMessageId: undefined,
        inReplyTo: undefined,
        referencesHeader: undefined,
      } as typeof messages.$inferInsert);

      await updateThreadTimestamps(
        threadId,
        direction,
        importMsg.received_at_ms ?? Date.now(),
      );

      // Run classifiers on inbound messages (same pattern as sync.ts)
      if (direction === "inbound") {
        const results = await Promise.allSettled([
          classifyAndRouteInbound(importMsg, importMsg.id, threadId),
          classifyNotificationPriority(importMsg, importMsg.id, threadId),
          classifySignalNoise(importMsg, importMsg.id, threadId),
        ]);
        const labels = ["router", "notifier", "signal_noise"] as const;
        for (const [idx, result] of results.entries()) {
          if (result.status === "rejected") {
            console.error(
              `[history-import] ${labels[idx]} failed for ${gm.id}:`,
              result.reason,
            );
          }
        }

        // Track signal/noise/spam counts from the signal-noise classifier
        const snResult =
          results[2].status === "fulfilled"
            ? (results[2].value as SignalNoiseResult)
            : null;
        if (snResult?.priority_class === "signal") batchSignal++;
        else if (snResult?.priority_class === "noise") batchNoise++;
        else if (snResult?.priority_class === "spam") batchSpam++;
        else batchSignal++; // fallback — unclassified treated as signal
      } else {
        // Outbound messages are signal by default
        batchSignal++;
      }

      batchImported++;
    } catch (err) {
      console.error(`[history-import] Failed to process message ${gm.id}:`, err);
      batchErrors++;
    }
  }

  const nextCursor = response["@odata.nextLink"] ?? null;
  const isComplete = nextCursor === null;

  const updated: ImportProgress = {
    ...progress,
    imported: progress.imported + batchImported,
    skipped: progress.skipped + batchSkipped,
    errors: progress.errors + batchErrors,
    signal: progress.signal + batchSignal,
    noise: progress.noise + batchNoise,
    spam: progress.spam + batchSpam,
    nextCursor,
    status: isComplete ? "complete" : "in_progress",
    lastError: null,
    updatedAtMs: Date.now(),
  };

  await updateGraphStateProgress(graphStateId, updated);

  // When complete, mark the graph state as ready for live sync
  if (isComplete) {
    await db
      .update(graph_api_state)
      .set({
        initial_import_status: "complete",
        updated_at_ms: Date.now(),
      })
      .where(eq(graph_api_state.id, graphStateId));
  }

  return updated;
}

async function updateGraphStateProgress(
  graphStateId: string,
  progress: ImportProgress,
): Promise<void> {
  await db
    .update(graph_api_state)
    .set({
      initial_import_progress_json: progress as unknown as Record<string, unknown>,
      updated_at_ms: Date.now(),
    })
    .where(eq(graph_api_state.id, graphStateId));
}

/**
 * Read current import progress from the graph_api_state row.
 */
export async function getImportProgress(
  graphStateId: string,
): Promise<ImportProgress | null> {
  const [row] = await db
    .select({
      progress: graph_api_state.initial_import_progress_json,
      status: graph_api_state.initial_import_status,
    })
    .from(graph_api_state)
    .where(eq(graph_api_state.id, graphStateId))
    .limit(1);

  if (!row) return null;
  if (!row.progress) return null;
  return row.progress as unknown as ImportProgress;
}

/**
 * Get the graph_api_state row for the initial import.
 * Unlike getActiveGraphState (which requires status=complete),
 * this finds rows in any state for the import wizard.
 */
export async function getGraphStateForImport(): Promise<{
  id: string;
  integrationConnectionId: string;
  status: string;
} | null> {
  const [row] = await db
    .select({
      id: graph_api_state.id,
      integrationConnectionId: graph_api_state.integration_connection_id,
      status: graph_api_state.initial_import_status,
    })
    .from(graph_api_state)
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    integrationConnectionId: row.integrationConnectionId,
    status: row.status,
  };
}

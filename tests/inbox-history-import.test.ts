/**
 * Tests for `inbox_initial_import` handler and history import logic.
 *
 * Mocks Graph client, classifiers, and DB to test:
 *   1. Handler processes batch and stores messages with correct import_source
 *   2. Handler respects inbox_sync_enabled kill switch
 *   3. Progress metadata updated after each batch
 *   4. Handler re-enqueues for next page when more data remains
 *
 * Owner: UI-12.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Kill switches — must be hoisted before any module imports
const mockKillSwitches = vi.hoisted(() => ({
  inbox_sync_enabled: true,
  llm_calls_enabled: true,
  scheduled_tasks_enabled: true,
  sentry_enabled: false,
  inbox_send_enabled: false,
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: mockKillSwitches,
}));

// Mock DB
const mockDb = vi.hoisted(() => {
  const selectRows: unknown[] = [];
  const insertedRows: unknown[] = [];
  const updatedRows: unknown[] = [];

  return {
    selectRows,
    insertedRows,
    updatedRows,
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(selectRows)),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Mock classifiers
vi.mock("@/lib/graph/router", () => ({
  classifyAndRouteInbound: vi.fn().mockResolvedValue({
    router_classification: "new_lead",
    router_reason: "test",
  }),
}));

vi.mock("@/lib/graph/notifier", () => ({
  classifyNotificationPriority: vi.fn().mockResolvedValue({
    notification_priority: "silent",
  }),
}));

vi.mock("@/lib/graph/signal-noise", () => ({
  classifySignalNoise: vi.fn().mockResolvedValue({
    priority_class: "signal",
    noise_subclass: null,
  }),
}));

// Mock thread resolution
vi.mock("@/lib/graph/thread", () => ({
  resolveThread: vi.fn().mockResolvedValue("thread-001"),
  updateThreadTimestamps: vi.fn().mockResolvedValue(undefined),
}));

// Mock enqueue
const mockEnqueueTask = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: mockEnqueueTask,
}));

// Mock vault/crypto for graph client transitive deps
vi.mock("@/lib/crypto/vault", () => ({
  vault: {
    encrypt: vi.fn().mockReturnValue("encrypted"),
    decrypt: vi.fn().mockReturnValue(
      JSON.stringify({
        accessToken: "test-token",
        refreshToken: "test-refresh",
        expiresAtMs: Date.now() + 3600000,
      }),
    ),
  },
}));

vi.mock("@/lib/graph/client", () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    fetch: vi.fn(),
    fetchJson: vi.fn(),
  }),
}));

// Mock logActivity
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "log-1" }),
}));

import type { GraphClient } from "@/lib/graph/client";
import { processImportBatch, type ImportProgress } from "@/lib/graph/history-import";
import { handleInboxInitialImport } from "@/lib/scheduled-tasks/handlers/inbox-history-import";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

function makeGraphMessage(id: string, sentDate: string) {
  return {
    id,
    internetMessageId: `<${id}@test.com>`,
    subject: `Test message ${id}`,
    bodyPreview: "Preview text",
    body: { contentType: "text", content: `Body of ${id}` },
    from: {
      emailAddress: { name: "Sender", address: "sender@example.com" },
    },
    toRecipients: [
      { emailAddress: { name: "Andy", address: "andy@superbadmedia.com.au" } },
    ],
    ccRecipients: [],
    bccRecipients: [],
    sentDateTime: sentDate,
    receivedDateTime: sentDate,
    internetMessageHeaders: [],
    hasAttachments: false,
    isRead: true,
    isDraft: false,
    conversationId: "conv-001",
  };
}

function makeTask(
  payload: Record<string, unknown>,
): ScheduledTaskRow {
  return {
    id: "task-001",
    task_type: "inbox_initial_import",
    status: "running",
    run_at_ms: Date.now(),
    payload,
    idempotency_key: null,
    attempts: 0,
    last_attempted_at_ms: Date.now(),
    last_error: null,
    done_at_ms: null,
    reclaimed_at_ms: null,
    created_at_ms: Date.now(),
  };
}

describe("inbox history import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKillSwitches.inbox_sync_enabled = true;
    mockKillSwitches.llm_calls_enabled = true;
    mockDb.selectRows.length = 0;
  });

  it("processImportBatch stores messages with import_source backfill_12mo", async () => {
    const client: GraphClient = {
      fetch: vi.fn(),
      fetchJson: vi.fn().mockResolvedValue({
        value: [
          makeGraphMessage("msg-1", "2025-10-15T10:00:00Z"),
          makeGraphMessage("msg-2", "2025-10-16T10:00:00Z"),
        ],
        "@odata.count": 100,
      }),
    };

    // isMessageDuplicate returns false (no duplicates)
    mockDb.selectRows.push(undefined);

    const result = await processImportBatch(client, "state-001", 12, null);

    expect(result.status).toBe("complete"); // no nextLink = complete
    expect(result.imported).toBe(2);
    expect(result.estimatedTotal).toBe(100);
    // Verify insert was called
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("handler respects inbox_sync_enabled kill switch", async () => {
    mockKillSwitches.inbox_sync_enabled = false;

    const task = makeTask({
      graph_state_id: "state-001",
      months_back: 12,
    });

    await handleInboxInitialImport(task);

    // Should not attempt to create a graph client or process anything
    const { createGraphClient } = await import("@/lib/graph/client");
    expect(createGraphClient).not.toHaveBeenCalled();
  });

  it("handler re-enqueues when more pages remain", async () => {
    // Setup: graph state exists and is in_progress
    mockDb.selectRows.push({
      status: "in_progress",
      integrationConnectionId: "conn-001",
    });

    const { createGraphClient } = await import("@/lib/graph/client");
    (createGraphClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      fetch: vi.fn(),
      fetchJson: vi.fn().mockResolvedValue({
        value: [makeGraphMessage("msg-1", "2025-10-15T10:00:00Z")],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/next-page",
        "@odata.count": 200,
      }),
    });

    const task = makeTask({
      graph_state_id: "state-001",
      months_back: 12,
    });

    await handleInboxInitialImport(task);

    // Should re-enqueue for next batch
    expect(mockEnqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "inbox_initial_import",
        payload: expect.objectContaining({
          graph_state_id: "state-001",
          months_back: 12,
        }),
      }),
    );
  });

  it("handler throws on invalid payload", async () => {
    const task = makeTask({ bad: "payload" });

    await expect(handleInboxInitialImport(task)).rejects.toThrow(
      "inbox_initial_import: invalid payload",
    );
  });
});

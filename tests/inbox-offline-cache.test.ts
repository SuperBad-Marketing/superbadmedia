/**
 * UI-11 — Offline IndexedDB cache (lib/offline/inbox-cache) tests.
 *
 * Uses `fake-indexeddb` (devDependency) to provide a real IDBFactory.
 * Each test gets a fresh DB by deleting between runs.
 *
 * Covers per brief §5:
 *  - Thread round-trip: cache → read returns same snapshot
 *  - 51st thread evicts the oldest (LRU by touched_at_ms)
 *  - Queue persists across open/close cycles
 *  - flushQueue routes each entry to the correct handler
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";

import {
  cacheThread,
  readCachedThread,
  readCachedThreadList,
  queueAction,
  readQueue,
  flushQueue,
  newActionId,
  OFFLINE_CACHE_DB_NAME,
  OFFLINE_CACHE_THREAD_LIMIT,
  type OfflineThreadSnapshot,
  type FlushHandlers,
} from "@/lib/offline/inbox-cache";

function makeSnapshot(
  id: string,
  overrides: Partial<OfflineThreadSnapshot> = {},
): OfflineThreadSnapshot {
  return {
    threadId: id,
    subject: `Subject ${id}`,
    senderLabel: "Test Sender",
    previewText: "Preview text",
    lastMessageAtMs: Date.now(),
    priorityClass: "signal",
    keepPinned: false,
    isUnread: true,
    messages: [],
    ...overrides,
  };
}

beforeEach(async () => {
  const req = indexedDB.deleteDatabase(OFFLINE_CACHE_DB_NAME);
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe("offline thread cache", () => {
  it("round-trips a thread snapshot", async () => {
    const snap = makeSnapshot("t1");
    await cacheThread(snap, 1000);
    const result = await readCachedThread("t1");
    expect(result).not.toBeNull();
    expect(result!.threadId).toBe("t1");
    expect(result!.subject).toBe("Subject t1");
    expect(result!.senderLabel).toBe("Test Sender");
  });

  it("returns null for a non-existent thread", async () => {
    const result = await readCachedThread("nope");
    expect(result).toBeNull();
  });

  it(`evicts the oldest when writing the ${OFFLINE_CACHE_THREAD_LIMIT + 1}th thread`, async () => {
    for (let i = 0; i < OFFLINE_CACHE_THREAD_LIMIT; i++) {
      await cacheThread(makeSnapshot(`t${i}`), 1000 + i);
    }
    const listBefore = await readCachedThreadList();
    expect(listBefore).toHaveLength(OFFLINE_CACHE_THREAD_LIMIT);

    await cacheThread(makeSnapshot("overflow"), 9999);
    const listAfter = await readCachedThreadList();
    expect(listAfter).toHaveLength(OFFLINE_CACHE_THREAD_LIMIT);

    const evicted = await readCachedThread("t0");
    expect(evicted).toBeNull();

    const newest = await readCachedThread("overflow");
    expect(newest).not.toBeNull();
  });
});

describe("offline action queue", () => {
  it("persists queue entries and reads them in FIFO order", async () => {
    await queueAction({
      id: newActionId(),
      type: "keep",
      payload: { threadId: "t1", pinned: true },
      created_at_ms: 100,
    });
    await queueAction({
      id: newActionId(),
      type: "archive",
      payload: { threadId: "t2" },
      created_at_ms: 200,
    });

    const queue = await readQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0].type).toBe("keep");
    expect(queue[1].type).toBe("archive");
  });

  it("flushQueue routes each entry to the matching handler and clears the queue", async () => {
    await queueAction({
      id: "a1",
      type: "mark_read",
      payload: { threadId: "t1" },
      created_at_ms: 10,
    });
    await queueAction({
      id: "a2",
      type: "reply",
      payload: {
        threadId: "t2",
        body: "Thanks",
        sendingAddress: "andy@",
        to: ["jane@example.com"],
      },
      created_at_ms: 20,
    });
    await queueAction({
      id: "a3",
      type: "keep",
      payload: { threadId: "t3", pinned: true },
      created_at_ms: 30,
    });
    await queueAction({
      id: "a4",
      type: "archive",
      payload: { threadId: "t4" },
      created_at_ms: 40,
    });

    const calls: string[] = [];
    const handlers: FlushHandlers = {
      mark_read: async () => { calls.push("mark_read"); },
      reply: async () => { calls.push("reply"); },
      keep: async () => { calls.push("keep"); },
      archive: async () => { calls.push("archive"); },
    };

    const result = await flushQueue(handlers);
    expect(result.flushed).toBe(4);
    expect(result.failed).toBe(0);
    expect(calls).toEqual(["mark_read", "reply", "keep", "archive"]);

    const remaining = await readQueue();
    expect(remaining).toHaveLength(0);
  });

  it("counts failures without crashing the rest of the flush", async () => {
    await queueAction({
      id: "a1",
      type: "keep",
      payload: { threadId: "t1", pinned: false },
      created_at_ms: 10,
    });
    await queueAction({
      id: "a2",
      type: "archive",
      payload: { threadId: "t2" },
      created_at_ms: 20,
    });

    const handlers: FlushHandlers = {
      mark_read: async () => {},
      reply: async () => {},
      keep: async () => { throw new Error("network fail"); },
      archive: async () => {},
    };

    const result = await flushQueue(handlers);
    expect(result.flushed).toBe(1);
    expect(result.failed).toBe(1);

    const remaining = await readQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("a1");
  });
});

/**
 * Client-side IndexedDB cache for the mobile inbox (spec §4.5 offline).
 *
 * Keeps the last 50 threads + their messages locally so a flaky train
 * tunnel doesn't blank the inbox, and queues user actions (mark-read,
 * reply, keep, archive) for replay when `navigator.onLine` flips back.
 *
 * Storage key: `lite-inbox-v1`. Two object stores:
 *   - `threads` — { threadId, payload: ThreadSnapshot, touched_at_ms }
 *   - `queue`   — { id, type, payload, created_at_ms } FIFO by created_at
 *
 * LRU eviction at write time keeps `threads` capped. `queue` has no cap —
 * flushing removes entries individually on server-action success.
 *
 * Browser-only. No `@/lib/db` imports. Tested via `fake-indexeddb` in
 * `tests/inbox-offline-cache.test.ts`.
 */

export const OFFLINE_CACHE_DB_NAME = "lite-inbox-v1";
export const OFFLINE_CACHE_DB_VERSION = 1;
export const OFFLINE_CACHE_THREAD_LIMIT = 50;

const THREADS_STORE = "threads";
const QUEUE_STORE = "queue";

export type OfflineThreadSnapshot = {
  threadId: string;
  subject: string | null;
  senderLabel: string;
  previewText: string;
  lastMessageAtMs: number;
  priorityClass: "signal" | "noise" | "spam";
  keepPinned: boolean;
  isUnread: boolean;
  messages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    from_address: string;
    body_text: string;
    sent_at_ms: number | null;
    received_at_ms: number | null;
  }>;
};

type CachedThreadRow = {
  threadId: string;
  payload: OfflineThreadSnapshot;
  touched_at_ms: number;
};

export type QueuedActionType = "mark_read" | "reply" | "keep" | "archive";

export type QueuedAction =
  | {
      id: string;
      type: "mark_read";
      payload: { threadId: string };
      created_at_ms: number;
    }
  | {
      id: string;
      type: "reply";
      payload: {
        threadId: string;
        body: string;
        sendingAddress: string;
        to: string[];
      };
      created_at_ms: number;
    }
  | {
      id: string;
      type: "keep";
      payload: { threadId: string; pinned: boolean };
      created_at_ms: number;
    }
  | {
      id: string;
      type: "archive";
      payload: { threadId: string };
      created_at_ms: number;
    };

function getIndexedDB(): IDBFactory | null {
  if (typeof indexedDB !== "undefined") return indexedDB;
  if (typeof globalThis !== "undefined" && "indexedDB" in globalThis) {
    return (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB;
  }
  return null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIndexedDB();
    if (!idb) {
      reject(new Error("IndexedDB unavailable in this environment."));
      return;
    }
    const req = idb.open(OFFLINE_CACHE_DB_NAME, OFFLINE_CACHE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(THREADS_STORE)) {
        const store = db.createObjectStore(THREADS_STORE, {
          keyPath: "threadId",
        });
        store.createIndex("by_touched", "touched_at_ms");
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        store.createIndex("by_created", "created_at_ms");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed."));
  });
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("tx aborted"));
  });
}

export async function cacheThread(
  snapshot: OfflineThreadSnapshot,
  nowMs: number = Date.now(),
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(THREADS_STORE, "readwrite");
  const store = tx.objectStore(THREADS_STORE);
  const row: CachedThreadRow = {
    threadId: snapshot.threadId,
    payload: snapshot,
    touched_at_ms: nowMs,
  };
  store.put(row);

  const countReq = store.count();
  const total = await promisifyRequest(countReq);
  if (total > OFFLINE_CACHE_THREAD_LIMIT) {
    const overflow = total - OFFLINE_CACHE_THREAD_LIMIT;
    const idx = store.index("by_touched");
    const cursorReq = idx.openCursor();
    let removed = 0;
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || removed >= overflow) {
          resolve();
          return;
        }
        cursor.delete();
        removed += 1;
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }
  await promisifyTransaction(tx);
  db.close();
}

export async function readCachedThread(
  threadId: string,
): Promise<OfflineThreadSnapshot | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(THREADS_STORE, "readonly");
    const store = tx.objectStore(THREADS_STORE);
    const row = await promisifyRequest<CachedThreadRow | undefined>(
      store.get(threadId),
    );
    return row?.payload ?? null;
  } finally {
    db.close();
  }
}

export async function readCachedThreadList(
  limit = OFFLINE_CACHE_THREAD_LIMIT,
): Promise<OfflineThreadSnapshot[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(THREADS_STORE, "readonly");
    const store = tx.objectStore(THREADS_STORE);
    const idx = store.index("by_touched");
    const cursorReq = idx.openCursor(null, "prev");
    const out: OfflineThreadSnapshot[] = [];
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || out.length >= limit) {
          resolve();
          return;
        }
        out.push((cursor.value as CachedThreadRow).payload);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    return out;
  } finally {
    db.close();
  }
}

export async function queueAction(action: QueuedAction): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).put(action);
  await promisifyTransaction(tx);
  db.close();
}

export async function readQueue(): Promise<QueuedAction[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const store = tx.objectStore(QUEUE_STORE);
    const idx = store.index("by_created");
    const cursorReq = idx.openCursor();
    const out: QueuedAction[] = [];
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        out.push(cursor.value as QueuedAction);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    return out;
  } finally {
    db.close();
  }
}

export async function removeQueueEntry(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).delete(id);
  await promisifyTransaction(tx);
  db.close();
}

export type FlushHandlers = {
  mark_read: (payload: { threadId: string }) => Promise<void>;
  reply: (payload: {
    threadId: string;
    body: string;
    sendingAddress: string;
    to: string[];
  }) => Promise<void>;
  keep: (payload: { threadId: string; pinned: boolean }) => Promise<void>;
  archive: (payload: { threadId: string }) => Promise<void>;
};

export type FlushResult = {
  flushed: number;
  failed: number;
};

export async function flushQueue(
  handlers: FlushHandlers,
): Promise<FlushResult> {
  const queue = await readQueue();
  let flushed = 0;
  let failed = 0;
  for (const entry of queue) {
    try {
      if (entry.type === "mark_read") {
        await handlers.mark_read(entry.payload);
      } else if (entry.type === "reply") {
        await handlers.reply(entry.payload);
      } else if (entry.type === "keep") {
        await handlers.keep(entry.payload);
      } else if (entry.type === "archive") {
        await handlers.archive(entry.payload);
      }
      await removeQueueEntry(entry.id);
      flushed += 1;
    } catch {
      failed += 1;
    }
  }
  return { flushed, failed };
}

export function newActionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

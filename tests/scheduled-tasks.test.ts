import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import {
  scheduled_tasks,
  worker_heartbeats,
  SCHEDULED_TASK_TYPES,
} from "@/lib/db/schema/scheduled-tasks";
import { killSwitches, resetKillSwitchesToDefaults } from "@/lib/kill-switches";

const TEST_DB = path.join(process.cwd(), "tests/.test-scheduled-tasks.db");

let sqlite: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  drizzleMigrate(db, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
  // Redirect the app's db singleton to our test sqlite so the worker module
  // writes against this file.
  const globalForDb = globalThis as unknown as { __sblite_sqlite?: Database.Database };
  globalForDb.__sblite_sqlite = sqlite;
});

beforeEach(() => {
  resetKillSwitchesToDefaults();
  sqlite.exec("DELETE FROM scheduled_tasks");
  sqlite.exec("DELETE FROM worker_heartbeats");
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe("scheduled_tasks schema + worker", () => {
  it("task_type enum covers every spec block", () => {
    expect(SCHEDULED_TASK_TYPES.length).toBeGreaterThanOrEqual(37);
    const set = new Set<string>(SCHEDULED_TASK_TYPES);
    for (const t of [
      "quote_expire",
      "invoice_overdue_reminder",
      "context_summary_regenerate",
      "content_newsletter_send",
      "client_data_export",
      "cockpit_brief_regenerate",
      "inbox_hygiene_purge",
      "saas_annual_renewal_reminder",
      "cost_anomaly_diagnose",
      "finance_bas_filed" as unknown as string, // not a task_type — should be absent
    ]) {
      if (t === "finance_bas_filed") {
        expect(set.has(t)).toBe(false);
      } else {
        expect(set.has(t)).toBe(true);
      }
    }
  });

  it("enqueueTask writes a pending row", async () => {
    const { enqueueTask } = await import("@/lib/scheduled-tasks/enqueue");
    const row = await enqueueTask({
      task_type: "quote_expire",
      runAt: Date.now() - 1000,
      payload: { quoteId: "q-1" },
      idempotencyKey: "quote_expire:q-1",
    });
    expect(row?.status).toBe("pending");
    expect(row?.task_type).toBe("quote_expire");
  });

  it("enqueueTask is idempotent on idempotency_key", async () => {
    const { enqueueTask } = await import("@/lib/scheduled-tasks/enqueue");
    await enqueueTask({
      task_type: "quote_expire",
      runAt: Date.now(),
      idempotencyKey: "quote_expire:q-2",
    });
    const second = await enqueueTask({
      task_type: "quote_expire",
      runAt: Date.now(),
      idempotencyKey: "quote_expire:q-2",
    });
    expect(second).toBeNull();
    const count = sqlite
      .prepare("SELECT count(*) AS n FROM scheduled_tasks")
      .get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("worker skips all processing when kill-switch is off, still writes heartbeat", async () => {
    const { enqueueTask } = await import("@/lib/scheduled-tasks/enqueue");
    const { tick } = await import("@/lib/scheduled-tasks/worker");
    await enqueueTask({
      task_type: "quote_expire",
      runAt: Date.now() - 1000,
      idempotencyKey: "quote_expire:q-gated",
    });
    const processed = await tick({ quote_expire: async () => {} });
    expect(processed).toBe(0);
    const hb = sqlite
      .prepare("SELECT * FROM worker_heartbeats WHERE worker_name = 'scheduled-tasks'")
      .get() as { last_tick_tasks_processed: number } | undefined;
    expect(hb?.last_tick_tasks_processed).toBe(0);
  });

  it("worker dispatches and marks done when kill-switch is on", async () => {
    const { enqueueTask } = await import("@/lib/scheduled-tasks/enqueue");
    const { tick } = await import("@/lib/scheduled-tasks/worker");
    killSwitches.scheduled_tasks_enabled = true;
    const row = await enqueueTask({
      task_type: "quote_expire",
      runAt: Date.now() - 1000,
      idempotencyKey: "quote_expire:q-live",
    });
    const calls: string[] = [];
    const processed = await tick({
      quote_expire: async (t) => {
        calls.push(t.id);
      },
    });
    expect(processed).toBe(1);
    expect(calls).toEqual([row!.id]);
    const fromDb = await drizzle(sqlite)
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, row!.id));
    expect(fromDb[0].status).toBe("done");
    expect(fromDb[0].done_at_ms).toBeTypeOf("number");
  });

  it("worker retries on failure with increasing attempts and backoff", async () => {
    const { enqueueTask } = await import("@/lib/scheduled-tasks/enqueue");
    const { tick } = await import("@/lib/scheduled-tasks/worker");
    killSwitches.scheduled_tasks_enabled = true;
    const row = await enqueueTask({
      task_type: "quote_expire",
      runAt: Date.now() - 1000,
      idempotencyKey: "quote_expire:q-retry",
    });
    await tick({
      quote_expire: async () => {
        throw new Error("boom");
      },
    });
    const after = await drizzle(sqlite)
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, row!.id));
    expect(after[0].status).toBe("pending");
    expect(after[0].attempts).toBe(1);
    expect(after[0].last_error).toBe("boom");
    expect(after[0].run_at_ms).toBeGreaterThan(Date.now());
  });

  it("worker marks failed after 3 attempts", async () => {
    const { enqueueTask } = await import("@/lib/scheduled-tasks/enqueue");
    killSwitches.scheduled_tasks_enabled = true;
    const row = await enqueueTask({
      task_type: "quote_expire",
      runAt: Date.now() - 1000,
      idempotencyKey: "quote_expire:q-dead",
    });
    // Simulate two prior failed attempts.
    sqlite
      .prepare(
        "UPDATE scheduled_tasks SET attempts = 2, run_at_ms = ? WHERE id = ?",
      )
      .run(Date.now() - 1000, row!.id);
    const { tick } = await import("@/lib/scheduled-tasks/worker");
    await tick({
      quote_expire: async () => {
        throw new Error("final");
      },
    });
    const after = await drizzle(sqlite)
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.id, row!.id));
    expect(after[0].status).toBe("failed");
    expect(after[0].attempts).toBe(3);
  });
});

// Silence unused import warning for worker_heartbeats — kept for schema coverage.
void worker_heartbeats;

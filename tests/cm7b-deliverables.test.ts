import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import fs from "node:fs";
import path from "node:path";

import type {
  PortalTask,
  ChecklistItem,
  TaskStatus,
} from "@/lib/tasks/types";
import { TASK_KINDS, TASK_STATUSES } from "@/lib/tasks/types";

const TEST_DB = "test-cm7b.db";
const NOW = Date.now();

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema });
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe("CM-7b — Portal deliverables page", () => {
  describe("Task types", () => {
    it("exports 5 task kinds", () => {
      expect(TASK_KINDS).toHaveLength(5);
      expect(TASK_KINDS).toContain("client_deliverable");
      expect(TASK_KINDS).toContain("client_task");
    });

    it("exports 7 task statuses", () => {
      expect(TASK_STATUSES).toHaveLength(7);
      expect(TASK_STATUSES).toContain("awaiting_approval");
      expect(TASK_STATUSES).toContain("delivered");
      expect(TASK_STATUSES).toContain("done");
    });

    it("PortalTask shape is valid at type level", () => {
      const task: PortalTask = {
        id: "test-1",
        title: "Test deliverable",
        body: null,
        kind: "client_deliverable",
        status: "awaiting_approval",
        priority: "normal",
        due_at: null,
        checklist: [
          {
            id: "c1",
            text: "Item 1",
            checked: true,
            checked_at: "2026-04-15",
          },
          { id: "c2", text: "Item 2", checked: false, checked_at: null },
        ],
        approval_requested_at: "2026-04-14",
        approved_at: null,
        rejected_at: null,
        rejection_feedback: null,
        created_at: "2026-04-10",
        completed_at: null,
      };
      expect(task.kind).toBe("client_deliverable");
      expect(task.checklist).toHaveLength(2);
    });
  });

  describe("Tasks table (DB)", () => {
    it("tasks table exists and can query for portal tasks", () => {
      const rows = testDb
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.entity_type, "client"))
        .all();
      expect(rows).toEqual([]);
    });

    it("tasks table supports portal-relevant kinds", () => {
      testDb
        .insert(schema.user)
        .values({
          id: "usr_cm7b",
          email: "cm7b@test.com",
          name: "Test",
          created_at_ms: NOW,
        })
        .onConflictDoNothing()
        .run();

      testDb
        .insert(schema.tasks)
        .values({
          id: "task_cm7b_1",
          title: "Deliverable",
          kind: "client_deliverable",
          entity_type: "client",
          entity_id: "co_1",
          created_at_ms: NOW,
          updated_at_ms: NOW,
          created_by: "usr_cm7b",
        })
        .run();

      const rows = testDb
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.entity_id, "co_1"))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe("client_deliverable");

      testDb.delete(schema.tasks).run();
    });
  });

  describe("Checklist progress logic", () => {
    function checklistProgress(checklist: ChecklistItem[] | null) {
      if (!checklist || checklist.length === 0)
        return { done: 0, total: 0, percent: 0 };
      const done = checklist.filter((c) => c.checked).length;
      return {
        done,
        total: checklist.length,
        percent: Math.round((done / checklist.length) * 100),
      };
    }

    it("returns zero for null checklist", () => {
      expect(checklistProgress(null)).toEqual({
        done: 0,
        total: 0,
        percent: 0,
      });
    });

    it("returns zero for empty checklist", () => {
      expect(checklistProgress([])).toEqual({
        done: 0,
        total: 0,
        percent: 0,
      });
    });

    it("calculates correct progress", () => {
      const items: ChecklistItem[] = [
        { id: "1", text: "A", checked: true, checked_at: "2026-04-15" },
        { id: "2", text: "B", checked: true, checked_at: "2026-04-15" },
        { id: "3", text: "C", checked: false, checked_at: null },
      ];
      expect(checklistProgress(items)).toEqual({
        done: 2,
        total: 3,
        percent: 67,
      });
    });

    it("calculates 100% when all checked", () => {
      const items: ChecklistItem[] = [
        { id: "1", text: "A", checked: true, checked_at: "2026-04-15" },
        { id: "2", text: "B", checked: true, checked_at: "2026-04-15" },
      ];
      expect(checklistProgress(items)).toEqual({
        done: 2,
        total: 2,
        percent: 100,
      });
    });
  });

  describe("Status grouping", () => {
    it("groups tasks into correct sections", () => {
      const tasks: Array<{ status: TaskStatus }> = [
        { status: "awaiting_approval" },
        { status: "in_progress" },
        { status: "todo" },
        { status: "delivered" },
        { status: "done" },
        { status: "blocked" },
      ];

      const awaiting = tasks.filter((t) => t.status === "awaiting_approval");
      const inProgress = tasks.filter(
        (t) =>
          t.status === "in_progress" ||
          t.status === "todo" ||
          t.status === "blocked",
      );
      const delivered = tasks.filter(
        (t) => t.status === "delivered" || t.status === "done",
      );

      expect(awaiting).toHaveLength(1);
      expect(inProgress).toHaveLength(3);
      expect(delivered).toHaveLength(2);
    });
  });
});

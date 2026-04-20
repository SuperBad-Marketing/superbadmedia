import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import fs from "node:fs";
import path from "node:path";

import {
  validateTransition,
  getLegalTransitions,
  isTerminal,
  InvalidTransitionError,
} from "@/lib/tasks/transitions";

const TEST_DB = "test-tm1.db";
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

function seedUser(id = "usr_1") {
  testDb
    .insert(schema.user)
    .values({
      id,
      email: `${id}@test.com`,
      name: "Test User",
      created_at_ms: NOW,
    })
    .onConflictDoNothing()
    .run();
}

beforeEach(() => {
  testDb.delete(schema.tasks).run();
  testDb.delete(schema.braindumps).run();
  seedUser();
});

// ---------------------------------------------------------------------------
// Schema / table existence
// ---------------------------------------------------------------------------

describe("tasks table", () => {
  it("exists and accepts inserts", () => {
    const id = "task_schema_1";
    testDb
      .insert(schema.tasks)
      .values({
        id,
        title: "Test task",
        kind: "admin",
        status: "todo",
        priority: "normal",
        created_at_ms: NOW,
        updated_at_ms: NOW,
        created_by: "usr_1",
      })
      .run();

    const row = testDb
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.title).toBe("Test task");
    expect(row!.kind).toBe("admin");
    expect(row!.status).toBe("todo");
    expect(row!.priority).toBe("normal");
    expect(row!.checklist_auto_complete).toBe(true);
  });

  it("enforces not-null on title", () => {
    expect(() =>
      testDb
        .insert(schema.tasks)
        .values({
          id: "task_null_title",
          title: null as unknown as string,
          kind: "admin",
          created_at_ms: NOW,
          updated_at_ms: NOW,
          created_by: "usr_1",
        })
        .run(),
    ).toThrow();
  });

  it("stores and retrieves JSON checklist", () => {
    const checklist = [
      { id: "c1", text: "Item 1", checked: false, checked_at: null },
      { id: "c2", text: "Item 2", checked: true, checked_at: "2026-01-01" },
    ];
    testDb
      .insert(schema.tasks)
      .values({
        id: "task_checklist",
        title: "Checklist task",
        kind: "client_deliverable",
        checklist: checklist as unknown as null,
        created_at_ms: NOW,
        updated_at_ms: NOW,
        created_by: "usr_1",
      })
      .run();

    const row = testDb
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, "task_checklist"))
      .get();
    expect(row!.checklist).toEqual(checklist);
  });

  it("stores entity link columns", () => {
    testDb
      .insert(schema.tasks)
      .values({
        id: "task_entity",
        title: "Linked task",
        kind: "prospect_followup",
        entity_type: "contact",
        entity_id: "ct_123",
        created_at_ms: NOW,
        updated_at_ms: NOW,
        created_by: "usr_1",
      })
      .run();

    const row = testDb
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, "task_entity"))
      .get();
    expect(row!.entity_type).toBe("contact");
    expect(row!.entity_id).toBe("ct_123");
  });

  it("stores recurrence columns", () => {
    testDb
      .insert(schema.tasks)
      .values({
        id: "task_recurrence",
        title: "Weekly task",
        kind: "admin",
        recurrence: "weekly",
        recurrence_day: 1,
        created_at_ms: NOW,
        updated_at_ms: NOW,
        created_by: "usr_1",
      })
      .run();

    const row = testDb
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, "task_recurrence"))
      .get();
    expect(row!.recurrence).toBe("weekly");
    expect(row!.recurrence_day).toBe(1);
  });

  it("stores approval columns", () => {
    testDb
      .insert(schema.tasks)
      .values({
        id: "task_approval",
        title: "Approve me",
        kind: "client_deliverable",
        status: "awaiting_approval",
        approval_requested_at_ms: NOW,
        approval_token: "hashed_token_123",
        created_at_ms: NOW,
        updated_at_ms: NOW,
        created_by: "usr_1",
      })
      .run();

    const row = testDb
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, "task_approval"))
      .get();
    expect(row!.approval_token).toBe("hashed_token_123");
    expect(row!.approval_requested_at_ms).toBe(NOW);
  });
});

describe("braindumps table", () => {
  it("exists and accepts inserts", () => {
    const id = "bd_1";
    testDb
      .insert(schema.braindumps)
      .values({
        id,
        raw_text: "call jake about invoice, send belle the photos",
        created_by: "usr_1",
        created_at_ms: NOW,
      })
      .run();

    const row = testDb
      .select()
      .from(schema.braindumps)
      .where(eq(schema.braindumps.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.raw_text).toContain("call jake");
    expect(row!.task_count).toBe(0);
  });

  it("stores surface context as JSON", () => {
    const ctx = {
      surfaceType: "client_profile",
      entityType: "client",
      entityId: "cl_1",
    };
    testDb
      .insert(schema.braindumps)
      .values({
        id: "bd_ctx",
        raw_text: "some dump",
        surface_context: ctx as unknown as null,
        created_by: "usr_1",
        created_at_ms: NOW,
      })
      .run();

    const row = testDb
      .select()
      .from(schema.braindumps)
      .where(eq(schema.braindumps.id, "bd_ctx"))
      .get();
    expect(row!.surface_context).toEqual(ctx);
  });
});

// ---------------------------------------------------------------------------
// State machine (transitions.ts)
// ---------------------------------------------------------------------------

describe("validateTransition", () => {
  it("allows todo → in_progress", () => {
    expect(() =>
      validateTransition("todo", "in_progress", "admin"),
    ).not.toThrow();
  });

  it("allows todo → done", () => {
    expect(() => validateTransition("todo", "done", "admin")).not.toThrow();
  });

  it("allows todo → cancelled", () => {
    expect(() =>
      validateTransition("todo", "cancelled", "personal"),
    ).not.toThrow();
  });

  it("allows todo → blocked", () => {
    expect(() => validateTransition("todo", "blocked", "admin")).not.toThrow();
  });

  it("rejects todo → delivered", () => {
    expect(() => validateTransition("todo", "delivered", "admin")).toThrow(
      InvalidTransitionError,
    );
  });

  it("rejects todo → awaiting_approval for non-deliverables", () => {
    expect(() =>
      validateTransition("todo", "awaiting_approval", "admin"),
    ).toThrow(InvalidTransitionError);
  });

  it("allows in_progress → awaiting_approval for client_deliverable", () => {
    expect(() =>
      validateTransition(
        "in_progress",
        "awaiting_approval",
        "client_deliverable",
      ),
    ).not.toThrow();
  });

  it("rejects in_progress → awaiting_approval for non-deliverables", () => {
    expect(() =>
      validateTransition(
        "in_progress",
        "awaiting_approval",
        "prospect_followup",
      ),
    ).toThrow(InvalidTransitionError);
  });

  it("allows awaiting_approval → delivered for client_deliverable", () => {
    expect(() =>
      validateTransition(
        "awaiting_approval",
        "delivered",
        "client_deliverable",
      ),
    ).not.toThrow();
  });

  it("allows awaiting_approval → in_progress (rejection)", () => {
    expect(() =>
      validateTransition(
        "awaiting_approval",
        "in_progress",
        "client_deliverable",
      ),
    ).not.toThrow();
  });

  it("allows delivered → done", () => {
    expect(() =>
      validateTransition("delivered", "done", "client_deliverable"),
    ).not.toThrow();
  });

  it("rejects transitions from done (terminal)", () => {
    expect(() => validateTransition("done", "todo", "admin")).toThrow(
      InvalidTransitionError,
    );
  });

  it("rejects transitions from cancelled (terminal)", () => {
    expect(() => validateTransition("cancelled", "todo", "admin")).toThrow(
      InvalidTransitionError,
    );
  });

  it("allows blocked → todo", () => {
    expect(() => validateTransition("blocked", "todo", "admin")).not.toThrow();
  });

  it("allows blocked → in_progress", () => {
    expect(() =>
      validateTransition("blocked", "in_progress", "admin"),
    ).not.toThrow();
  });

  it("allows blocked → cancelled", () => {
    expect(() =>
      validateTransition("blocked", "cancelled", "admin"),
    ).not.toThrow();
  });
});

describe("getLegalTransitions", () => {
  it("returns all transitions for client_deliverable", () => {
    const transitions = getLegalTransitions(
      "in_progress",
      "client_deliverable",
    );
    expect(transitions).toContain("awaiting_approval");
    expect(transitions).toContain("done");
    expect(transitions).toContain("blocked");
  });

  it("filters deliverable-only transitions for non-deliverable kinds", () => {
    const transitions = getLegalTransitions("in_progress", "admin");
    expect(transitions).not.toContain("awaiting_approval");
    expect(transitions).toContain("done");
    expect(transitions).toContain("blocked");
  });

  it("returns empty for terminal states", () => {
    expect(getLegalTransitions("done", "admin")).toEqual([]);
    expect(getLegalTransitions("cancelled", "admin")).toEqual([]);
  });
});

describe("isTerminal", () => {
  it("done is terminal", () => expect(isTerminal("done")).toBe(true));
  it("cancelled is terminal", () =>
    expect(isTerminal("cancelled")).toBe(true));
  it("todo is not terminal", () => expect(isTerminal("todo")).toBe(false));
  it("in_progress is not terminal", () =>
    expect(isTerminal("in_progress")).toBe(false));
  it("awaiting_approval is not terminal", () =>
    expect(isTerminal("awaiting_approval")).toBe(false));
});

// ---------------------------------------------------------------------------
// Activity log kind registration
// ---------------------------------------------------------------------------

describe("activity log kinds", () => {
  it("includes task manager kinds", () => {
    expect(schema.ACTIVITY_LOG_KINDS).toContain("task_created");
    expect(schema.ACTIVITY_LOG_KINDS).toContain("task_status_changed");
    expect(schema.ACTIVITY_LOG_KINDS).toContain("task_approved");
    expect(schema.ACTIVITY_LOG_KINDS).toContain("task_rejected");
    expect(schema.ACTIVITY_LOG_KINDS).toContain("task_recurrence_spawned");
    expect(schema.ACTIVITY_LOG_KINDS).toContain("braindump_committed");
  });
});

// ---------------------------------------------------------------------------
// Index verification
// ---------------------------------------------------------------------------

describe("indexes", () => {
  it("tasks_status_due_idx exists", () => {
    const result = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='tasks_status_due_idx'",
      )
      .get() as { name: string } | undefined;
    expect(result).toBeDefined();
  });

  it("tasks_entity_idx exists", () => {
    const result = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='tasks_entity_idx'",
      )
      .get() as { name: string } | undefined;
    expect(result).toBeDefined();
  });

  it("tasks_kind_status_idx exists", () => {
    const result = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='tasks_kind_status_idx'",
      )
      .get() as { name: string } | undefined;
    expect(result).toBeDefined();
  });

  it("tasks_approval_token_idx exists", () => {
    const result = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='tasks_approval_token_idx'",
      )
      .get() as { name: string } | undefined;
    expect(result).toBeDefined();
  });
});

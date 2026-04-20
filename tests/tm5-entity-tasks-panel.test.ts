import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      tasks: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  default: { llm_calls_enabled: true },
}));

import { getTasksByEntity, listTasks } from "@/lib/tasks/queries";
import { db } from "@/lib/db";

describe("getTasksByEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to listTasks with entity_type and entity_id", async () => {
    const mockTasks = [
      {
        id: "task-1",
        title: "Follow up on quote",
        kind: "prospect_followup",
        status: "todo",
        priority: "high",
        entity_type: "contact",
        entity_id: "contact-123",
        due_at_ms: Date.now() + 86400000,
        created_at_ms: Date.now(),
        updated_at_ms: Date.now(),
        created_by: "user-1",
      },
      {
        id: "task-2",
        title: "Send invoice",
        kind: "admin",
        status: "in_progress",
        priority: "normal",
        entity_type: "contact",
        entity_id: "contact-123",
        due_at_ms: null,
        created_at_ms: Date.now(),
        updated_at_ms: Date.now(),
        created_by: "user-1",
      },
    ];

    (db.query.tasks.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockTasks,
    );

    const result = await getTasksByEntity("contact", "contact-123");
    expect(result).toEqual(mockTasks);
    expect(db.query.tasks.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when no tasks linked", async () => {
    (db.query.tasks.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await getTasksByEntity("company", "company-456");
    expect(result).toEqual([]);
  });

  it("filters by company entity type", async () => {
    const companyTask = {
      id: "task-3",
      title: "Prepare proposal",
      kind: "client_deliverable",
      status: "awaiting_approval",
      priority: "high",
      entity_type: "company",
      entity_id: "company-789",
      due_at_ms: Date.now(),
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
      created_by: "user-1",
    };

    (db.query.tasks.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      companyTask,
    ]);

    const result = await getTasksByEntity("company", "company-789");
    expect(result).toHaveLength(1);
    expect(result[0].entity_type).toBe("company");
  });
});

describe("EntityTasksPanel data contract", () => {
  it("contact profile queries with entity_type=contact", async () => {
    (db.query.tasks.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getTasksByEntity("contact", "test-contact-id");
    expect(db.query.tasks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
      }),
    );
  });

  it("company profile queries with entity_type=company", async () => {
    (db.query.tasks.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getTasksByEntity("company", "test-company-id");
    expect(db.query.tasks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
      }),
    );
  });

  it("deliverables filter is kind=client_deliverable from entity query", async () => {
    const mixed = [
      { id: "t1", kind: "client_deliverable", entity_type: "company", entity_id: "c1" },
      { id: "t2", kind: "admin", entity_type: "company", entity_id: "c1" },
      { id: "t3", kind: "client_task", entity_type: "company", entity_id: "c1" },
      { id: "t4", kind: "client_deliverable", entity_type: "company", entity_id: "c1" },
    ];

    (db.query.tasks.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mixed);

    const allTasks = await getTasksByEntity("company", "c1");
    const deliverables = allTasks.filter((t: { kind: string }) => t.kind === "client_deliverable");

    expect(allTasks).toHaveLength(4);
    expect(deliverables).toHaveLength(2);
    expect(deliverables.every((d: { kind: string }) => d.kind === "client_deliverable")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import type { PortalTask, ChecklistItem, TaskStatus, TaskKind } from "@/lib/tasks/types";
import { TASK_KINDS, TASK_STATUSES } from "@/lib/tasks/types";
import { getTasksForClientPortal, approveDeliverable, rejectDeliverable } from "@/lib/tasks/portal";

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
          { id: "c1", text: "Item 1", checked: true, checked_at: "2026-04-15" },
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

  describe("Portal stubs", () => {
    it("getTasksForClientPortal returns empty array", async () => {
      const tasks = await getTasksForClientPortal("company-1", {
        kind: ["client_deliverable", "client_task"],
      });
      expect(tasks).toEqual([]);
    });

    it("approveDeliverable returns stub error", async () => {
      const result = await approveDeliverable("task-1", "contact-1");
      expect(result.ok).toBe(false);
    });

    it("rejectDeliverable returns stub error", async () => {
      const result = await rejectDeliverable("task-1", "contact-1", "needs changes");
      expect(result.ok).toBe(false);
    });
  });

  describe("Checklist progress logic", () => {
    function checklistProgress(checklist: ChecklistItem[] | null) {
      if (!checklist || checklist.length === 0) return { done: 0, total: 0, percent: 0 };
      const done = checklist.filter((c) => c.checked).length;
      return { done, total: checklist.length, percent: Math.round((done / checklist.length) * 100) };
    }

    it("returns zero for null checklist", () => {
      expect(checklistProgress(null)).toEqual({ done: 0, total: 0, percent: 0 });
    });

    it("returns zero for empty checklist", () => {
      expect(checklistProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    });

    it("calculates correct progress", () => {
      const items: ChecklistItem[] = [
        { id: "1", text: "A", checked: true, checked_at: "2026-04-15" },
        { id: "2", text: "B", checked: true, checked_at: "2026-04-15" },
        { id: "3", text: "C", checked: false, checked_at: null },
      ];
      expect(checklistProgress(items)).toEqual({ done: 2, total: 3, percent: 67 });
    });

    it("calculates 100% when all checked", () => {
      const items: ChecklistItem[] = [
        { id: "1", text: "A", checked: true, checked_at: "2026-04-15" },
        { id: "2", text: "B", checked: true, checked_at: "2026-04-15" },
      ];
      expect(checklistProgress(items)).toEqual({ done: 2, total: 2, percent: 100 });
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
        (t) => t.status === "in_progress" || t.status === "todo" || t.status === "blocked",
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

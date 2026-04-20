import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  }),
});
const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "inserted" }]),
    onConflictDoNothing: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "inserted" }]),
    }),
  }),
});
const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      tasks: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      contacts: {
        findFirst: vi.fn().mockResolvedValue({
          id: "contact_1",
          name: "Test Client",
          email: "client@test.com",
        }),
      },
    },
    update: (...args: unknown[]) => mockDbUpdate(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "log_1" }),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: "msg_1" }),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn().mockResolvedValue({ id: "st_1" }),
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockResolvedValue(14),
  },
}));

import {
  approveDeliverable,
  generateApprovalToken,
  hashApprovalToken,
  validateApprovalToken,
  issueApprovalToken,
  handleApprovalReminder,
} from "@/lib/tasks/approve";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

const baseTask = {
  id: "task_1",
  title: "Test Deliverable",
  body: "test body",
  kind: "client_deliverable",
  status: "awaiting_approval",
  priority: "normal",
  due_at_ms: null,
  entity_type: "client",
  entity_id: "company_1",
  checklist: null,
  checklist_auto_complete: true,
  recurrence: null,
  recurrence_day: null,
  parent_recurrence_id: null,
  source_braindump_id: null,
  approval_requested_at_ms: Date.now(),
  approval_viewed_at_ms: null,
  approved_at_ms: null,
  approved_by_contact_id: "contact_1",
  rejected_at_ms: null,
  rejection_feedback: null,
  approval_token: "hashed_token",
  created_at_ms: Date.now(),
  updated_at_ms: Date.now(),
  created_by: "usr_1",
  completed_at_ms: null,
};

describe("approveDeliverable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ ...baseTask });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { ...baseTask, status: "delivered", approved_at_ms: Date.now() },
          ]),
        }),
      }),
    });
  });

  it("approves a deliverable and logs activity", async () => {
    const result = await approveDeliverable("task_1", "contact_1", "approve");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.task.status).toBe("delivered");
    }
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "task_approved",
        contactId: "contact_1",
      }),
    );
  });

  it("rejects a deliverable with feedback", async () => {
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { ...baseTask, status: "in_progress", rejected_at_ms: Date.now() },
          ]),
        }),
      }),
    });

    const result = await approveDeliverable(
      "task_1",
      "contact_1",
      "reject",
      "Needs more work",
    );

    expect(result.ok).toBe(true);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "task_rejected",
      }),
    );
  });

  it("rejects without feedback fails", async () => {
    const result = await approveDeliverable("task_1", "contact_1", "reject");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Feedback is required");
    }
  });

  it("returns error for non-existent task", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await approveDeliverable("nope", "contact_1", "approve");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("Task not found.");
    }
  });

  it("returns error for non-deliverable kind", async () => {
    mockFindFirst.mockResolvedValue({ ...baseTask, kind: "admin" });
    const result = await approveDeliverable("task_1", "contact_1", "approve");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Only client_deliverable");
    }
  });

  it("returns error when not in awaiting_approval status", async () => {
    mockFindFirst.mockResolvedValue({ ...baseTask, status: "in_progress" });
    const result = await approveDeliverable("task_1", "contact_1", "approve");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("not awaiting approval");
    }
  });

  it("idempotent on repeat approve", async () => {
    mockFindFirst.mockResolvedValue({
      ...baseTask,
      status: "delivered",
      approved_at_ms: Date.now(),
      approved_by_contact_id: "contact_1",
    });
    const result = await approveDeliverable("task_1", "contact_1", "approve");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyProcessed).toBe(true);
    }
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("idempotent on repeat reject", async () => {
    mockFindFirst.mockResolvedValue({
      ...baseTask,
      status: "in_progress",
      rejected_at_ms: Date.now(),
    });
    const result = await approveDeliverable(
      "task_1",
      "contact_1",
      "reject",
      "already rejected",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyProcessed).toBe(true);
    }
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("sends outcome email to Andy on approve", async () => {
    await approveDeliverable("task_1", "contact_1", "approve");
    // sendEmail is called fire-and-forget (void) for outcome,
    // but also for the rejection inbox message test we verify it's called
    await vi.waitFor(() => {
      expect(sendEmail).toHaveBeenCalled();
    });
  });
});

describe("generateApprovalToken + hashApprovalToken", () => {
  it("generates a raw + hash pair", () => {
    const { raw, hash } = generateApprovalToken();
    expect(raw).toHaveLength(64);
    expect(hash).toHaveLength(64);
    expect(raw).not.toBe(hash);
  });

  it("hashing the raw token produces the same hash", () => {
    const { raw, hash } = generateApprovalToken();
    expect(hashApprovalToken(raw)).toBe(hash);
  });
});

describe("validateApprovalToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for token not found", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await validateApprovalToken("bad_token");
    expect(result).toBeNull();
  });

  it("returns null for expired token", async () => {
    const expired = Date.now() - 15 * 24 * 60 * 60 * 1000;
    mockFindFirst.mockResolvedValue({
      ...baseTask,
      approval_requested_at_ms: expired,
    });
    const result = await validateApprovalToken("some_token");
    expect(result).toBeNull();
  });

  it("returns task + contactId for valid token", async () => {
    mockFindFirst.mockResolvedValue({ ...baseTask });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    const result = await validateApprovalToken("valid_token");
    expect(result).not.toBeNull();
    expect(result!.task.id).toBe("task_1");
    expect(result!.contactId).toBe("contact_1");
  });
});

describe("issueApprovalToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ ...baseTask });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it("stores hashed token and fires email + reminder", async () => {
    const { rawToken } = await issueApprovalToken("task_1", "contact_1");

    expect(rawToken).toHaveLength(64);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "task_approval_requested" }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "deliverable_approval_request",
      }),
    );
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "deliverable_approval_reminder",
      }),
    );
  });
});

describe("handleApprovalReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends reminder when task is still awaiting and unviewed", async () => {
    mockFindFirst.mockResolvedValue({
      ...baseTask,
      approval_viewed_at_ms: null,
    });

    await handleApprovalReminder({
      taskId: "task_1",
      contactId: "contact_1",
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "deliverable_approval_reminder",
      }),
    );
  });

  it("skips reminder when task already viewed", async () => {
    mockFindFirst.mockResolvedValue({
      ...baseTask,
      approval_viewed_at_ms: Date.now(),
    });

    await handleApprovalReminder({
      taskId: "task_1",
      contactId: "contact_1",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips reminder when task is no longer awaiting", async () => {
    mockFindFirst.mockResolvedValue({
      ...baseTask,
      status: "delivered",
    });

    await handleApprovalReminder({
      taskId: "task_1",
      contactId: "contact_1",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});

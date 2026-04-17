/**
 * OS-3: Kill-switch gate on onboarding nudge handlers.
 * Verifies handlers exit early when onboarding_nudges_enabled is off.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: vi.fn().mockReturnValue(null),
          all: vi.fn().mockReturnValue([]),
        }),
      }),
    }),
  },
}));

const mockKillSwitches = { onboarding_nudges_enabled: false };
vi.mock("@/lib/kill-switches", () => ({
  killSwitches: new Proxy(
    {},
    {
      get: (_target, prop: string) =>
        prop in mockKillSwitches
          ? mockKillSwitches[prop as keyof typeof mockKillSwitches]
          : false,
    },
  ),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/settings", () => ({
  default: { get: vi.fn().mockResolvedValue(24) },
}));

import { ONBOARDING_NUDGE_HANDLERS } from "@/lib/scheduled-tasks/handlers/onboarding-nudges";
import { sendEmail } from "@/lib/channels/email/send";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

beforeEach(() => {
  vi.clearAllMocks();
  mockKillSwitches.onboarding_nudges_enabled = false;
});

const makeTask = (
  taskType: string,
  payload: Record<string, unknown>,
): ScheduledTaskRow =>
  ({
    id: "task-1",
    task_type: taskType,
    run_at_ms: Date.now(),
    payload,
    status: "running",
    attempts: 1,
    idempotency_key: null,
    created_at_ms: Date.now(),
    started_at_ms: Date.now(),
    completed_at_ms: null,
    error: null,
  }) as unknown as ScheduledTaskRow;

describe("nudge handlers — kill switch gate", () => {
  it("onboarding_nudge_email handler exits when switch is off", async () => {
    const handler = ONBOARDING_NUDGE_HANDLERS.onboarding_nudge_email!;
    await handler(
      makeTask("onboarding_nudge_email", {
        contactId: "c-1",
        companyId: "co-1",
        audience: "saas",
        nudgeIndex: 0,
      }),
    );

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("practical_setup_reminder_email handler exits when switch is off", async () => {
    const handler =
      ONBOARDING_NUDGE_HANDLERS.practical_setup_reminder_email!;
    await handler(
      makeTask("practical_setup_reminder_email", {
        contactId: "c-1",
        companyId: "co-1",
        reminderIndex: 0,
      }),
    );

    expect(sendEmail).not.toHaveBeenCalled();
  });
});

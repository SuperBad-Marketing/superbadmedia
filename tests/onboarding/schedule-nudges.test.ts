/**
 * OS-3: scheduleOnboardingNudges + schedulePracticalSetupReminders tests.
 * Mocks enqueueTask, killSwitches, settings.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnqueueTask = vi.fn();
vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: (...args: unknown[]) => mockEnqueueTask(...args),
}));

const mockKillSwitches = {
  onboarding_nudges_enabled: true,
};
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

const mockSettingsGet = vi.fn();
vi.mock("@/lib/settings", () => ({
  default: { get: (...args: unknown[]) => mockSettingsGet(...args) },
}));

import {
  scheduleOnboardingNudges,
  schedulePracticalSetupReminders,
} from "@/lib/onboarding/schedule-nudges";

beforeEach(() => {
  vi.clearAllMocks();
  mockKillSwitches.onboarding_nudges_enabled = true;
  mockEnqueueTask.mockResolvedValue(null);
});

describe("scheduleOnboardingNudges", () => {
  it("enqueues retainer nudge at configured delay", async () => {
    mockSettingsGet.mockResolvedValueOnce(24); // retainer_non_start_nudge_hours

    await scheduleOnboardingNudges({
      contactId: "c-1",
      companyId: "co-1",
      audience: "retainer",
    });

    expect(mockEnqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "onboarding_nudge_email",
        payload: expect.objectContaining({
          contactId: "c-1",
          companyId: "co-1",
          audience: "retainer",
          nudgeIndex: 0,
        }),
        idempotencyKey: "onboarding_nudge_c-1_0",
      }),
    );
  });

  it("enqueues SaaS nudge at configured delay", async () => {
    mockSettingsGet.mockResolvedValueOnce(24); // saas_nudge_first_hours

    await scheduleOnboardingNudges({
      contactId: "c-2",
      companyId: "co-2",
      audience: "saas",
    });

    expect(mockEnqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "onboarding_nudge_email",
        payload: expect.objectContaining({
          audience: "saas",
          nudgeIndex: 0,
        }),
      }),
    );
  });

  it("skips enqueue when kill switch is off", async () => {
    mockKillSwitches.onboarding_nudges_enabled = false;

    await scheduleOnboardingNudges({
      contactId: "c-1",
      companyId: "co-1",
      audience: "saas",
    });

    expect(mockEnqueueTask).not.toHaveBeenCalled();
  });

  it("reads retainer-specific settings key", async () => {
    mockSettingsGet.mockResolvedValueOnce(24);

    await scheduleOnboardingNudges({
      contactId: "c-1",
      companyId: "co-1",
      audience: "retainer",
    });

    expect(mockSettingsGet).toHaveBeenCalledWith(
      "onboarding.retainer_non_start_nudge_hours",
    );
  });

  it("reads SaaS-specific settings key", async () => {
    mockSettingsGet.mockResolvedValueOnce(24);

    await scheduleOnboardingNudges({
      contactId: "c-1",
      companyId: "co-1",
      audience: "saas",
    });

    expect(mockSettingsGet).toHaveBeenCalledWith(
      "onboarding.saas_nudge_first_hours",
    );
  });
});

describe("schedulePracticalSetupReminders", () => {
  it("enqueues first practical setup reminder", async () => {
    mockSettingsGet.mockResolvedValueOnce(24); // practical_nudge_first_hours

    await schedulePracticalSetupReminders({
      contactId: "c-1",
      companyId: "co-1",
    });

    expect(mockEnqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "practical_setup_reminder_email",
        payload: expect.objectContaining({
          contactId: "c-1",
          companyId: "co-1",
          reminderIndex: 0,
        }),
        idempotencyKey: "practical_setup_c-1_0",
      }),
    );
  });

  it("skips enqueue when kill switch is off", async () => {
    mockKillSwitches.onboarding_nudges_enabled = false;

    await schedulePracticalSetupReminders({
      contactId: "c-1",
      companyId: "co-1",
    });

    expect(mockEnqueueTask).not.toHaveBeenCalled();
  });

  it("reads correct settings key", async () => {
    mockSettingsGet.mockResolvedValueOnce(24);

    await schedulePracticalSetupReminders({
      contactId: "c-1",
      companyId: "co-1",
    });

    expect(mockSettingsGet).toHaveBeenCalledWith(
      "onboarding.practical_nudge_first_hours",
    );
  });
});

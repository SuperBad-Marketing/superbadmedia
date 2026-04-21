import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    run: vi.fn(),
  },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    invalidateCache: vi.fn(),
    keys: [],
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/eggs/admin-triggers/crt-turn-off", () => ({
  evaluateCrtTurnOff: vi.fn(),
}));

vi.mock("@/lib/eggs/admin-triggers/milestone-spotter", () => ({
  scanForMilestones: vi.fn(),
  generateMilestoneDraft: vi.fn(),
}));

vi.mock("@/lib/eggs/fire-egg", () => ({
  fireEgg: vi.fn().mockResolvedValue("mock-fire-id"),
}));

import settingsRegistry from "@/lib/settings";
import { db } from "@/lib/db";
import { evaluateCrtTurnOff } from "@/lib/eggs/admin-triggers/crt-turn-off";
import { scanForMilestones } from "@/lib/eggs/admin-triggers/milestone-spotter";
import { orchestrateAdminEggs } from "@/lib/eggs/orchestrate-admin";
import { canFireAuthenticatedEgg, canFirePublicEgg } from "@/lib/eggs/cadence";

describe("SD-7: Kill switch", () => {
  describe("canFireAuthenticatedEgg respects tricksEnabled", () => {
    const egg = {
      id: "crt_turn_off",
      name: "CRT",
      register: "admin-roommate" as const,
      cooldownDays: 30,
      exemptFromBudget: false,
      description: "",
    };

    it("returns false when tricksEnabled is false", () => {
      const state = {
        actorType: "admin" as const,
        lastHiddenEggFiredAtMs: null,
        firedEggIdsRecent: [],
        tricksEnabled: false,
      };
      expect(canFireAuthenticatedEgg(egg, state, Date.now(), 7)).toBe(false);
    });

    it("returns true when tricksEnabled is true and cadence allows", () => {
      const state = {
        actorType: "admin" as const,
        lastHiddenEggFiredAtMs: null,
        firedEggIdsRecent: [],
        tricksEnabled: true,
      };
      expect(canFireAuthenticatedEgg(egg, state, Date.now(), 7)).toBe(true);
    });
  });

  describe("canFirePublicEgg respects tricksDisabled", () => {
    const egg = {
      id: "late_night_visitor",
      name: "Late Night",
      register: "public-bartender" as const,
      cooldownDays: 14,
      exemptFromBudget: false,
      description: "",
    };

    it("returns false when tricksDisabled is true", () => {
      const state = {
        firstEggDeliveredAt: null,
        lastHiddenEggFiredAt: null,
        firedEggIds: [],
        tricksDisabled: true,
      };
      expect(canFirePublicEgg(egg, state, Date.now(), 14)).toBe(false);
    });

    it("returns true when tricksDisabled is false", () => {
      const state = {
        firstEggDeliveredAt: null,
        lastHiddenEggFiredAt: null,
        firedEggIds: [],
        tricksDisabled: false,
      };
      expect(canFirePublicEgg(egg, state, Date.now(), 14)).toBe(true);
    });
  });
});

describe("SD-7: Admin egg orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no-fire when global setting is disabled", async () => {
    vi.mocked(settingsRegistry.get).mockResolvedValueOnce(false as never);

    const result = await orchestrateAdminEggs("user-1");
    expect(result.fired).toBe(false);
    expect(result.eggId).toBeNull();
  });

  it("returns no-fire when user has tricks disabled", async () => {
    vi.mocked(settingsRegistry.get).mockResolvedValueOnce(true as never);

    const mockThen = vi.fn().mockResolvedValue({
      hidden_egg_tricks_enabled: false,
      last_hidden_egg_fired_at_ms: null,
      fired_egg_ids_recent: [],
    });
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: mockThen,
        }),
      }),
    } as never);

    const result = await orchestrateAdminEggs("user-1");
    expect(result.fired).toBe(false);
  });

  it("evaluates CRT trigger when cadence allows", async () => {
    vi.mocked(settingsRegistry.get)
      .mockResolvedValueOnce(true as never) // hidden_eggs_enabled
      .mockResolvedValueOnce(7 as never); // admin_egg_cadence_per_days

    const mockThen = vi.fn().mockResolvedValue({
      hidden_egg_tricks_enabled: true,
      last_hidden_egg_fired_at_ms: null,
      fired_egg_ids_recent: [],
    });
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: mockThen,
        }),
      }),
    } as never);

    vi.mocked(evaluateCrtTurnOff).mockResolvedValue({
      shouldFire: true,
      evidence: { lateNightDates: ["2026-04-19", "2026-04-20", "2026-04-21"], distinctDayCount: 3 },
    });

    vi.mocked(scanForMilestones).mockResolvedValue([]);

    const result = await orchestrateAdminEggs("user-1");
    expect(result.fired).toBe(true);
    expect(result.eggId).toBe("crt_turn_off");
  });

  it("returns no-fire when no triggers match", async () => {
    vi.mocked(settingsRegistry.get)
      .mockResolvedValueOnce(true as never)
      .mockResolvedValueOnce(7 as never);

    const mockThen = vi.fn().mockResolvedValue({
      hidden_egg_tricks_enabled: true,
      last_hidden_egg_fired_at_ms: null,
      fired_egg_ids_recent: [],
    });
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: mockThen,
        }),
      }),
    } as never);

    vi.mocked(evaluateCrtTurnOff).mockResolvedValue({
      shouldFire: false,
      evidence: { lateNightDates: [], distinctDayCount: 0 },
    });

    vi.mocked(scanForMilestones).mockResolvedValue([]);

    const result = await orchestrateAdminEggs("user-1");
    expect(result.fired).toBe(false);
    expect(result.eggId).toBeNull();
  });
});

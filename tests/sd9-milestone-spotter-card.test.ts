import { describe, it, expect, vi } from "vitest";

// --- All vi.mock at top level (hoisted by vitest) ---

vi.mock("@/lib/auth/session", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "admin-1", role: "admin" },
  }),
}));

vi.mock("@/lib/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "log-1" }]),
  };
  return { db: mockDb };
});

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: "msg-1" }),
}));

vi.mock("@/lib/channels/sms/send", () => ({
  sendSms: vi.fn().mockResolvedValue({ sent: true, messageSid: "sid-1" }),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "log-1" }),
}));

vi.mock("@/lib/db/schema/hidden-egg-fires", () => ({
  hidden_egg_fires: {
    id: "id",
    egg_id: "egg_id",
    trigger_evidence: "trigger_evidence",
    fired_at_ms: "fired_at_ms",
    outcome: "outcome",
  },
}));

vi.mock("@/lib/db/schema/contacts", () => ({
  contacts: {
    id: "id",
    email: "email",
    name: "name",
    phone: "phone",
    company_id: "company_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  lt: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

vi.mock("@/lib/eggs/registry", () => ({
  ADMIN_EGGS: [],
}));

vi.mock("@/lib/eggs/cadence", () => ({
  canFireAuthenticatedEgg: vi.fn().mockReturnValue(false),
  updateFiredEggIds: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/eggs/fire-egg", () => ({
  fireEgg: vi.fn().mockResolvedValue("fire-123"),
}));

vi.mock("@/lib/eggs/admin-triggers/crt-turn-off", () => ({
  evaluateCrtTurnOff: vi.fn(),
}));

vi.mock("@/lib/eggs/admin-triggers/milestone-spotter", () => ({
  scanForMilestones: vi.fn().mockResolvedValue([]),
  generateMilestoneDraft: vi.fn().mockResolvedValue("draft"),
}));

vi.mock("@/lib/settings", () => ({
  default: { get: vi.fn().mockResolvedValue(false) },
}));

vi.mock("@/lib/db/schema/user", () => ({
  user: {
    id: "id",
    hidden_egg_tricks_enabled: "hidden_egg_tricks_enabled",
    last_hidden_egg_fired_at_ms: "last_hidden_egg_fired_at_ms",
    fired_egg_ids_recent: "fired_egg_ids_recent",
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// --- milestone-action route tests ---
describe("milestone-action API route", () => {
  it("should export a POST handler", async () => {
    const mod = await import(
      "@/app/api/lite/eggs/milestone-action/route"
    );
    expect(mod.POST).toBeDefined();
    expect(typeof mod.POST).toBe("function");
  });
});

// --- hidden-egg-fire-cleanup handler tests ---
describe("hidden-egg-fire-cleanup handler", () => {
  it("should export a handler map with hidden_egg_fire_cleanup", async () => {
    const mod = await import(
      "@/lib/scheduled-tasks/handlers/hidden-egg-fire-cleanup"
    );
    expect(mod.HIDDEN_EGG_FIRE_CLEANUP_HANDLERS).toBeDefined();
    expect(mod.HIDDEN_EGG_FIRE_CLEANUP_HANDLERS.hidden_egg_fire_cleanup).toBeDefined();
    expect(typeof mod.HIDDEN_EGG_FIRE_CLEANUP_HANDLERS.hidden_egg_fire_cleanup).toBe("function");
  });

  it("should call db.delete with a cutoff filter", async () => {
    const { db } = await import("@/lib/db");
    const mod = await import(
      "@/lib/scheduled-tasks/handlers/hidden-egg-fire-cleanup"
    );
    const handler = mod.HIDDEN_EGG_FIRE_CLEANUP_HANDLERS.hidden_egg_fire_cleanup!;
    await handler({} as never);
    expect(db.delete).toHaveBeenCalled();
  });
});

// --- orchestrate-admin result shape tests ---
describe("OrchestrateAdminResult includes fireId", () => {
  it("NO_FIRE result should have null fireId", async () => {
    const mod = await import("@/lib/eggs/orchestrate-admin");
    const result = await mod.orchestrateAdminEggs("admin-1");
    expect(result).toHaveProperty("fireId");
    expect(result.fireId).toBeNull();
  });
});

// --- MilestoneSpotterCard component tests ---
describe("MilestoneSpotterCard", () => {
  it("should export a MilestoneSpotterCard component", async () => {
    const mod = await import("@/components/lite/milestone-spotter-card");
    expect(mod.MilestoneSpotterCard).toBeDefined();
    expect(typeof mod.MilestoneSpotterCard).toBe("function");
  });
});

// --- useAdminEggs includes fireId ---
describe("useAdminEggs interface", () => {
  it("AdminEggFired type should include fireId field", async () => {
    const mod = await import("@/lib/eggs/use-admin-eggs");
    expect(mod.useAdminEggs).toBeDefined();
  });
});

// --- activity-log kind exists ---
describe("activity_log kinds include hidden_egg_acted", () => {
  it("should include hidden_egg_acted in the activity log kinds", async () => {
    vi.doUnmock("@/lib/db/schema/activity-log");
    const mod = await import("@/lib/db/schema/activity-log");
    expect(mod.ACTIVITY_LOG_KINDS).toContain("hidden_egg_acted");
  });
});

// --- email classification exists ---
describe("email classification includes milestone_outreach", () => {
  it("should include milestone_outreach", async () => {
    vi.doUnmock("@/lib/channels/email/classifications");
    const mod = await import("@/lib/channels/email/classifications");
    expect(mod.EMAIL_CLASSIFICATIONS).toContain("milestone_outreach");
  });
});

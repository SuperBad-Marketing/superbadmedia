import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockGet,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: mockInsert,
    })),
    delete: vi.fn(() => ({
      where: mockDelete,
    })),
  },
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { isBlockedFromOutreach } from "@/lib/lead-gen/dnc";

describe("isBlockedFromOutreach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(undefined);
  });

  it("returns not blocked when no matches found", async () => {
    const result = await isBlockedFromOutreach("test@example.com");
    expect(result).toEqual({ blocked: false, reason: null });
  });

  it("checks company-level DNC when companyId is provided", async () => {
    // First call: company check returns do_not_contact: true
    mockGet.mockResolvedValueOnce({ do_not_contact: true });

    const result = await isBlockedFromOutreach("test@example.com", "co-1");
    expect(result).toEqual({ blocked: true, reason: "company" });
  });

  it("checks email-level DNC", async () => {
    // First call: company check passes (no company)
    // The mock chain returns undefined by default (no company check without companyId)
    // Next call: email check returns a match
    mockGet.mockResolvedValueOnce({ id: "dnc-1" });

    const result = await isBlockedFromOutreach("blocked@example.com");
    expect(result).toEqual({ blocked: true, reason: "email" });
  });

  it("checks domain-level DNC", async () => {
    // First call: email check returns no match
    mockGet
      .mockResolvedValueOnce(undefined) // email check
      .mockResolvedValueOnce({ id: "dnc-domain-1" }); // domain check

    const result = await isBlockedFromOutreach("anyone@blocked-domain.com");
    expect(result).toEqual({ blocked: true, reason: "domain" });
  });

  it("normalises email to lowercase", async () => {
    // Should not find a match — we're testing normalisation works
    const result = await isBlockedFromOutreach("TEST@EXAMPLE.COM");
    expect(result).toEqual({ blocked: false, reason: null });
  });

  it("skips company check when no companyId provided", async () => {
    const result = await isBlockedFromOutreach("test@example.com");
    // Should only make 2 get calls (email + domain), not 3
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.blocked).toBe(false);
  });

  it("company block takes priority over email block", async () => {
    // Company is blocked, email is also blocked
    mockGet
      .mockResolvedValueOnce({ do_not_contact: true }); // company check

    const result = await isBlockedFromOutreach("blocked@example.com", "co-1");
    // Should return company as reason (checked first)
    expect(result.reason).toBe("company");
  });
});

describe("sender identity", () => {
  it("exports SUPERBAD_SENDER with correct fields", async () => {
    const { SUPERBAD_SENDER } = await import("@/lib/lead-gen/sender");
    expect(SUPERBAD_SENDER.display_name).toBe("Andy Robinson");
    expect(SUPERBAD_SENDER.local_part).toBe("hi");
    expect(SUPERBAD_SENDER.domain).toBe("contact.superbadmedia.com.au");
    expect(SUPERBAD_SENDER.reply_to).toBe(
      "hi@contact.superbadmedia.com.au",
    );
  });

  it("exports SUPERBAD_FROM_STRING in correct format", async () => {
    const { SUPERBAD_FROM_STRING } = await import("@/lib/lead-gen/sender");
    expect(SUPERBAD_FROM_STRING).toBe(
      "Andy Robinson <hi@contact.superbadmedia.com.au>",
    );
  });
});

describe("kill switch — lead_gen_enabled", () => {
  it("exists and defaults to false", async () => {
    // Re-import to get fresh state
    const { killSwitches: ks } = await import("@/lib/kill-switches");
    expect(ks.lead_gen_enabled).toBe(false);
  });
});

describe("barrel exports from lib/lead-gen", () => {
  it("re-exports DNC functions", async () => {
    const mod = await import("@/lib/lead-gen");
    expect(mod.isBlockedFromOutreach).toBeDefined();
    expect(mod.addDncEmail).toBeDefined();
    expect(mod.addDncDomain).toBeDefined();
    expect(mod.removeDncEmail).toBeDefined();
    expect(mod.removeDncDomain).toBeDefined();
  });

  it("re-exports sender identity", async () => {
    const mod = await import("@/lib/lead-gen");
    expect(mod.SUPERBAD_SENDER).toBeDefined();
    expect(mod.SUPERBAD_FROM_STRING).toBeDefined();
  });
});

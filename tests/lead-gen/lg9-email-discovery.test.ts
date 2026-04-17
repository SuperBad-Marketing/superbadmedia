/**
 * LG-9: email-discovery.ts — Hunter.io contact resolution.
 *
 * Covers:
 *  - verified hit (high-confidence Hunter result, preferred role)
 *  - low-confidence fallback to pattern inference (first name used)
 *  - no match (empty Hunter response → null)
 *  - kill-switch gate
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  },
}));

vi.mock("@/lib/db/schema/external-call-log", () => ({
  external_call_log: {},
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { lead_gen_enabled: true },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockHunterResponse(emails: object[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { emails } }),
  } as unknown as Response);
}

function makeContact(overrides: {
  value?: string;
  confidence?: number;
  position?: string;
  first_name?: string;
  last_name?: string;
}) {
  return {
    value: "contact@example.com",
    confidence: 90,
    position: "ceo",
    first_name: "Jane",
    last_name: "Doe",
    ...overrides,
  };
}

const mockDb = {
  insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("discoverContactEmail", () => {
  let discoverContactEmail: Awaited<typeof import("@/lib/lead-gen/email-discovery")>["discoverContactEmail"];

  beforeEach(async () => {
    vi.resetModules();

    // Re-import after module reset
    const mod = await import("@/lib/lead-gen/email-discovery");
    discoverContactEmail = mod.discoverContactEmail;

    process.env.HUNTER_IO_API_KEY = "test-hunter-key";

    // Reset the db mock
    mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it("returns verified result for high-confidence contact with preferred role", async () => {
    mockHunterResponse([
      makeContact({ value: "jane@acme.com.au", confidence: 85, position: "ceo", first_name: "Jane", last_name: "Doe" }),
    ]);

    const result = await discoverContactEmail("acme.com.au", mockDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    expect(result).not.toBeNull();
    expect(result?.email).toBe("jane@acme.com.au");
    expect(result?.email_confidence).toBe("verified");
    expect(result?.name).toBe("Jane Doe");
    expect(result?.role).toBe("ceo");
  });

  it("returns verified result even for non-preferred role when confidence is high", async () => {
    mockHunterResponse([
      makeContact({ value: "ops@acme.com.au", confidence: 75, position: "office-manager", first_name: "Bob" }),
    ]);

    const result = await discoverContactEmail("acme.com.au", mockDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    expect(result?.email_confidence).toBe("verified");
    expect(result?.email).toBe("ops@acme.com.au");
  });

  it("prefers higher-confidence contact when multiple returned", async () => {
    mockHunterResponse([
      makeContact({ value: "intern@acme.com.au", confidence: 30, position: "intern", first_name: "Alice" }),
      makeContact({ value: "owner@acme.com.au", confidence: 50, position: "owner", first_name: "Bob" }),
    ]);

    // Both below threshold — falls back to inference using best (owner by preferred role)
    const result = await discoverContactEmail("acme.com.au", mockDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    // inferred from best contact's first name (Bob — owner is preferred role)
    expect(result?.email_confidence).toBe("inferred");
    expect(result?.email).toBe("bob@acme.com.au");
  });

  it("falls back to pattern inference for low-confidence result with a first name", async () => {
    mockHunterResponse([
      makeContact({ value: "maybe@acme.com.au", confidence: 45, position: "marketing-director", first_name: "Sam", last_name: "Jones" }),
    ]);

    const result = await discoverContactEmail("acme.com.au", mockDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    expect(result).not.toBeNull();
    expect(result?.email_confidence).toBe("inferred");
    expect(result?.email).toBe("sam@acme.com.au");
    expect(result?.name).toBe("Sam Jones");
  });

  it("returns null when Hunter returns no contacts", async () => {
    mockHunterResponse([]);

    const result = await discoverContactEmail("acme.com.au", mockDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    expect(result).toBeNull();
  });

  it("returns null when low-confidence contacts have no first name", async () => {
    mockHunterResponse([
      { value: "info@acme.com.au", confidence: 30, first_name: null, last_name: null, position: null },
    ]);

    const result = await discoverContactEmail("acme.com.au", mockDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    expect(result).toBeNull();
  });

  it("returns null when kill-switch is off", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    (killSwitches as Record<string, unknown>).lead_gen_enabled = false;

    const result = await discoverContactEmail("acme.com.au", mockDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    expect(result).toBeNull();
    (killSwitches as Record<string, unknown>).lead_gen_enabled = true;
  });

  it("returns null when HUNTER_IO_API_KEY is missing", async () => {
    delete process.env.HUNTER_IO_API_KEY;
    global.fetch = vi.fn();

    const result = await discoverContactEmail("acme.com.au", mockDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    expect(result).toBeNull();
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it("logs to external_call_log on every Hunter call", async () => {
    mockHunterResponse([makeContact({})]);
    const insertMock = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const localDb = { insert: insertMock };

    await discoverContactEmail("acme.com.au", localDb as unknown as Parameters<typeof discoverContactEmail>[1]);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertCall = insertMock.mock.calls[0][0];
    // The arg is the external_call_log table schema object (mocked as {})
    expect(insertCall).toBeDefined();
  });
});

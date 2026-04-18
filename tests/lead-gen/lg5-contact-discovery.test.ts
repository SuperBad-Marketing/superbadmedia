import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/integrations/getCredential", () => ({
  getCredential: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { discoverContact } from "@/lib/lead-gen/contact-discovery";
import { getCredential } from "@/lib/integrations/getCredential";

const mockGetCredential = vi.mocked(getCredential);

describe("discoverContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("returns unknown when no Hunter API key is configured", async () => {
    mockGetCredential.mockResolvedValue(null);
    const result = await discoverContact("example.com", "Example Co");
    expect(result.email).toBeNull();
    expect(result.confidence).toBe("unknown");
    expect(result.source).toBe("none");
  });

  it("returns verified contact from Hunter high-confidence match", async () => {
    mockGetCredential.mockResolvedValue("test-api-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            emails: [
              {
                value: "jane@example.com",
                type: "personal",
                confidence: 92,
                first_name: "Jane",
                last_name: "Smith",
                position: "CEO",
                seniority: "senior",
              },
            ],
            pattern: "{first}",
          },
        }),
    });

    const result = await discoverContact("example.com", "Example Co");
    expect(result.email).toBe("jane@example.com");
    expect(result.name).toBe("Jane Smith");
    expect(result.role).toBe("CEO");
    expect(result.confidence).toBe("verified");
    expect(result.source).toBe("hunter");
  });

  it("marks low-confidence Hunter match as inferred", async () => {
    mockGetCredential.mockResolvedValue("test-api-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            emails: [
              {
                value: "j@example.com",
                type: "personal",
                confidence: 50,
                first_name: "J",
                last_name: null,
                position: null,
                seniority: null,
              },
            ],
            pattern: null,
          },
        }),
    });

    const result = await discoverContact("example.com", "Example Co");
    expect(result.email).toBe("j@example.com");
    expect(result.confidence).toBe("inferred");
    expect(result.source).toBe("hunter");
  });

  it("prefers decision-maker roles over highest confidence", async () => {
    mockGetCredential.mockResolvedValue("test-api-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            emails: [
              {
                value: "support@example.com",
                type: "generic",
                confidence: 99,
                first_name: null,
                last_name: null,
                position: "Support Agent",
                seniority: "junior",
              },
              {
                value: "founder@example.com",
                type: "personal",
                confidence: 75,
                first_name: "Alice",
                last_name: "Doe",
                position: "Founder",
                seniority: "senior",
              },
            ],
            pattern: null,
          },
        }),
    });

    const result = await discoverContact("example.com", "Example Co");
    expect(result.email).toBe("founder@example.com");
    expect(result.name).toBe("Alice Doe");
  });

  it("falls back to pattern inference for generic patterns", async () => {
    mockGetCredential.mockResolvedValue("test-api-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            emails: [],
            pattern: "info",
          },
        }),
    });

    const result = await discoverContact("example.com", "Example Co");
    expect(result.email).toBe("info@example.com");
    expect(result.confidence).toBe("inferred");
    expect(result.source).toBe("pattern_inference");
  });

  it("returns null when pattern requires names we don't have", async () => {
    mockGetCredential.mockResolvedValue("test-api-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            emails: [],
            pattern: "{first}.{last}",
          },
        }),
    });

    const result = await discoverContact("example.com", "Example Co");
    expect(result.email).toBeNull();
    expect(result.source).toBe("none");
  });

  it("handles fetch errors gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-api-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    const result = await discoverContact("example.com", "Example Co");
    expect(result.email).toBeNull();
    expect(result.confidence).toBe("unknown");
    expect(result.source).toBe("none");
  });

  it("skips contacts below confidence 30", async () => {
    mockGetCredential.mockResolvedValue("test-api-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            emails: [
              {
                value: "maybe@example.com",
                type: "personal",
                confidence: 20,
                first_name: null,
                last_name: null,
                position: null,
                seniority: null,
              },
            ],
            pattern: null,
          },
        }),
    });

    const result = await discoverContact("example.com", "Example Co");
    expect(result.email).toBeNull();
  });
});

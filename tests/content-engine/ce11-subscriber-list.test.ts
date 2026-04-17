import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import {
  generateEmbedCode,
  exportSubscribersCsv,
  importSubscribersFromCsv,
  getListHealth,
  listSubscribers,
} from "@/lib/content-engine/subscriber-list";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";

// ── Test helpers ────────────────────────────────────────────────────

function makeSubscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    company_id: "co-1",
    email: "test@example.com",
    name: null,
    consent_source: "csv_import" as const,
    consented_at_ms: 1000,
    status: "active" as const,
    bounce_count: 0,
    last_opened_at_ms: null,
    unsubscribed_at_ms: null,
    removed_at_ms: null,
    created_at_ms: 1000,
    ...overrides,
  };
}

function mockDbChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(rows),
    get: vi.fn().mockResolvedValue(rows[0] ?? undefined),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function mockInsertChain() {
  const chain = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("generateEmbedCode", () => {
  it("generates valid HTML form with token and endpoint", () => {
    const code = generateEmbedCode(
      "https://superbadmedia.com.au",
      "tok_123",
    );
    expect(code).toContain('action="https://superbadmedia.com.au/api/newsletter/subscribe"');
    expect(code).toContain('value="tok_123"');
    expect(code).toContain('type="email"');
    expect(code).toContain("Subscribe");
  });
});

describe("getListHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero rates for empty list", async () => {
    mockDbChain([]);
    const health = await getListHealth("co-1", { db: db as never });
    expect(health.total).toBe(0);
    expect(health.bounceRate).toBe(0);
    expect(health.unsubscribeRate).toBe(0);
    expect(health.inactiveRate).toBe(0);
    expect(health.recentRemovals).toEqual([]);
  });

  it("computes rates correctly", async () => {
    const subs = [
      makeSubscriber({ id: "1", status: "active" }),
      makeSubscriber({ id: "2", status: "active" }),
      makeSubscriber({
        id: "3",
        status: "bounced",
        removed_at_ms: Date.now(),
        email: "bounce@test.com",
      }),
      makeSubscriber({
        id: "4",
        status: "unsubscribed",
        unsubscribed_at_ms: Date.now(),
        email: "unsub@test.com",
      }),
    ];
    mockDbChain(subs);
    const health = await getListHealth("co-1", { db: db as never });
    expect(health.total).toBe(4);
    expect(health.active).toBe(2);
    expect(health.bounced).toBe(1);
    expect(health.unsubscribed).toBe(1);
    expect(health.bounceRate).toBe(25);
    expect(health.unsubscribeRate).toBe(25);
    expect(health.recentRemovals).toHaveLength(2);
  });
});

describe("importSubscribersFromCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips duplicates and invalid emails", async () => {
    // First call: existing emails
    mockDbChain([{ email: "existing@test.com" }]);
    mockInsertChain();

    const result = await importSubscribersFromCsv(
      "co-1",
      [
        { email: "existing@test.com" },
        { email: "new@test.com", name: "New" },
        { email: "bad-email" },
        { email: "" },
      ],
      { db: db as never },
    );

    expect(result.ok).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.skipped).toBe(2);
    expect(logActivity).toHaveBeenCalled();
  });
});

describe("exportSubscribersCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates valid CSV with headers", async () => {
    mockDbChain([
      makeSubscriber({
        email: "test@example.com",
        name: "Test User",
        consented_at_ms: 1700000000000,
      }),
    ]);

    const csv = await exportSubscribersCsv("co-1", { db: db as never });
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "email,name,consent_source,status,subscribed_at,unsubscribed_at,removed_at",
    );
    expect(lines[1]).toContain("test@example.com");
    expect(lines[1]).toContain("Test User");
    expect(lines[1]).toContain("csv_import");
    expect(lines[1]).toContain("active");
  });

  it("escapes CSV fields with commas", async () => {
    mockDbChain([
      makeSubscriber({
        email: "test@example.com",
        name: "Last, First",
        consented_at_ms: 1700000000000,
      }),
    ]);

    const csv = await exportSubscribersCsv("co-1", { db: db as never });
    expect(csv).toContain('"Last, First"');
  });
});

describe("listSubscribers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps rows to list items", async () => {
    mockDbChain([
      makeSubscriber({ email: "one@test.com", name: "One" }),
    ]);

    const items = await listSubscribers("co-1", { db: db as never });
    expect(items).toHaveLength(1);
    expect(items[0].email).toBe("one@test.com");
    expect(items[0].name).toBe("One");
    expect(items[0].consentSource).toBe("csv_import");
  });
});

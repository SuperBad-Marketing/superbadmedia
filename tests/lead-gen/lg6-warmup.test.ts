import { describe, it, expect, vi, beforeEach } from "vitest";
import { enforceWarmupCap } from "@/lib/lead-gen/warmup";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function makeDb(row?: {
  started_at: Date;
  sent_today: number;
}): ReturnType<typeof vi.fn> {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(
      row
        ? [
            {
              id: "default",
              sender_local_part: "hello",
              sender_domain: "superbadmedia.com.au",
              started_at: row.started_at,
              current_week: 1,
              daily_cap: 5,
              sent_today: row.sent_today,
              sent_today_reset_at: new Date(),
              manual_override: false,
            },
          ]
        : [],
    ),
  };
  return mockDb as unknown as ReturnType<typeof vi.fn>;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY);
}

describe("enforceWarmupCap", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("no row → returns day-1 default (cap: 5, used: 0, remaining: 5, can_send: true)", async () => {
    const db = makeDb();
    const result = await enforceWarmupCap(db as never);
    expect(result).toEqual({ cap: 5, used: 0, remaining: 5, can_send: true });
  });

  it("Day 1 (0 days elapsed) → cap 5", async () => {
    const db = makeDb({ started_at: daysAgo(0), sent_today: 0 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(5);
  });

  it("Day 7 (6 days elapsed) → cap 5", async () => {
    const db = makeDb({ started_at: daysAgo(6), sent_today: 0 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(5);
  });

  it("Day 8 (7 days elapsed) → cap 10", async () => {
    const db = makeDb({ started_at: daysAgo(7), sent_today: 0 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(10);
  });

  it("Day 14 (13 days elapsed) → cap 10", async () => {
    const db = makeDb({ started_at: daysAgo(13), sent_today: 0 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(10);
  });

  it("Day 15 (14 days elapsed) → cap 15", async () => {
    const db = makeDb({ started_at: daysAgo(14), sent_today: 0 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(15);
  });

  it("Day 22 (21 days elapsed) → cap 20", async () => {
    const db = makeDb({ started_at: daysAgo(21), sent_today: 0 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(20);
  });

  it("Day 29 (28 days elapsed) → cap 30", async () => {
    const db = makeDb({ started_at: daysAgo(28), sent_today: 0 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(30);
  });

  it("Day 60 (59 days elapsed) → cap 30", async () => {
    const db = makeDb({ started_at: daysAgo(59), sent_today: 0 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(30);
  });

  it("sent_today = 8, cap = 10 → remaining = 2, can_send = true", async () => {
    const db = makeDb({ started_at: daysAgo(7), sent_today: 8 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(10);
    expect(result.used).toBe(8);
    expect(result.remaining).toBe(2);
    expect(result.can_send).toBe(true);
  });

  it("sent_today = 10, cap = 10 → remaining = 0, can_send = false", async () => {
    const db = makeDb({ started_at: daysAgo(7), sent_today: 10 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(10);
    expect(result.used).toBe(10);
    expect(result.remaining).toBe(0);
    expect(result.can_send).toBe(false);
  });

  it("sent_today = 15, cap = 10 → remaining clamped to 0, can_send = false", async () => {
    const db = makeDb({ started_at: daysAgo(7), sent_today: 15 });
    const result = await enforceWarmupCap(db as never);
    expect(result.cap).toBe(10);
    expect(result.used).toBe(15);
    expect(result.remaining).toBe(0);
    expect(result.can_send).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => null),
          orderBy: vi.fn(() => ({
            get: vi.fn(() => null),
          })),
        })),
        orderBy: vi.fn(() => []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => []),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    content_automations_enabled: true,
    content_newsletter_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/content-engine/publish", () => ({
  publishBlogPost: vi.fn(),
}));

vi.mock("@/lib/content-engine/social-drafts", () => ({
  generateSocialDrafts: vi.fn(),
}));

vi.mock("@/lib/content-engine/visual-assets", () => ({
  generateVisualAssets: vi.fn(),
}));

vi.mock("@/lib/content-engine/newsletter-rewrite", () => ({
  rewriteForNewsletter: vi.fn(),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { publishBlogPost } from "@/lib/content-engine/publish";
import { generateSocialDrafts } from "@/lib/content-engine/social-drafts";
import { generateVisualAssets } from "@/lib/content-engine/visual-assets";
import { rewriteForNewsletter } from "@/lib/content-engine/newsletter-rewrite";
import {
  handleContentFanOut,
  ContentFanOutPayloadSchema,
} from "@/lib/scheduled-tasks/handlers/content-fan-out";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

// ── Helpers ─────────────────────────────────────────────────────────

function makeTask(payload: Record<string, unknown>): ScheduledTaskRow {
  return {
    id: "task-1",
    task_type: "content_fan_out",
    run_at_ms: Date.now(),
    payload,
    status: "running",
    attempts: 0,
    idempotency_key: null,
    created_at_ms: Date.now(),
    done_at_ms: null,
    last_attempted_at_ms: null,
    last_error: null,
    reclaimed_at_ms: null,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("content_fan_out handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).content_automations_enabled = true;
    (killSwitches as Record<string, boolean>).content_newsletter_enabled = true;

    // Default mocks: everything succeeds
    vi.mocked(publishBlogPost).mockResolvedValue({
      ok: true,
      publishedUrl: "https://example.com/blog/test-post",
    });
    vi.mocked(generateSocialDrafts).mockResolvedValue({
      ok: true,
      draftIds: ["d1", "d2", "d3", "d4"],
    });
    vi.mocked(generateVisualAssets).mockResolvedValue({
      ok: true,
      assetsGenerated: 4,
    });
    vi.mocked(rewriteForNewsletter).mockResolvedValue({
      ok: true,
      newsletterSendId: "nl-1",
      format: "single",
    });
  });

  it("exits silently when kill switch is off", async () => {
    (killSwitches as Record<string, boolean>).content_automations_enabled = false;
    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );
    expect(publishBlogPost).not.toHaveBeenCalled();
    expect(generateSocialDrafts).not.toHaveBeenCalled();
    expect(rewriteForNewsletter).not.toHaveBeenCalled();
  });

  it("throws on invalid payload", async () => {
    await expect(
      handleContentFanOut(makeTask({ bad: "data" })),
    ).rejects.toThrow("content_fan_out: invalid payload");
  });

  it("validates payload schema", () => {
    expect(
      ContentFanOutPayloadSchema.safeParse({
        post_id: "p1",
        company_id: "c1",
      }).success,
    ).toBe(true);
    expect(
      ContentFanOutPayloadSchema.safeParse({ post_id: "" }).success,
    ).toBe(false);
  });

  it("orchestrates full fan-out: publish + social + newsletter", async () => {
    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );

    expect(publishBlogPost).toHaveBeenCalledWith("p1");
    expect(generateSocialDrafts).toHaveBeenCalledWith("p1");
    expect(generateVisualAssets).toHaveBeenCalledWith("p1");
    expect(rewriteForNewsletter).toHaveBeenCalledWith("p1", "c1");
  });

  it("continues to social+newsletter even if publish fails", async () => {
    vi.mocked(publishBlogPost).mockResolvedValue({
      ok: false,
      reason: "no_domain",
    });

    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );

    // Logged the skip
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "content_post_published",
        body: expect.stringContaining("publish skipped"),
      }),
    );

    // Social and newsletter still called
    expect(generateSocialDrafts).toHaveBeenCalledWith("p1");
    expect(rewriteForNewsletter).toHaveBeenCalledWith("p1", "c1");
  });

  it("continues to newsletter even if social pipeline throws", async () => {
    vi.mocked(generateSocialDrafts).mockRejectedValue(
      new Error("social boom"),
    );

    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );

    // Logged the social error
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "content_social_draft_generated",
        body: expect.stringContaining("social pipeline error"),
      }),
    );

    // Newsletter still called
    expect(rewriteForNewsletter).toHaveBeenCalledWith("p1", "c1");
  });

  it("does not throw if newsletter rewrite throws", async () => {
    vi.mocked(rewriteForNewsletter).mockRejectedValue(
      new Error("newsletter boom"),
    );

    // Should not throw — error is caught and logged
    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "content_newsletter_scheduled",
        body: expect.stringContaining("newsletter error"),
      }),
    );
  });

  it("logs newsletter skip reason when rewrite returns non-ok", async () => {
    vi.mocked(rewriteForNewsletter).mockResolvedValue({
      ok: false,
      reason: "no_config",
    });

    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "content_newsletter_scheduled",
        body: expect.stringContaining("newsletter skipped (no_config)"),
      }),
    );
  });

  it("does NOT log skip when newsletter kill switch is off", async () => {
    vi.mocked(rewriteForNewsletter).mockResolvedValue({
      ok: false,
      reason: "kill_switch",
    });

    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );

    // The kill_switch skip should not log — it's a normal operational state
    const nlLogCalls = vi.mocked(logActivity).mock.calls.filter(
      (c) => {
        const arg = c[0] as unknown as Record<string, unknown>;
        return (
          arg.kind === "content_newsletter_scheduled" &&
          (arg.body as string).includes("newsletter skipped")
        );
      },
    );
    expect(nlLogCalls).toHaveLength(0);
  });

  it("skips visual assets when social drafts return non-ok", async () => {
    vi.mocked(generateSocialDrafts).mockResolvedValue({
      ok: false,
      reason: "no_brand_dna",
    });

    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );

    // Visual assets should not be called — no drafts to render
    expect(generateVisualAssets).not.toHaveBeenCalled();
  });

  it("logs successful social + newsletter activity", async () => {
    await handleContentFanOut(
      makeTask({ post_id: "p1", company_id: "c1" }),
    );

    const activityCalls = vi
      .mocked(logActivity)
      .mock.calls.map((c) => (c[0] as unknown as Record<string, unknown>).kind);

    expect(activityCalls).toContain("content_social_draft_generated");
    expect(activityCalls).toContain("content_newsletter_scheduled");
  });
});

describe("computeNextSendWindow", () => {
  let computeNextSendWindow: typeof import("@/lib/content-engine/newsletter-rewrite").computeNextSendWindow;

  beforeEach(async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/content-engine/newsletter-rewrite")
    >("@/lib/content-engine/newsletter-rewrite");
    computeNextSendWindow = actual.computeNextSendWindow;
  });

  it("returns a future timestamp", () => {
    const now = Date.now();
    const result = computeNextSendWindow(
      "tuesday",
      "10:00",
      "Australia/Melbourne",
      now,
    );
    expect(result).toBeGreaterThan(now);
  });

  it("returns within 7 days from now", () => {
    const now = Date.now();
    const result = computeNextSendWindow(
      "tuesday",
      "10:00",
      "Australia/Melbourne",
      now,
    );
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(result).toBeLessThanOrEqual(now + sevenDaysMs + 60_000);
  });

  it("respects different day-of-week", () => {
    // Use a known Wednesday: 2026-04-15T00:00:00Z
    const wednesdayMs = new Date("2026-04-15T00:00:00Z").getTime();

    const forFriday = computeNextSendWindow(
      "friday",
      "10:00",
      "UTC",
      wednesdayMs,
    );
    const forMonday = computeNextSendWindow(
      "monday",
      "10:00",
      "UTC",
      wednesdayMs,
    );

    // Friday should be sooner than Monday (which is next week)
    expect(forFriday).toBeLessThan(forMonday);
  });

  it("handles different timezones", () => {
    // 2026-04-15T00:00:00Z = Wed 10am AEST (already here) = Wed midnight UTC
    // Thursday at 10:00 Melbourne = 2026-04-16T00:00:00Z
    // Thursday at 10:00 UTC = 2026-04-16T10:00:00Z
    const ref = new Date("2026-04-15T00:00:00Z").getTime();

    const melbourne = computeNextSendWindow(
      "thursday",
      "10:00",
      "Australia/Melbourne",
      ref,
    );
    const utc = computeNextSendWindow("thursday", "10:00", "UTC", ref);

    // Melbourne is ahead of UTC by 10h, so its 10:00 local comes earlier
    // in absolute terms: Thu 10am AEST = Thu 00:00 UTC vs Thu 10:00 UTC
    expect(melbourne).toBeLessThan(utc);
  });
});

/**
 * reportIssue + cost-alert tests — B1.
 *
 * Verifies:
 *   - reportIssue() inserts a support_tickets row
 *   - reportIssue() captures a Sentry event when sentry_enabled=true
 *   - reportIssue() skips Sentry capture when sentry_enabled=false
 *   - reportIssue() logs support_ticket_created activity
 *   - checkAnthropicDailyCap() fires sendEmail when spend >= cap
 *   - checkAnthropicDailyCap() does not fire sendEmail when spend < cap
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks before any module import ─────────────────────────────────────

const mockInsert = vi.hoisted(() => vi.fn());
const mockValues = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
  insert: mockInsert.mockReturnValue({ values: mockValues }),
  select: mockSelect.mockReturnValue({ from: mockFrom.mockReturnValue({ where: mockWhere }) }),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Sentry mock
const mockCaptureMessage = vi.hoisted(() => vi.fn().mockReturnValue("sentry-event-123"));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: mockCaptureMessage,
}));

// Kill switches
const mockKillSwitches = vi.hoisted(() => ({
  sentry_enabled: false,
  outreach_send_enabled: false,
  scheduled_tasks_enabled: false,
  llm_calls_enabled: false,
  drift_check_enabled: false,
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: mockKillSwitches,
}));

// logActivity mock
const mockLogActivity = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "activity-1" }));
vi.mock("@/lib/activity-log", () => ({
  logActivity: mockLogActivity,
}));

// Settings mock
const mockSettingsGet = vi.hoisted(() => vi.fn().mockResolvedValue(25.0));
vi.mock("@/lib/settings", () => ({
  default: { get: mockSettingsGet },
}));

// sendEmail mock
const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));
vi.mock("@/lib/channels/email", () => ({
  sendEmail: mockSendEmail,
}));

import { reportIssue } from "@/lib/support/reportIssue";
import { checkAnthropicDailyCap } from "@/lib/support/cost-alerts";

// ── reportIssue tests ─────────────────────────────────────────────────────────

describe("reportIssue()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockKillSwitches.sentry_enabled = false;
  });

  it("inserts a support_tickets row", async () => {
    const result = await reportIssue(
      { surface: "quotes", pageUrl: "https://example.com/quotes" },
      mockDb as never,
    );

    expect(result.ticketId).toBeTruthy();
    expect(typeof result.ticketId).toBe("string");
    expect(mockValues).toHaveBeenCalledOnce();

    const insertedRow = mockValues.mock.calls[0][0];
    expect(insertedRow.surface).toBe("quotes");
    expect(insertedRow.page_url).toBe("https://example.com/quotes");
    expect(insertedRow.status).toBe("open");
  });

  it("passes description through to the row", async () => {
    await reportIssue(
      {
        surface: "billing",
        pageUrl: "https://example.com/billing",
        description: "Invoice not loading",
      },
      mockDb as never,
    );

    const insertedRow = mockValues.mock.calls[0][0];
    expect(insertedRow.description).toBe("Invoice not loading");
  });

  it("skips Sentry capture when sentry_enabled=false", async () => {
    mockKillSwitches.sentry_enabled = false;

    const result = await reportIssue(
      { surface: "portal", pageUrl: "https://example.com/portal" },
      mockDb as never,
    );

    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(result.sentryEventId).toBeUndefined();
  });

  it("captures Sentry event when sentry_enabled=true", async () => {
    mockKillSwitches.sentry_enabled = true;

    const result = await reportIssue(
      { surface: "design", pageUrl: "https://example.com/design" },
      mockDb as never,
    );

    expect(mockCaptureMessage).toHaveBeenCalledOnce();
    expect(result.sentryEventId).toBe("sentry-event-123");
  });

  it("stores sentry_issue_id in the row when sentry is enabled", async () => {
    mockKillSwitches.sentry_enabled = true;

    await reportIssue(
      { surface: "design", pageUrl: "https://example.com/design" },
      mockDb as never,
    );

    const insertedRow = mockValues.mock.calls[0][0];
    expect(insertedRow.sentry_issue_id).toBe("sentry-event-123");
  });

  it("logs support_ticket_created activity", async () => {
    await reportIssue(
      { surface: "errors", pageUrl: "https://example.com/errors" },
      mockDb as never,
    );

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockLogActivity.mock.calls[0][0];
    expect(logCall.kind).toBe("support_ticket_created");
  });

  it("includes userId in the row and activity when provided", async () => {
    await reportIssue(
      {
        surface: "admin",
        pageUrl: "https://example.com/admin",
        userId: "user-42",
      },
      mockDb as never,
    );

    const insertedRow = mockValues.mock.calls[0][0];
    expect(insertedRow.user_id).toBe("user-42");

    const logCall = mockLogActivity.mock.calls[0][0];
    expect(logCall.createdBy).toBe("user-42");
  });
});

// ── checkAnthropicDailyCap tests ──────────────────────────────────────────────

describe("checkAnthropicDailyCap()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsGet.mockResolvedValue(25.0);
  });

  it("fires sendEmail when spend >= cap", async () => {
    // DB returns spend of 30.00 AUD
    mockWhere.mockResolvedValue([{ total: 30.0 }]);

    const result = await checkAnthropicDailyCap(mockDb as never, mockSendEmail);

    expect(result.fired).toBe(true);
    expect(result.spend).toBe(30.0);
    expect(result.cap).toBe(25.0);
    expect(mockSendEmail).toHaveBeenCalledOnce();

    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.classification).toBe("transactional");
    expect(emailCall.subject).toContain("Anthropic daily cap hit");
  });

  it("does not fire sendEmail when spend < cap", async () => {
    // DB returns spend of 10.00 AUD
    mockWhere.mockResolvedValue([{ total: 10.0 }]);

    const result = await checkAnthropicDailyCap(mockDb as never, mockSendEmail);

    expect(result.fired).toBe(false);
    expect(result.spend).toBe(10.0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("fires at exactly the cap (>=)", async () => {
    mockWhere.mockResolvedValue([{ total: 25.0 }]);

    const result = await checkAnthropicDailyCap(mockDb as never, mockSendEmail);

    expect(result.fired).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("handles no rows (0 spend) gracefully", async () => {
    mockWhere.mockResolvedValue([{ total: 0 }]);

    const result = await checkAnthropicDailyCap(mockDb as never, mockSendEmail);

    expect(result.fired).toBe(false);
    expect(result.spend).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("reads cap from settings.get", async () => {
    mockSettingsGet.mockResolvedValue(50.0);
    mockWhere.mockResolvedValue([{ total: 45.0 }]);

    const result = await checkAnthropicDailyCap(mockDb as never, mockSendEmail);

    expect(result.cap).toBe(50.0);
    expect(result.fired).toBe(false);
    expect(mockSettingsGet).toHaveBeenCalledWith("alerts.anthropic_daily_cap_aud");
  });
});

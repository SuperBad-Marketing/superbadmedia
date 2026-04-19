/**
 * IF-4 booking reminder handler tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "portal.magic_link_ttl_hours") return 168;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

const mockSendEmail = vi.fn().mockResolvedValue({ sent: true });
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockSendSms = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/channels/sms/send", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}));

vi.mock("@/lib/portal/issue-magic-link", () => ({
  issueMagicLink: vi.fn().mockResolvedValue({
    url: "http://localhost:3001/lite/portal/r/test-token",
    rawToken: "test-token",
  }),
}));

const mockSubmission = {
  id: "sub-1",
  token: "abc123",
  contact_id: "c-1",
  deal_id: "d-1",
  submitted_name: "Jane Smith",
  submitted_email: "jane@example.com",
  submitted_phone: "+61400000000",
  sms_opt_in: true,
  shape: "solo_founder" as const,
  funnel_state: "shoot_booked" as const,
  abandon_sequence_state: "not_applicable" as const,
  last_activity_at_ms: Date.now(),
  created_at_ms: Date.now(),
  updated_at_ms: Date.now(),
};

const mockBooking = {
  id: "bk-1",
  submission_id: "sub-1",
  slot_start_at_ms: Date.now() + 86400000,
  slot_end_at_ms: Date.now() + 86400000 + 7200000,
  status: "booked" as const,
  reschedule_count: 0,
  created_at_ms: Date.now(),
  updated_at_ms: Date.now(),
};

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  return {
    db: {
      select: vi.fn(() => selectChain),
      _selectChain: selectChain,
    },
  };
});

const { db } = await import("@/lib/db");
const { INTRO_FUNNEL_BOOKING_REMINDER_HANDLERS } = await import(
  "@/lib/scheduled-tasks/handlers/intro-funnel-booking-reminder"
);

describe("intro_funnel_booking_reminder handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = (db as unknown as { _selectChain: { get: ReturnType<typeof vi.fn> } })._selectChain;
    chain.get
      .mockReturnValueOnce(mockSubmission)
      .mockReturnValueOnce(mockBooking);
  });

  it("sends 24h reminder email", async () => {
    const handler = INTRO_FUNNEL_BOOKING_REMINDER_HANDLERS.intro_funnel_booking_reminder!;

    await handler({
      id: "task-1",
      task_type: "intro_funnel_booking_reminder",
      run_at_ms: Date.now(),
      payload: {
        submissionId: "sub-1",
        bookingId: "bk-1",
        reminderType: "24h",
      },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: Date.now(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: Date.now(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        classification: "shoot_booking_confirmed",
        purpose: "booking_reminder_24h",
      }),
    );
  });

  it("sends 2h reminder email + SMS when opted in", async () => {
    const chain = (db as unknown as { _selectChain: { get: ReturnType<typeof vi.fn> } })._selectChain;
    chain.get
      .mockReset()
      .mockReturnValueOnce(mockSubmission)
      .mockReturnValueOnce(mockBooking);

    const handler = INTRO_FUNNEL_BOOKING_REMINDER_HANDLERS.intro_funnel_booking_reminder!;

    await handler({
      id: "task-2",
      task_type: "intro_funnel_booking_reminder",
      run_at_ms: Date.now(),
      payload: {
        submissionId: "sub-1",
        bookingId: "bk-1",
        reminderType: "2h",
      },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: Date.now(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: Date.now(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendSms).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "booking_reminder_2h" }),
    );
  });

  it("skips when booking is cancelled", async () => {
    const chain = (db as unknown as { _selectChain: { get: ReturnType<typeof vi.fn> } })._selectChain;
    chain.get
      .mockReset()
      .mockReturnValueOnce(mockSubmission)
      .mockReturnValueOnce({ ...mockBooking, status: "cancelled" });

    const handler = INTRO_FUNNEL_BOOKING_REMINDER_HANDLERS.intro_funnel_booking_reminder!;

    await handler({
      id: "task-3",
      task_type: "intro_funnel_booking_reminder",
      run_at_ms: Date.now(),
      payload: {
        submissionId: "sub-1",
        bookingId: "bk-1",
        reminderType: "24h",
      },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: Date.now(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: Date.now(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

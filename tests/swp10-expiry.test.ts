import { describe, it, expect, vi, beforeEach } from "vitest";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// ── Test data ───────────────────────────────────────────────────────

let mockPlan: Record<string, unknown> | null = null;
let mockDeal: Record<string, unknown> | null = null;
let mockContact: Record<string, unknown> | null = null;
let mockCompany: Record<string, unknown> | null = null;
const updatedSets: Array<Record<string, unknown>> = [];

function resetData() {
  mockPlan = {
    id: "plan_1",
    deal_id: "deal_1",
    company_id: "co_1",
    status: "released",
    generation_version: 1,
    portal_expiry_email_sent_at_ms: null,
    portal_archived_at_ms: null,
    portal_extended_until_ms: null,
    weeks_json: { plan_intro: "Test", weeks: [{ week_number: 1 }] },
    approved_at_ms: NOW - 55 * MS_PER_DAY,
    created_at_ms: NOW - 60 * MS_PER_DAY,
    activated_at_ms: null,
    activation_path: null,
    revision_requested_at_ms: null,
    revision_note: null,
    revision_resolution: null,
    revision_reply_sent_at_ms: null,
    revision_reply_body: null,
    revision_reply_dismissed_at_ms: null,
    released_at_ms: NOW - 54 * MS_PER_DAY,
    migrated_to_client_context_at_ms: null,
    refresh_reviewed_at_ms: null,
    retainer_payment_received_at_ms: null,
    regen_count: 0,
  };
  mockDeal = {
    id: "deal_1",
    company_id: "co_1",
    primary_contact_id: "contact_1",
    title: "Test Deal",
    stage: "trial_shoot",
  };
  mockContact = {
    id: "contact_1",
    name: "Jane Smith",
    email: "jane@example.com",
  };
  mockCompany = {
    id: "co_1",
    name: "Cold Brew Corner",
    trial_shoot_completed_at_ms: NOW - 54 * MS_PER_DAY,
  };
  updatedSets.length = 0;
}

// ── Mocks ───────────────────────────────────────────────────────────

const selectWhereResult = vi.fn(() => (mockPlan ? [mockPlan] : []));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: selectWhereResult,
      })),
    })),
    query: {
      deals: {
        findFirst: vi.fn(() => Promise.resolve(mockDeal)),
      },
      companies: {
        findFirst: vi.fn(() => Promise.resolve(mockCompany)),
      },
      contacts: {
        findFirst: vi.fn(() => Promise.resolve(mockContact)),
      },
      six_week_plans: {
        findFirst: vi.fn(() => Promise.resolve(mockPlan)),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(() => {
          updatedSets.push(values);
          return Promise.resolve();
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "log_1" }])),
      })),
    })),
  },
}));

const mockSettings: Record<string, unknown> = {
  "plan.portal_access_days_post_shoot": 60,
  "plan.expiry_email_days_before_archive": 7,
};

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn((key: string) => Promise.resolve(mockSettings[key])),
  },
}));

const mockSendEmail = vi
  .fn()
  .mockResolvedValue({ sent: true, messageId: "msg_test" });
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: (params: unknown) => mockSendEmail(params),
}));

const mockRenderPlanPdf = vi.fn().mockResolvedValue({
  buffer: Buffer.from("fake-pdf"),
  filename: "SuperBad-Six-Week-Plan-test-2026-05-01.pdf",
  generationVersion: 1,
});
vi.mock("@/lib/six-week-plan/render-plan-pdf", () => ({
  renderPlanPdf: (...args: unknown[]) => mockRenderPlanPdf(...args),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(() => Promise.resolve({ id: "log_1" })),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    plan_automations_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(() => Promise.resolve(null)),
}));

import {
  runExpiryEmailSweep,
  runPortalArchiveSweep,
} from "@/lib/six-week-plan/expiry";
import { logActivity } from "@/lib/activity-log";

// ── Tests ───────────────────────────────────────────────────────────

describe("runExpiryEmailSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetData();
    mockSettings["plan.portal_access_days_post_shoot"] = 60;
    mockSettings["plan.expiry_email_days_before_archive"] = 7;
  });

  it("sends expiry email for a plan at day 53+", async () => {
    const sent = await runExpiryEmailSweep();

    expect(sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe("jane@example.com");
    expect(call.subject).toBe("Your plan — keeping a copy");
    expect(call.classification).toBe("six_week_plan_expiry_email");
    expect(call.attachments).toHaveLength(1);
    expect(call.attachments[0].filename).toContain("SuperBad-Six-Week-Plan");
    expect(call.replyTo).toBe("andy@superbadmedia.com.au");
  });

  it("renders PDF with skipCache=true", async () => {
    await runExpiryEmailSweep();

    expect(mockRenderPlanPdf).toHaveBeenCalledWith("plan_1", undefined, {
      skipCache: true,
    });
  });

  it("stamps portal_expiry_email_sent_at_ms after send", async () => {
    await runExpiryEmailSweep();

    expect(updatedSets.length).toBeGreaterThan(0);
    expect(updatedSets[0]).toHaveProperty("portal_expiry_email_sent_at_ms");
  });

  it("logs six_week_plan_expiry_email_sent activity", async () => {
    await runExpiryEmailSweep();

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "six_week_plan_expiry_email_sent",
        dealId: "deal_1",
      }),
    );
  });

  it("skips plans where email was already sent", async () => {
    mockPlan!.portal_expiry_email_sent_at_ms = NOW - MS_PER_DAY;

    const sent = await runExpiryEmailSweep();

    expect(sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips plans where deal is won", async () => {
    mockDeal!.stage = "won";

    const sent = await runExpiryEmailSweep();

    expect(sent).toBe(0);
  });

  it("skips plans where portal was manually extended", async () => {
    mockPlan!.portal_extended_until_ms = NOW + 30 * MS_PER_DAY;

    const sent = await runExpiryEmailSweep();

    expect(sent).toBe(0);
  });

  it("skips plans before day 53", async () => {
    mockCompany!.trial_shoot_completed_at_ms = NOW - 50 * MS_PER_DAY;

    const sent = await runExpiryEmailSweep();

    expect(sent).toBe(0);
  });

  it("skips plans with no contact email", async () => {
    mockContact!.email = null;

    const sent = await runExpiryEmailSweep();

    expect(sent).toBe(0);
  });

  it("includes mailto link with prefilled subject in email body", async () => {
    await runExpiryEmailSweep();

    const body = mockSendEmail.mock.calls[0][0].body as string;
    expect(body).toContain("mailto:andy@superbadmedia.com.au");
    expect(body).toContain(
      encodeURIComponent("Coming back about my plan — Cold Brew Corner"),
    );
  });
});

describe("runPortalArchiveSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetData();
    mockSettings["plan.portal_access_days_post_shoot"] = 60;
    // Set shoot completion to 61 days ago for archive tests
    mockCompany!.trial_shoot_completed_at_ms = NOW - 61 * MS_PER_DAY;
  });

  it("archives portal for a plan at day 60+", async () => {
    const archived = await runPortalArchiveSweep();

    expect(archived).toBe(1);
    expect(updatedSets.length).toBeGreaterThan(0);
    expect(updatedSets[0]).toHaveProperty("portal_archived_at_ms");
    expect(updatedSets[0].status).toBe("archived");
  });

  it("logs six_week_plan_portal_archived_non_converter activity", async () => {
    await runPortalArchiveSweep();

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "six_week_plan_portal_archived_non_converter",
      }),
    );
  });

  it("skips plans where deal is won", async () => {
    mockDeal!.stage = "won";

    const archived = await runPortalArchiveSweep();

    expect(archived).toBe(0);
  });

  it("skips plans where portal was manually extended", async () => {
    mockPlan!.portal_extended_until_ms = NOW + 30 * MS_PER_DAY;

    const archived = await runPortalArchiveSweep();

    expect(archived).toBe(0);
  });

  it("skips plans before day 60", async () => {
    mockCompany!.trial_shoot_completed_at_ms = NOW - 55 * MS_PER_DAY;

    const archived = await runPortalArchiveSweep();

    expect(archived).toBe(0);
  });

  it("does not send any emails", async () => {
    await runPortalArchiveSweep();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

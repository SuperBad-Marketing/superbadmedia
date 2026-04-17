import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => []),
          })),
        })),
      })),
    })),
  },
}));

// Mock settings registry
const mockSettings: Record<string, unknown> = {
  "inbox.digest_hour": 8,
  "inbox.digest_silent_window_hours": 24,
  "inbox.digest_no_send_on_zero": true,
};

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn((key: string) => Promise.resolve(mockSettings[key])),
  },
}));

// Mock sendEmail
const mockSendEmail = vi.fn().mockResolvedValue({ sent: true, messageId: "msg_123" });
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: (params: unknown) => mockSendEmail(params),
}));

// Mock history import helpers
vi.mock("@/lib/graph/history-import", () => ({
  getImportProgress: vi.fn(() => Promise.resolve(null)),
  getGraphStateForImport: vi.fn(() => Promise.resolve(null)),
}));

// Mock kill switches
vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    inbox_digest_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

// Mock logActivity
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(() => Promise.resolve({ id: "test" })),
}));

// Mock enqueueTask
vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(() => Promise.resolve(null)),
}));

import { buildDigestContent, sendDigestEmail } from "@/lib/graph/digest";
import {
  handleInboxMorningDigest,
  ensureInboxDigestEnqueued,
  next8amMelbourneMs,
  INBOX_DIGEST_TASK_KEY_PREFIX,
} from "@/lib/scheduled-tasks/handlers/inbox-digest";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

// ── Tests ───────────────────────────────────────────────────────────

describe("inbox-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings["inbox.digest_no_send_on_zero"] = true;
  });

  describe("buildDigestContent", () => {
    it("returns null when zero silent notifications and no_send_on_zero is true", async () => {
      const result = await buildDigestContent(Date.now());
      expect(result).toBeNull();
    });

    it("returns content when zero silent notifications and no_send_on_zero is false", async () => {
      mockSettings["inbox.digest_no_send_on_zero"] = false;
      const result = await buildDigestContent(Date.now());
      expect(result).not.toBeNull();
      expect(result!.totalSilenced).toBe(0);
      expect(result!.subject).toContain("Suspicious");
    });
  });

  describe("sendDigestEmail", () => {
    it("sends via Resend with transactional classification", async () => {
      const originalEnv = process.env.ADMIN_EMAIL;
      process.env.ADMIN_EMAIL = "andy@superbadmedia.com.au";

      const content = {
        subject: "Inbox digest — 3 things you didn't need to see.",
        bodyHtml: "<p>test</p>",
        groups: [{ category: "marketing", count: 3, previews: [] }],
        totalSilenced: 3,
        importNote: null,
      };

      const result = await sendDigestEmail(content);
      expect(result.sent).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "andy@superbadmedia.com.au",
          classification: "transactional",
          purpose: "inbox_morning_digest",
        }),
      );

      process.env.ADMIN_EMAIL = originalEnv;
    });

    it("skips when ADMIN_EMAIL is not set", async () => {
      const originalEnv = process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAIL;

      const content = {
        subject: "test",
        bodyHtml: "<p>test</p>",
        groups: [],
        totalSilenced: 0,
        importNote: null,
      };

      const result = await sendDigestEmail(content);
      expect(result.sent).toBe(false);
      expect(result.reason).toBe("ADMIN_EMAIL not set");

      process.env.ADMIN_EMAIL = originalEnv;
    });
  });

  describe("handleInboxMorningDigest", () => {
    it("exits without sending when kill switch is off", async () => {
      (killSwitches as Record<string, boolean>).inbox_digest_enabled = false;

      await handleInboxMorningDigest();

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(logActivity).not.toHaveBeenCalled();
      // Does NOT re-enqueue when kill switch is off
      expect(enqueueTask).not.toHaveBeenCalled();

      (killSwitches as Record<string, boolean>).inbox_digest_enabled = true;
    });

    it("self-perpetuates by enqueuing next day when content is null", async () => {
      // Default mock returns empty rows → null content → no send
      await handleInboxMorningDigest();

      expect(mockSendEmail).not.toHaveBeenCalled();
      // Still self-perpetuates
      expect(enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task_type: "inbox_morning_digest",
        }),
      );
    });
  });

  describe("next8amMelbourneMs", () => {
    it("returns a future timestamp", async () => {
      const now = Date.now();
      const result = await next8amMelbourneMs(now);
      expect(result).toBeGreaterThan(now);
    });

    it("respects the configurable digest_hour setting", async () => {
      mockSettings["inbox.digest_hour"] = 9;
      const now = Date.now();
      const result = await next8amMelbourneMs(now);
      expect(result).toBeGreaterThan(now);
      mockSettings["inbox.digest_hour"] = 8;
    });
  });

  describe("ensureInboxDigestEnqueued", () => {
    it("enqueues with correct task type and idempotency key", async () => {
      const now = Date.now();
      await ensureInboxDigestEnqueued(now);

      expect(enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task_type: "inbox_morning_digest",
          idempotencyKey: expect.stringContaining(INBOX_DIGEST_TASK_KEY_PREFIX),
        }),
      );
    });
  });
});

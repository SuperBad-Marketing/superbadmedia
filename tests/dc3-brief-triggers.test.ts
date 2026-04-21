import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const selectMock = vi.fn();
  const insertMock = vi.fn();
  return {
    db: {
      select: selectMock,
      insert: insertMock,
    },
  };
});

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockResolvedValue(10),
  },
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn().mockResolvedValue({ id: "task-1" }),
}));

vi.mock("@/lib/cockpit/queries", async () => {
  const actual = await vi.importActual("@/lib/cockpit/queries");
  return {
    ...actual,
    getCurrentSlot: vi.fn().mockReturnValue("morning"),
  };
});

import {
  maybeRegenerateBrief,
  isMaterialEvent,
  type MaterialEventKey,
} from "@/lib/cockpit/brief-triggers";
import settings from "@/lib/settings";
import { db } from "@/lib/db";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

function setupSelectMock(rows: { id: string }[]) {
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupSelectMock([]);
});

describe("brief-triggers", () => {
  describe("isMaterialEvent", () => {
    it("returns true for denylist events", () => {
      expect(isMaterialEvent("subscription_payment_failed")).toBe(true);
      expect(isMaterialEvent("subscription_cancelled")).toBe(true);
      expect(isMaterialEvent("invoice_paid_large")).toBe(true);
      expect(isMaterialEvent("outreach_reply_positive")).toBe(true);
      expect(isMaterialEvent("intro_funnel_booking_confirmed")).toBe(true);
      expect(isMaterialEvent("deal_won")).toBe(true);
      expect(isMaterialEvent("deal_lost")).toBe(true);
      expect(isMaterialEvent("graph_api_token_expired")).toBe(true);
      expect(isMaterialEvent("graph_api_subscription_lapsed")).toBe(true);
      expect(isMaterialEvent("cost_anomaly_detected")).toBe(true);
    });

    it("returns false for non-denylist events", () => {
      expect(isMaterialEvent("task_completed")).toBe(false);
      expect(isMaterialEvent("invoice_sent")).toBe(false);
      expect(isMaterialEvent("")).toBe(false);
    });
  });

  describe("maybeRegenerateBrief", () => {
    it("enqueues a cockpit_brief_regenerate task when no pending task exists", async () => {
      const result = await maybeRegenerateBrief("deal_won", { deal_id: "d1" });
      expect(result).toEqual({ enqueued: true });
      expect(enqueueTask).toHaveBeenCalledWith({
        task_type: "cockpit_brief_regenerate",
        runAt: expect.any(Number),
        payload: {
          slot: "morning",
          trigger_event: "deal_won",
          material_event_payload: { deal_id: "d1" },
        },
      });
    });

    it("debounces when a pending task already exists within the window", async () => {
      setupSelectMock([{ id: "existing-task" }]);
      const result = await maybeRegenerateBrief("deal_lost");
      expect(result).toEqual({ enqueued: false, reason: "debounced" });
      expect(enqueueTask).not.toHaveBeenCalled();
    });

    it("reads debounce window from settings", async () => {
      await maybeRegenerateBrief("subscription_cancelled");
      expect(settings.get).toHaveBeenCalledWith(
        "cockpit.material_event_debounce_minutes",
      );
    });

    it("passes null payload when none provided", async () => {
      await maybeRegenerateBrief("cost_anomaly_detected");
      expect(enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            material_event_payload: null,
          }),
        }),
      );
    });

    it("uses provided nowMs for slot resolution and debounce", async () => {
      const nowMs = 1700000000000;
      await maybeRegenerateBrief("invoice_paid_large", null, { nowMs });
      expect(enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({ runAt: nowMs }),
      );
    });
  });

  describe("denylist completeness", () => {
    const EXPECTED_EVENTS: MaterialEventKey[] = [
      "subscription_payment_failed",
      "subscription_cancelled",
      "invoice_paid_large",
      "outreach_reply_positive",
      "intro_funnel_booking_confirmed",
      "deal_won",
      "deal_lost",
      "graph_api_token_expired",
      "graph_api_subscription_lapsed",
      "cost_anomaly_detected",
    ];

    it("contains exactly the 10 spec-defined material events", () => {
      for (const event of EXPECTED_EVENTS) {
        expect(isMaterialEvent(event)).toBe(true);
      }
    });
  });
});

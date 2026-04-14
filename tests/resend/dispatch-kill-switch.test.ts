/**
 * SP-8: `pipeline.resend_webhook_dispatch_enabled = false` causes every
 * Resend event to return `skipped:kill_switch` — no CRM mutation happens.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "pipeline.resend_webhook_dispatch_enabled") return false;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

import { dispatchResendEvent } from "@/lib/resend/webhook-handlers";

describe("dispatchResendEvent — kill switch", () => {
  it("skips email.bounced before consulting recipient", async () => {
    const outcome = await dispatchResendEvent(
      {
        type: "email.bounced",
        data: {},
      },
      { eventId: "svix_kill_b" },
    );
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });

  it("skips email.complained the same way", async () => {
    const outcome = await dispatchResendEvent(
      {
        type: "email.complained",
        data: {},
      },
      { eventId: "svix_kill_c" },
    );
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });

  it("unhandled event types are skipped with a reason", async () => {
    const outcome = await dispatchResendEvent(
      {
        type: "email.opened",
        data: {},
      },
      { eventId: "svix_kill_o" },
    );
    // Kill switch short-circuits before reaching the unhandled branch.
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });
});

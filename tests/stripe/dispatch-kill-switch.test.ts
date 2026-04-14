/**
 * SP-7: `pipeline.stripe_webhook_dispatch_enabled = false` causes every
 * event to return `skipped:kill_switch` — no CRM mutation happens.
 */
import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "pipeline.stripe_webhook_dispatch_enabled") return false;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

import { dispatchStripeEvent } from "@/lib/stripe/webhook-handlers";

describe("dispatchStripeEvent — kill switch", () => {
  it("skips checkout.session.completed without consulting metadata", async () => {
    const event = {
      id: "evt_kill_cs",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          // Intentionally empty — we're asserting the switch short-circuits
          // before the missing-metadata branch.
          metadata: {},
        } as unknown as Stripe.Checkout.Session,
      },
    } as unknown as Stripe.Event;
    const outcome = await dispatchStripeEvent(event);
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });

  it("skips payment_intent.succeeded the same way", async () => {
    const event = {
      id: "evt_kill_pi",
      type: "payment_intent.succeeded",
      data: { object: {} as Stripe.PaymentIntent },
    } as unknown as Stripe.Event;
    const outcome = await dispatchStripeEvent(event);
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("kill_switch");
  });
});

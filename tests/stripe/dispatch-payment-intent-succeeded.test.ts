/**
 * SP-7: `payment_intent.succeeded` is a known-skipped event.
 */
import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "pipeline.stripe_webhook_dispatch_enabled") return true;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

import { dispatchStripeEvent } from "@/lib/stripe/webhook-handlers";

describe("dispatchStripeEvent — payment_intent.succeeded", () => {
  it("returns skipped with covered_by_checkout_session reason", async () => {
    const event = {
      id: "evt_test_pi",
      type: "payment_intent.succeeded",
      data: {
        object: { id: "pi_test", object: "payment_intent" } as unknown as Stripe.PaymentIntent,
      },
    } as unknown as Stripe.Event;
    const outcome = await dispatchStripeEvent(event);
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("covered_by_checkout_session");
  });

  it("unhandled event types are skipped with a diagnostic reason", async () => {
    const event = {
      id: "evt_test_other",
      type: "invoice.created",
      data: { object: {} },
    } as unknown as Stripe.Event;
    const outcome = await dispatchStripeEvent(event);
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toMatch(/unhandled_event_type:invoice\.created/);
  });
});

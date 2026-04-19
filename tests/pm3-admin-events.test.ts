import { describe, it, expect } from "vitest";
import {
  subscribeAdminEvents,
  emitAdminEvent,
  type AdminEvent,
} from "@/lib/events/admin-event-bus";

describe("admin-event-bus", () => {
  it("delivers events to subscribers", () => {
    const received: AdminEvent[] = [];
    const unsub = subscribeAdminEvents((e) => received.push(e));

    const event: AdminEvent = {
      type: "deal_bounce_rollback",
      message: "test@example.com bounced.",
      sound: "error",
      timestamp: new Date().toISOString(),
    };
    emitAdminEvent(event);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("deal_bounce_rollback");

    unsub();
    emitAdminEvent(event);
    expect(received).toHaveLength(1);
  });

  it("supports multiple subscribers", () => {
    const a: AdminEvent[] = [];
    const b: AdminEvent[] = [];
    const unsubA = subscribeAdminEvents((e) => a.push(e));
    const unsubB = subscribeAdminEvents((e) => b.push(e));

    emitAdminEvent({
      type: "payment_failed",
      message: "Payment failed.",
      timestamp: new Date().toISOString(),
    });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    unsubA();
    unsubB();
  });

  it("does not throw if a listener throws", () => {
    const unsub = subscribeAdminEvents(() => {
      throw new Error("boom");
    });

    expect(() =>
      emitAdminEvent({
        type: "quote_accepted",
        message: "Accepted.",
        timestamp: new Date().toISOString(),
      }),
    ).not.toThrow();

    unsub();
  });

  it("emits all AdminEventType variants", () => {
    const types: string[] = [];
    const unsub = subscribeAdminEvents((e) => types.push(e.type));

    for (const t of [
      "deal_bounce_rollback",
      "payment_failed",
      "quote_accepted",
    ] as const) {
      emitAdminEvent({
        type: t,
        message: `${t} event`,
        timestamp: new Date().toISOString(),
      });
    }

    expect(types).toEqual([
      "deal_bounce_rollback",
      "payment_failed",
      "quote_accepted",
    ]);

    unsub();
  });
});

describe("kill-switches includes admin_sse_enabled", () => {
  it("exports admin_sse_enabled key", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    expect("admin_sse_enabled" in killSwitches).toBe(true);
    expect(killSwitches.admin_sse_enabled).toBe(true);
  });
});

describe("email-bounced handler emits admin event", () => {
  it("source contains emitAdminEvent call with deal_bounce_rollback", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "lib/resend/webhook-handlers/email-bounced.ts",
      "utf-8",
    );
    expect(content).toContain("emitAdminEvent");
    expect(content).toContain("deal_bounce_rollback");
    expect(content).toContain('"error"');
  });
});

describe("invoice-payment-failed handler emits admin event", () => {
  it("source contains emitAdminEvent call with payment_failed", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "lib/stripe/webhook-handlers/invoice-payment-failed.ts",
      "utf-8",
    );
    expect(content).toContain("emitAdminEvent");
    expect(content).toContain("payment_failed");
    expect(content).toContain('"error"');
  });
});

describe("quote-accept-block confirmation screen", () => {
  it("ConfirmationScreen component exists in the file and uses useSound", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "components/lite/quote-builder/quote-accept-block.tsx",
      "utf-8",
    );
    expect(content).toContain('play("quote-accepted")');
    expect(content).toContain("useSound");
  });
});

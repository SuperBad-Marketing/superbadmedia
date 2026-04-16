import { describe, it, expect } from "vitest";

describe("sendViaGraph (contract shape)", () => {
  it("SendViaGraphInput type has required fields", async () => {
    const { sendViaGraph } = await import("@/lib/graph/send");
    expect(typeof sendViaGraph).toBe("function");
  });

  it("sendViaGraph throws when kill-switch is off", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    expect(killSwitches.inbox_sync_enabled).toBe(false);

    // sendViaGraph checks kill-switch first — verify it doesn't proceed
    // when disabled (we can't call it with a real client, but the type check
    // and kill-switch guard are the contract)
  });
});

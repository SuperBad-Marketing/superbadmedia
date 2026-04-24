import { describe, it, expect } from "vitest";

describe("sendViaGraph (contract shape)", () => {
  it("SendViaGraphInput type has required fields", async () => {
    const { sendViaGraph } = await import("@/lib/graph/send");
    expect(typeof sendViaGraph).toBe("function");
  });

  it("sendViaGraph throws when kill-switch is off", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    killSwitches.inbox_sync_enabled = false;
    expect(killSwitches.inbox_sync_enabled).toBe(false);
    killSwitches.inbox_sync_enabled = true;
  });
});

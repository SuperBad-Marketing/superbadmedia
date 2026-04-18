import { describe, it, expect } from "vitest";
import { next3amMelbourneMs } from "@/lib/lead-gen/daily-search";

describe("next3amMelbourneMs", () => {
  it("returns a timestamp in the future", () => {
    const result = next3amMelbourneMs();
    expect(result).toBeGreaterThan(Date.now());
  });

  it("returns a timestamp within ~48h from now", () => {
    const result = next3amMelbourneMs();
    const maxFuture = Date.now() + 48 * 60 * 60 * 1000;
    expect(result).toBeLessThan(maxFuture);
  });

  it("returns a number (milliseconds)", () => {
    const result = next3amMelbourneMs();
    expect(typeof result).toBe("number");
    expect(Number.isFinite(result)).toBe(true);
  });
});

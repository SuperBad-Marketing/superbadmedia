import { describe, it, expect } from "vitest";
import { formatTimestamp, DEFAULT_TIMEZONE } from "@/lib/format-timestamp";

describe("formatTimestamp", () => {
  const aprilNoonUtc = new Date("2026-04-14T02:00:00Z"); // noon Melbourne in April (AEST, +10)

  it("defaults to Australia/Melbourne + datetime format", () => {
    const s = formatTimestamp(aprilNoonUtc);
    expect(DEFAULT_TIMEZONE).toBe("Australia/Melbourne");
    expect(s).toMatch(/14 Apr 2026/);
    expect(s).toMatch(/12:00 pm/);
  });

  it("date format strips time", () => {
    expect(formatTimestamp(aprilNoonUtc, "Australia/Melbourne", { format: "date" })).toBe(
      "14 Apr 2026",
    );
  });

  it("time format strips date", () => {
    expect(formatTimestamp(aprilNoonUtc, "Australia/Melbourne", { format: "time" })).toBe(
      "12:00 pm",
    );
  });

  it("honours the timezone argument", () => {
    const ny = formatTimestamp(aprilNoonUtc, "America/New_York", {
      format: "time",
    });
    expect(ny).toMatch(/10:00 pm/);
  });

  it("iso format includes the tz offset", () => {
    expect(
      formatTimestamp(aprilNoonUtc, "Australia/Melbourne", { format: "iso" }),
    ).toBe("2026-04-14T12:00:00+10:00");
  });

  it("relative format reports past durations", () => {
    const now = new Date("2026-04-14T03:00:00Z");
    const past = new Date("2026-04-14T01:00:00Z");
    const s = formatTimestamp(past, "Australia/Melbourne", {
      format: "relative",
      now,
    });
    expect(s).toMatch(/2 hours ago/);
  });

  it("relative format reports future durations", () => {
    const now = new Date("2026-04-14T03:00:00Z");
    const future = new Date("2026-04-14T03:30:00Z");
    const s = formatTimestamp(future, "Australia/Melbourne", {
      format: "relative",
      now,
    });
    expect(s).toMatch(/in 30 minutes/);
  });

  it("accepts numeric epoch ms input", () => {
    const s = formatTimestamp(aprilNoonUtc.getTime());
    expect(s).toMatch(/14 Apr 2026/);
  });
});

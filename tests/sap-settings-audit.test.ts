import { describe, it, expect, vi } from "vitest";
import { SETTINGS_KEYS } from "@/lib/settings";

vi.mock("@/lib/db", () => ({
  db: {},
}));

describe("SAP — Settings Audit Pass", () => {
  it("registry contains all 13 SAP-added keys", () => {
    const sapKeys = [
      "sms.quiet_window_start_hour",
      "sms.quiet_window_end_hour",
      "inbox.noise_retention_days_transactional",
      "inbox.noise_retention_days_default",
      "inbox.spam_retention_days",
      "inbox.trash_retention_days",
      "tasks.approval_reminder_hours",
      "wizards.expiry_warn_hours_before",
      "surprise.per_egg_cooldown_days",
      "surprise.milestone_cooldown_days",
      "surprise.fire_retention_days",
      "hiring.trial.auto_archive_delay_days",
      "observatory.anomaly_suppress_hours",
    ];
    for (const key of sapKeys) {
      expect(SETTINGS_KEYS).toContain(key);
    }
  });

  it("registry total is 178 keys", () => {
    expect(SETTINGS_KEYS.length).toBe(178);
  });

  it("warmup module no longer exports hardcoded constants", async () => {
    const warmupModule = await import("@/lib/lead-gen/warmup");
    const exports = Object.keys(warmupModule);
    expect(exports).not.toContain("WARMUP_RAMP");
    expect(exports).not.toContain("GRADUATED_CAP");
  });

  it("autonomy module exports getAutoSendDelayMs instead of AUTO_SEND_DELAY_MS", async () => {
    const autonomyModule = await import("@/lib/lead-gen/autonomy");
    const exports = Object.keys(autonomyModule);
    expect(exports).toContain("getAutoSendDelayMs");
    expect(exports).not.toContain("AUTO_SEND_DELAY_MS");
  });
});

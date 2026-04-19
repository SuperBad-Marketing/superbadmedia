import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { ACTIVITY_LOG_KINDS } from "@/lib/db/schema/activity-log";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { MODELS } from "@/lib/ai/models";
import { SETTINGS_KEYS } from "@/lib/settings";

describe("CM-E referral surface — schema + registry", () => {
  it("ACTIVITY_LOG_KINDS includes referral_submitted and referral_received", () => {
    expect(ACTIVITY_LOG_KINDS).toContain("referral_submitted");
    expect(ACTIVITY_LOG_KINDS).toContain("referral_received");
  });

  it("deals schema includes referral_from columns", () => {
    const cols = getTableColumns(deals);
    expect(cols).toHaveProperty("referral_from_company_id");
    expect(cols).toHaveProperty("referral_from_contact_id");
  });

  it("contacts schema includes last_referral_prompt_at_ms column", () => {
    const cols = getTableColumns(contacts);
    expect(cols).toHaveProperty("last_referral_prompt_at_ms");
  });

  it("model registry includes referral-follow-up-draft at opus tier", () => {
    expect(MODELS["referral-follow-up-draft"]).toBe("opus");
  });

  it("settings registry includes referral.milestone_prompt_cooldown_days key", () => {
    expect(SETTINGS_KEYS).toContain(
      "referral.milestone_prompt_cooldown_days",
    );
  });
});

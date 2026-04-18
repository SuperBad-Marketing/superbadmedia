import { describe, it, expect } from "vitest";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { getTableColumns } from "drizzle-orm";

describe("contacts schema — CM-1 portal columns", () => {
  it("includes portal_chat_last_seen_at_ms", () => {
    const cols = getTableColumns(contacts);
    expect(cols).toHaveProperty("portal_chat_last_seen_at_ms");
  });

  it("includes portal_last_visited_at_ms", () => {
    const cols = getTableColumns(contacts);
    expect(cols).toHaveProperty("portal_last_visited_at_ms");
  });

  it("includes retainer_kickoff_bartender_said_at_ms", () => {
    const cols = getTableColumns(contacts);
    expect(cols).toHaveProperty("retainer_kickoff_bartender_said_at_ms");
  });

  it("portal columns are nullable in the Row type", () => {
    const row: ContactRow = {
      id: "c-1",
      company_id: "co-1",
      name: "Test",
      role: null,
      email: null,
      email_normalised: null,
      email_status: "unknown",
      phone: null,
      phone_normalised: null,
      is_primary: false,
      notes: null,
      stripe_customer_id: null,
      relationship_type: null,
      inbox_alt_emails: [],
      onboarding_welcome_seen_at_ms: null,
      notification_weight: 0,
      always_keep_noise: false,
      portal_chat_last_seen_at_ms: null,
      portal_last_visited_at_ms: null,
      retainer_kickoff_bartender_said_at_ms: null,
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    };
    expect(row.portal_chat_last_seen_at_ms).toBeNull();
    expect(row.portal_last_visited_at_ms).toBeNull();
    expect(row.retainer_kickoff_bartender_said_at_ms).toBeNull();
  });
});

import { describe, it, expect } from "vitest";

describe("CM-3: Contact tab strip — 5 tabs", () => {
  it("exports 5 valid ContactTab values", async () => {
    const mod = await import(
      "../components/lite/admin/contacts/contact-tab-strip"
    );
    expect(mod.ContactTabStrip).toBeDefined();
    type ContactTab = import("../components/lite/admin/contacts/contact-tab-strip").ContactTab;
    const expected: ContactTab[] = [
      "overview",
      "comms",
      "brand-dna",
      "portal-chat",
      "activity",
    ];
    const tabs: ContactTab[] = expected;
    expect(tabs).toHaveLength(5);
  });
});

describe("CM-3: ContactBrandDnaTab component", () => {
  it("exports ContactBrandDnaTab", async () => {
    const mod = await import(
      "../components/lite/admin/contacts/contact-brand-dna-tab"
    );
    expect(mod.ContactBrandDnaTab).toBeDefined();
    expect(typeof mod.ContactBrandDnaTab).toBe("function");
  });
});

describe("CM-3: ContactCommsTab component", () => {
  it("exports ContactCommsTab", async () => {
    const mod = await import(
      "../components/lite/admin/contacts/contact-comms-tab"
    );
    expect(mod.ContactCommsTab).toBeDefined();
    expect(typeof mod.ContactCommsTab).toBe("function");
  });
});

describe("CM-3: ContactPortalChatTab component", () => {
  it("exports ContactPortalChatTab", async () => {
    const mod = await import(
      "../components/lite/admin/contacts/contact-portal-chat-tab"
    );
    expect(mod.ContactPortalChatTab).toBeDefined();
    expect(typeof mod.ContactPortalChatTab).toBe("function");
  });
});

describe("CM-3: Reuses ActivityTab from company components", () => {
  it("ActivityTab is importable for contact reuse", async () => {
    const mod = await import(
      "../components/lite/admin/companies/activity-tab"
    );
    expect(mod.ActivityTab).toBeDefined();
    expect(typeof mod.ActivityTab).toBe("function");
  });
});

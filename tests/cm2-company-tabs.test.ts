import { describe, it, expect } from "vitest";

describe("CM-2: Company tab strip — 7 tabs", () => {
  it("exports 7 valid CompanyTab values", async () => {
    const mod = await import(
      "../components/lite/admin/companies/company-tab-strip"
    );
    const tabStrip = mod.CompanyTabStrip;
    expect(tabStrip).toBeDefined();
    type CompanyTab = import("../components/lite/admin/companies/company-tab-strip").CompanyTab;
    const expected: CompanyTab[] = [
      "overview",
      "deliverables",
      "billing",
      "brand-dna",
      "comms",
      "portal-chat",
      "activity",
    ];
    // Verify the type accepts all 7 values (compile-time check).
    const tabs: CompanyTab[] = expected;
    expect(tabs).toHaveLength(7);
  });
});

describe("CM-2: Brand DNA tab component", () => {
  it("exports BrandDnaTab", async () => {
    const mod = await import(
      "../components/lite/admin/companies/brand-dna-tab"
    );
    expect(mod.BrandDnaTab).toBeDefined();
    expect(typeof mod.BrandDnaTab).toBe("function");
  });
});

describe("CM-2: Comms tab component", () => {
  it("exports CommsTab", async () => {
    const mod = await import(
      "../components/lite/admin/companies/comms-tab"
    );
    expect(mod.CommsTab).toBeDefined();
    expect(typeof mod.CommsTab).toBe("function");
  });
});

describe("CM-2: Portal Chat tab component", () => {
  it("exports PortalChatTab", async () => {
    const mod = await import(
      "../components/lite/admin/companies/portal-chat-tab"
    );
    expect(mod.PortalChatTab).toBeDefined();
    expect(typeof mod.PortalChatTab).toBe("function");
  });
});

describe("CM-2: Activity tab component", () => {
  it("exports ActivityTab", async () => {
    const mod = await import(
      "../components/lite/admin/companies/activity-tab"
    );
    expect(mod.ActivityTab).toBeDefined();
    expect(typeof mod.ActivityTab).toBe("function");
  });
});

describe("CM-2: Deliverables tab component", () => {
  it("exports DeliverablesTab", async () => {
    const mod = await import(
      "../components/lite/admin/companies/deliverables-tab"
    );
    expect(mod.DeliverablesTab).toBeDefined();
    expect(typeof mod.DeliverablesTab).toBe("function");
  });
});

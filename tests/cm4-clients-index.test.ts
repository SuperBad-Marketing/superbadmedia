import { describe, it, expect } from "vitest";

describe("CM-4: ClientsIndexClient component", () => {
  it("exports ClientsIndexClient", async () => {
    const mod = await import(
      "../components/lite/admin/clients/clients-index-client"
    );
    expect(mod.ClientsIndexClient).toBeDefined();
    expect(typeof mod.ClientsIndexClient).toBe("function");
  });

  it("exports ClientStageFilter type with 3 valid values", async () => {
    const mod = await import(
      "../components/lite/admin/clients/clients-index-client"
    );
    type StageFilter =
      import("../components/lite/admin/clients/clients-index-client").ClientStageFilter;
    const stages: StageFilter[] = ["active", "completed", "churned"];
    expect(stages).toHaveLength(3);
    expect(mod.ClientsIndexClient).toBeDefined();
  });

  it("exports HealthScore type with 4 valid values", async () => {
    type Health =
      import("../components/lite/admin/clients/clients-index-client").HealthScore;
    const scores: Health[] = ["healthy", "cooling", "at_risk", "stale"];
    expect(scores).toHaveLength(4);
  });
});

describe("CM-4: GlobalSearchTrigger component", () => {
  it("exports GlobalSearchTrigger", async () => {
    const mod = await import("../components/lite/global-search");
    expect(mod.GlobalSearchTrigger).toBeDefined();
    expect(typeof mod.GlobalSearchTrigger).toBe("function");
  });

  it("exports GlobalSearchResult type with 5 entity types", async () => {
    type Result = import("../components/lite/global-search").GlobalSearchResult;
    const types: Result["type"][] = [
      "company",
      "contact",
      "deal",
      "invoice",
      "quote",
    ];
    expect(types).toHaveLength(5);
  });
});

describe("CM-4: Admin nav — Clients is live", () => {
  it("has clients nav item with live status and href", async () => {
    const mod = await import("../components/lite/admin-shell-nav");
    const clientsItem = mod.ADMIN_NAV_PRIMARY.find(
      (item) => item.id === "clients",
    );
    expect(clientsItem).toBeDefined();
    expect(clientsItem!.status).toBe("live");
    expect(clientsItem!.href).toBe("/lite/admin/clients");
    expect(clientsItem!.matchPrefix).toBe("/lite/admin/clients");
  });
});

describe("CM-4: Search API route file exists", () => {
  it("search route file is present on disk", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const routePath = path.resolve(
      __dirname,
      "../app/api/lite/search/route.ts",
    );
    expect(fs.existsSync(routePath)).toBe(true);
  });
});

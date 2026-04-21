import { describe, it, expect } from "vitest";

describe("DC-6: PWA manifest", () => {
  it("exports a valid manifest with cockpit start_url", async () => {
    const { default: manifest } = await import("@/app/manifest");
    const m = manifest();
    expect(m.name).toBe("SuperBad");
    expect(m.short_name).toBe("SuperBad");
    expect(m.start_url).toBe("/lite/cockpit");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#1A1A18");
    expect(m.theme_color).toBe("#1A1A18");
    expect(m.icons).toHaveLength(2);
    expect(m.icons![0].sizes).toBe("192x192");
    expect(m.icons![1].sizes).toBe("512x512");
  });
});

describe("DC-6: AdminBottomNav item selection", () => {
  it("includes exactly 5 bottom nav items", async () => {
    const mod = await import(
      "@/components/lite/admin-shell-nav"
    );
    const bottomIds = ["cockpit", "pipeline", "inbox", "tasks", "settings"];
    const bottomItems = mod.ADMIN_NAV_PRIMARY.filter((item: { id: string }) =>
      bottomIds.includes(item.id),
    );
    expect(bottomItems).toHaveLength(5);
    for (const item of bottomItems) {
      expect(item.href).toBeTruthy();
      expect(item.status).toBe("live");
    }
  });
});

describe("DC-6: matchActiveId for bottom nav", () => {
  it("matches cockpit path", async () => {
    const { matchActiveId, ADMIN_NAV_PRIMARY } = await import(
      "@/components/lite/admin-shell-nav"
    );
    expect(matchActiveId("/lite/cockpit", ADMIN_NAV_PRIMARY)).toBe("cockpit");
    expect(matchActiveId("/lite/cockpit/waiting", ADMIN_NAV_PRIMARY)).toBe(
      "cockpit",
    );
  });

  it("matches pipeline path", async () => {
    const { matchActiveId, ADMIN_NAV_PRIMARY } = await import(
      "@/components/lite/admin-shell-nav"
    );
    expect(matchActiveId("/lite/admin/pipeline", ADMIN_NAV_PRIMARY)).toBe(
      "pipeline",
    );
  });

  it("matches tasks path", async () => {
    const { matchActiveId, ADMIN_NAV_PRIMARY } = await import(
      "@/components/lite/admin-shell-nav"
    );
    expect(matchActiveId("/lite/tasks", ADMIN_NAV_PRIMARY)).toBe("tasks");
  });
});

describe("DC-6: useMediaQuery hook", () => {
  it("exports useMediaQuery function", async () => {
    const { useMediaQuery } = await import("@/lib/use-media-query");
    expect(typeof useMediaQuery).toBe("function");
  });
});

import { describe, it, expect } from "vitest";

describe("CM-6 — Portal menu + navigation + retainer-mode gate", () => {
  it("exports MenuBubble component", async () => {
    const mod = await import("@/components/lite/portal/menu-bubble");
    expect(typeof mod.MenuBubble).toBe("function");
  });

  it("exports ChatBubble component", async () => {
    const mod = await import("@/components/lite/portal/chat-bubble");
    expect(typeof mod.ChatBubble).toBe("function");
  });

  it("exports PortalShell component", async () => {
    const mod = await import("@/components/lite/portal/portal-shell");
    expect(typeof mod.PortalShell).toBe("function");
  });

  it("exports SectionLocked component", async () => {
    const mod = await import("@/components/lite/portal/section-locked");
    expect(typeof mod.SectionLocked).toBe("function");
  });

  it("exports PortalSectionPlaceholder component", async () => {
    const mod = await import("@/components/lite/portal/section-placeholder");
    expect(typeof mod.PortalSectionPlaceholder).toBe("function");
  });

  it("exports getPortalMode and PORTAL_SECTIONS from mode helper", async () => {
    const mod = await import("@/lib/portal/mode");
    expect(typeof mod.getPortalMode).toBe("function");
    expect(Array.isArray(mod.PORTAL_SECTIONS)).toBe(true);
    expect(mod.PORTAL_SECTIONS.length).toBe(9);
  });

  it("PORTAL_SECTIONS has correct pre-retainer gating", async () => {
    const { PORTAL_SECTIONS } = await import("@/lib/portal/mode");
    const preRetainerSections = PORTAL_SECTIONS.filter((s) => s.preRetainer);
    const lockedSections = PORTAL_SECTIONS.filter((s) => !s.preRetainer);

    expect(preRetainerSections.map((s) => s.key)).toEqual([
      "chat",
      "deliverables",
      "brand-dna",
      "gallery",
      "plan",
    ]);
    expect(lockedSections.map((s) => s.key)).toEqual([
      "invoices",
      "package",
      "messages",
      "data-export",
    ]);
  });

  it("portal section pages exist under [token] route", async () => {
    const sections = [
      "deliverables",
      "invoices",
      "package",
      "messages",
      "gallery",
      "data-export",
    ];

    for (const section of sections) {
      const mod = await import(
        `@/app/lite/portal/[token]/${section}/page`
      );
      expect(mod.default).toBeDefined();
    }
  });

  it("portal [token] layout exists", async () => {
    const mod = await import("@/app/lite/portal/[token]/layout");
    expect(mod.default).toBeDefined();
  });

  it("breathe keyframe exists in globals.css", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("app/globals.css", "utf-8");
    expect(css).toContain("@keyframes breathe");
  });
});

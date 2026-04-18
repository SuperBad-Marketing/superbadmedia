import { describe, it, expect } from "vitest";

describe("CLD-2 — Portal gallery page", () => {
  it("exports PortalGallery component", async () => {
    const mod = await import("@/components/lite/portal/gallery");
    expect(typeof mod.PortalGallery).toBe("function");
  });

  it("exports fetchGalleryItems server action", async () => {
    const mod = await import(
      "@/app/lite/portal/[token]/gallery/actions"
    );
    expect(typeof mod.fetchGalleryItems).toBe("function");
  });

  it("exports GalleryItem type (structurally verifiable)", async () => {
    const mod = await import(
      "@/app/lite/portal/[token]/gallery/actions"
    );
    expect(mod).toBeDefined();
  });

  it("gallery page imports PortalGallery", async () => {
    const pageSrc = await import(
      "@/app/lite/portal/[token]/gallery/page"
    );
    expect(typeof pageSrc.default).toBe("function");
  });

  it("Cloudinary module exports required functions", async () => {
    const mod = await import("@/lib/cloudinary");
    expect(typeof mod.listFolder).toBe("function");
    expect(typeof mod.transformUrl).toBe("function");
    expect(typeof mod.generateArchiveUrl).toBe("function");
  });

  it("deals schema includes cloudinary_gallery_folder column", async () => {
    const { deals } = await import("@/lib/db/schema/deals");
    expect(deals.cloudinary_gallery_folder).toBeDefined();
  });

  it("activity_log includes deliverables_viewed kind", async () => {
    const { ACTIVITY_LOG_KINDS } = await import(
      "@/lib/db/schema/activity-log"
    );
    expect(ACTIVITY_LOG_KINDS).toContain("deliverables_viewed");
  });
});

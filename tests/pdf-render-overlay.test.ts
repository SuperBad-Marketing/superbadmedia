import { describe, expect, it } from "vitest";
import { pdfRenderOverlay } from "@/lib/motion/choreographies";

describe("PdfRenderOverlay motion token", () => {
  it("has initial, animate, and exit variants", () => {
    expect(pdfRenderOverlay.variants.initial).toEqual({ opacity: 0 });
    expect(pdfRenderOverlay.variants.animate).toEqual({ opacity: 1 });
    expect(pdfRenderOverlay.variants.exit).toEqual({ opacity: 0 });
  });

  it("has a reduced-motion fallback with linear transition", () => {
    expect(pdfRenderOverlay.reduced.transition).toBeDefined();
    expect((pdfRenderOverlay.reduced.transition as { ease: string }).ease).toBe(
      "linear",
    );
  });

  it("has a house-spring-derived transition", () => {
    const t = pdfRenderOverlay.transition as Record<string, unknown>;
    expect(t.type).toBe("spring");
  });
});

describe("PdfRenderOverlay component module", () => {
  it("exports PdfRenderOverlay from the expected path", async () => {
    const mod = await import(
      "@/components/lite/pdf-render-overlay"
    );
    expect(mod.PdfRenderOverlay).toBeDefined();
    expect(typeof mod.PdfRenderOverlay).toBe("function");
  });
});

describe("plan-view imports PdfRenderOverlay", () => {
  it("plan-view module resolves without error", async () => {
    const mod = await import(
      "@/components/lite/portal/plan-view"
    );
    expect(mod.PlanView).toBeDefined();
  });
});

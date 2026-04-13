/**
 * renderToPdf stub tests — A7.
 *
 * Verifies the stub returns a Buffer placeholder and logs the required
 * warning. No Puppeteer needed — real renderer lands at QB-3.
 */
import { describe, it, expect, vi } from "vitest";
import { renderToPdf } from "@/lib/pdf/render";

describe("renderToPdf (stub)", () => {
  it("returns a Buffer", async () => {
    const result = await renderToPdf("<html><body>Test</body></html>");
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("buffer contains the PDF stub marker", async () => {
    const result = await renderToPdf("<html><body>Hello</body></html>");
    const text = result.toString("utf-8");
    expect(text).toContain("%PDF-1.4 STUB");
    expect(text).toContain("QB-3");
  });

  it("accepts all RenderToPdfOptions without throwing", async () => {
    await expect(
      renderToPdf("<html><p>opts</p></html>", {
        format: "A4",
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        printBackground: true,
        filename: "test-invoice.pdf",
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("accepts Letter format", async () => {
    const result = await renderToPdf("<p>letter</p>", { format: "Letter" });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("logs a stub warning containing [renderToPdf] STUB", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await renderToPdf("<p>hello</p>", { filename: "stub.pdf" });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[renderToPdf] STUB"),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("empty HTML still returns a Buffer", async () => {
    const result = await renderToPdf("");
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

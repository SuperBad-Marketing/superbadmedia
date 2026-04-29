/**
 * renderToPdf — QB-3 (real Puppeteer impl).
 *
 * The pure unit test exercises `resolveExecutablePath()` env handling.
 * The actual Puppeteer launch is heavy (Chrome process) so the live smoke
 * is gated on `PUPPETEER_E2E=1` to keep `npm test` green on machines
 * without Chrome installed at the resolved path. Andy's local + CI both
 * stay clean; the smoke runs locally on demand and on the e2e job.
 */
import { describe, it, expect } from "vitest";
import { resolveExecutablePath, renderToPdf } from "@/lib/pdf/render";

describe("resolveExecutablePath", () => {
  it("prefers PUPPETEER_EXECUTABLE_PATH when set", async () => {
    const original = process.env.PUPPETEER_EXECUTABLE_PATH;
    process.env.PUPPETEER_EXECUTABLE_PATH = "/tmp/custom-chrome";
    try {
      expect(await resolveExecutablePath()).toBe("/tmp/custom-chrome");
    } finally {
      if (original === undefined) delete process.env.PUPPETEER_EXECUTABLE_PATH;
      else process.env.PUPPETEER_EXECUTABLE_PATH = original;
    }
  });

  it("falls back to a per-platform default when env unset", async () => {
    const original = process.env.PUPPETEER_EXECUTABLE_PATH;
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    try {
      const path = await resolveExecutablePath();
      // macOS dev path, linux prod path, or bundled @sparticuz/chromium
      expect(path).toMatch(/[Gg]oogle [Cc]hrome|google-chrome|chromium/);
    } finally {
      if (original !== undefined) process.env.PUPPETEER_EXECUTABLE_PATH = original;
    }
  });
});

const liveSmoke = process.env.PUPPETEER_E2E === "1" ? describe : describe.skip;

liveSmoke("renderToPdf live smoke (PUPPETEER_E2E=1)", () => {
  it("renders trivial HTML to a real PDF buffer", async () => {
    const buf = await renderToPdf(
      "<!doctype html><html><body><h1>Smoke</h1></body></html>",
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }, 30_000);
});

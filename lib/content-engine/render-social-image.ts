/**
 * Content Engine — Puppeteer screenshot renderer for social images (CE-5).
 *
 * Extends the existing `lib/pdf/render.ts` pattern for image output.
 * Renders self-contained HTML to PNG at exact pixel dimensions.
 *
 * Owner: CE-5. Consumer: visual-assets.ts orchestrator.
 */
import puppeteer, { type Browser } from "puppeteer-core";
import { resolveExecutablePath } from "@/lib/pdf/render";
import type { ImageDimensions } from "./social-templates";

export interface RenderSocialImageOptions {
  /** Image dimensions — viewport is set to exactly this. */
  dimensions: ImageDimensions;
  /** Output format — default PNG. */
  format?: "png" | "jpeg" | "webp";
  /** JPEG/WebP quality (0-100). Default 90. */
  quality?: number;
}

/**
 * Render an HTML string to a PNG/JPEG buffer via Puppeteer screenshot.
 * The HTML must be self-contained — inline `<style>` only, no external CSS.
 */
export async function renderSocialImage(
  html: string,
  opts: RenderSocialImageOptions,
): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: resolveExecutablePath(),
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=none",
        "--disable-gpu",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({
      width: opts.dimensions.width,
      height: opts.dimensions.height,
      deviceScaleFactor: 2, // 2x for crisp social images
    });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const format = opts.format ?? "png";
    const screenshotOptions = {
      type: format as "png" | "jpeg" | "webp",
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: opts.dimensions.width,
        height: opts.dimensions.height,
      },
      ...(format !== "png" ? { quality: opts.quality ?? 90 } : {}),
    };

    const buffer = await page.screenshot(screenshotOptions);
    return Buffer.from(buffer);
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Render multiple HTML strings to images in a single browser session.
 * More efficient than calling renderSocialImage() in a loop.
 */
export async function renderSocialImageBatch(
  items: Array<{ html: string; opts: RenderSocialImageOptions }>,
): Promise<Buffer[]> {
  if (items.length === 0) return [];

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: resolveExecutablePath(),
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=none",
        "--disable-gpu",
      ],
    });

    const results: Buffer[] = [];

    for (const item of items) {
      const page = await browser.newPage();
      await page.setViewport({
        width: item.opts.dimensions.width,
        height: item.opts.dimensions.height,
        deviceScaleFactor: 2,
      });
      await page.setContent(item.html, { waitUntil: "networkidle0" });

      const format = item.opts.format ?? "png";
      const buffer = await page.screenshot({
        type: format as "png" | "jpeg" | "webp",
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: item.opts.dimensions.width,
          height: item.opts.dimensions.height,
        },
        ...(format !== "png" ? { quality: item.opts.quality ?? 90 } : {}),
      });

      results.push(Buffer.from(buffer));
      await page.close();
    }

    return results;
  } finally {
    if (browser) await browser.close();
  }
}

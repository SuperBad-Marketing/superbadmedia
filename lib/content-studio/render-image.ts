import puppeteer, { type Browser } from "puppeteer-core";
import { resolveExecutablePath } from "@/lib/pdf/render";
import { getTemplate, getDimensions } from "./templates";
import type { AspectRatio } from "@/lib/db/schema/content-studio";

export interface RenderImageResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export async function renderPostImage(
  templateId: string,
  copy: Record<string, string>,
  ratio: AspectRatio,
): Promise<RenderImageResult> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const html = template.renderHtml(copy, ratio);
  const { width, height } = getDimensions(ratio);

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: resolveExecutablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    return {
      buffer: Buffer.from(screenshot),
      width: width * 2,
      height: height * 2,
    };
  } finally {
    if (browser) await browser.close();
  }
}

export async function renderAllRatios(
  templateId: string,
  copy: Record<string, string>,
  ratios: AspectRatio[],
): Promise<Map<AspectRatio, RenderImageResult>> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const results = new Map<AspectRatio, RenderImageResult>();

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: resolveExecutablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
    });

    for (const ratio of ratios) {
      const html = template.renderHtml(copy, ratio);
      const { width, height } = getDimensions(ratio);
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "networkidle0" });
      const screenshot = await page.screenshot({ type: "png", fullPage: false });
      await page.close();
      results.set(ratio, {
        buffer: Buffer.from(screenshot),
        width: width * 2,
        height: height * 2,
      });
    }

    return results;
  } finally {
    if (browser) await browser.close();
  }
}

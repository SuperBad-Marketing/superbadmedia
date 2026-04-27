import puppeteer, { type Browser } from "puppeteer-core";
import { resolveExecutablePath } from "@/lib/pdf/render";
import { getTemplate, getDimensions, type RenderOptions } from "./templates";
import type { AspectRatio } from "@/lib/db/schema/content-studio";
import type { SlideCopy } from "./generate-copy";

export interface RenderImageResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface SlideRenderKey {
  slideIndex: number;
  ratio: AspectRatio;
}

export async function renderPostImage(
  templateId: string,
  copy: SlideCopy,
  ratio: AspectRatio,
  renderOptions?: RenderOptions,
): Promise<RenderImageResult> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const html = template.renderHtml(copy, ratio, renderOptions);
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
  copy: SlideCopy,
  ratios: AspectRatio[],
  renderOptions?: RenderOptions,
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
      const html = template.renderHtml(copy, ratio, renderOptions);
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

export async function renderCarousel(
  templateId: string,
  slides: SlideCopy[],
  ratios: AspectRatio[],
  renderOptions?: RenderOptions,
): Promise<Map<string, RenderImageResult & SlideRenderKey>> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const results = new Map<string, RenderImageResult & SlideRenderKey>();

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: resolveExecutablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
    });

    for (let slideIndex = 0; slideIndex < slides.length; slideIndex++) {
      const copy = slides[slideIndex];
      for (const ratio of ratios) {
        const html = template.renderHtml(copy, ratio, renderOptions);
        const { width, height } = getDimensions(ratio);
        const page = await browser.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: "networkidle0" });
        const screenshot = await page.screenshot({ type: "png", fullPage: false });
        await page.close();
        const key = `${slideIndex}-${ratio}`;
        results.set(key, {
          slideIndex,
          ratio,
          buffer: Buffer.from(screenshot),
          width: width * 2,
          height: height * 2,
        });
      }
    }

    return results;
  } finally {
    if (browser) await browser.close();
  }
}

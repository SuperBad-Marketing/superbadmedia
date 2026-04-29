/**
 * PDF renderer — Puppeteer-backed implementation (QB-3).
 *
 * Uses `puppeteer-core` + `@sparticuz/chromium` as bundled fallback.
 * Resolution order: PUPPETEER_EXECUTABLE_PATH env → system Chrome → bundled.
 */
import puppeteer, { type Browser } from "puppeteer-core";
import { existsSync } from "fs";

export interface RenderToPdfOptions {
  /** Page format — default A4 */
  format?: "A4" | "Letter";
  /** Margins in mm — default 18mm all sides (A4 print-safe) */
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Print background colours — default true (we use brand cream backgrounds) */
  printBackground?: boolean;
  /** Optional filename hint for Content-Disposition headers (caller-applied) */
  filename?: string;
}

const SYSTEM_PATHS: Record<string, string> = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome-stable",
};

export async function resolveExecutablePath(): Promise<string> {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const systemPath = SYSTEM_PATHS[process.platform] ?? SYSTEM_PATHS.linux;
  if (existsSync(systemPath)) return systemPath;

  // Bundled Chromium — works on any platform without system Chrome
  try {
    const chromium = await import("@sparticuz/chromium");
    const p = await chromium.default.executablePath();
    if (p) return p;
  } catch { /* not available */ }

  return systemPath;
}

function withMm(value: number | undefined, fallback: number): string {
  return `${value ?? fallback}mm`;
}

/**
 * Render an HTML string to a PDF Buffer. The HTML must be self-contained —
 * inline `<style>` only, no external CSS. Brand styling lives in the
 * `quote-pdf-template.tsx` builder (or whatever caller produces the HTML).
 */
export async function renderToPdf(
  html: string,
  opts: RenderToPdfOptions = {},
): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: await resolveExecutablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({
      format: opts.format ?? "A4",
      printBackground: opts.printBackground ?? true,
      margin: {
        top: withMm(opts.margin?.top, 18),
        right: withMm(opts.margin?.right, 18),
        bottom: withMm(opts.margin?.bottom, 18),
        left: withMm(opts.margin?.left, 18),
      },
      preferCSSPageSize: false,
    });
    return Buffer.from(buffer);
  } finally {
    if (browser) await browser.close();
  }
}

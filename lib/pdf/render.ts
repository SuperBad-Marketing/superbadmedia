/**
 * PDF renderer — Puppeteer-backed implementation (QB-3).
 *
 * Uses `puppeteer-core`, which does NOT bundle Chromium. The path to an
 * existing Chrome/Chromium binary is read from `PUPPETEER_EXECUTABLE_PATH`,
 * with sensible per-platform defaults so local dev "just works" if Chrome
 * is in the standard location.
 *
 * @internal Only call from feature code via a scheduled task handler or
 * Server Action — never directly from a React component. Browser launch
 * is a heavyweight system call; consumers that render multiple PDFs in
 * a single tick should batch through `renderManyToPdf()` (added when a
 * second consumer lands — KISS for now).
 */
import puppeteer, { type Browser } from "puppeteer-core";

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

export function resolveExecutablePath(): string {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  // Per-platform fallback. macOS is Andy's daily driver; Linux is prod.
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/google-chrome-stable";
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
      executablePath: resolveExecutablePath(),
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

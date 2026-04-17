/**
 * One-off: render the Fetch Recruitment quote page to a branded PDF.
 *
 * Connects to the live dev server on :3001 so fonts/CSS variables load
 * naturally. Screen-media emulation keeps the charcoal brand look (the
 * page has no @media print fork — screen styles are the deliverable).
 *
 * Run from project root: `node scripts/render-fetch-quote.mjs`
 * (Dev server must be running on :3001.)
 */
import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "..",
  "SuperBad-Fetch-Recruitment-Quote-SB-FETCH-001.pdf",
);
const URL = "http://localhost:3001/lite/quotes/fetch-recruitment";

function resolveChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH)
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === "darwin")
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return "/usr/bin/google-chrome-stable";
}

const browser = await puppeteer.launch({
  executablePath: resolveChrome(),
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1600, deviceScaleFactor: 2 });
  await page.emulateMediaType("screen");
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 60_000 });
  // Give custom fonts a chance to settle (they're local woff2 via next/font).
  await page.evaluateHandle("document.fonts.ready");

  // Hide page chrome that should not appear in the client deliverable:
  //   - Global footer containing the "Report an issue" button (root layout).
  //   - Next.js dev indicator badge (shows in dev mode only).
  // Also tighten trailing whitespace so the PDF pagination doesn't spill
  // onto an extra mostly-empty page.
  await page.addStyleTag({
    content: `
      footer { display: none !important; }
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dev-tools-button],
      #__next-build-watcher { display: none !important; }
      .fetch-quote main { padding-bottom: 24px !important; }
      /* The ambient wash uses position:fixed + inset:0, which in print mode
         can contribute an extra blank page if the document is taller than
         viewport. Pin it to the document, not the viewport. */
      .fetch-quote > div[aria-hidden] {
        position: absolute !important;
        height: 100% !important;
      }
    `,
  });

  await page.pdf({
    path: OUT,
    printBackground: true,
    preferCSSPageSize: false,
    format: "A4",
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
  });
  console.log(`Wrote ${OUT}`);
} finally {
  await browser.close();
}

/**
 * PDF renderer stub — real Puppeteer implementation lands at QB-3 (Quote
 * Builder, Wave 3) when the first consumer (quote PDF) ships.
 *
 * This stub exists so A7-onwards code can import and call `renderToPdf()`
 * with the correct signature, and tests can verify the interface without
 * needing a headless Chromium installed in CI.
 *
 * @internal Only call from feature code via a scheduled task handler or
 * Server Action — never directly from a React component.
 */

export interface RenderToPdfOptions {
  /** Page format — default A4 */
  format?: "A4" | "Letter";
  /** Margins in mm — default 20mm all sides */
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Print background colours — default true */
  printBackground?: boolean;
  /** Optional filename hint for Content-Disposition headers */
  filename?: string;
}

/**
 * Render HTML (or a serialised React tree) to a PDF Buffer.
 *
 * STUB — returns a placeholder Buffer and logs a warning. The real
 * Puppeteer implementation ships at QB-3.
 *
 * @param htmlOrReactTree - HTML string or serialised React component output
 * @param opts - Rendering options
 * @returns Buffer containing PDF bytes (placeholder until QB-3)
 */
export async function renderToPdf(
  htmlOrReactTree: string,
  opts: RenderToPdfOptions = {},
): Promise<Buffer> {
  // stub — wires real Puppeteer at QB-3
  console.warn(
    "[renderToPdf] STUB — Puppeteer not yet wired. Called with opts:",
    JSON.stringify({ format: opts.format ?? "A4", filename: opts.filename }),
    "| html length:",
    htmlOrReactTree.length,
  );
  return Buffer.from(
    `%PDF-1.4 STUB - real renderer arrives at QB-3`,
    "utf-8",
  );
}

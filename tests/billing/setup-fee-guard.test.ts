/**
 * SB-12: grep-enforceable guard for spec §6 op#41 —
 * "Setup fee logic lives in one place."
 *
 * Fails if the literal `add_invoice_items` appears anywhere under
 * `app/` or `lib/` except the owner file `lib/billing/setup-fee.ts`.
 * Matches identifier use only (not substrings inside other words).
 * Comments and docstrings are allowed in the owner file; any mention
 * elsewhere — even a comment — must be removed so future sessions
 * cannot quietly reintroduce the pattern without a visible diff.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOTS = ["app", "lib"] as const;
const OWNER_REL = "lib/billing/setup-fee.ts";
const PATTERN = /\badd_invoice_items\b/;

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
}

describe("SB-12: add_invoice_items sole-owner guard", () => {
  it("only lib/billing/setup-fee.ts may reference add_invoice_items", () => {
    const cwd = process.cwd();
    const ownerAbs = path.join(cwd, OWNER_REL);
    const files: string[] = [];
    for (const root of ROOTS) {
      const abs = path.join(cwd, root);
      if (fs.existsSync(abs)) walk(abs, files);
    }

    const offenders: string[] = [];
    for (const file of files) {
      if (file === ownerAbs) continue;
      const content = fs.readFileSync(file, "utf8");
      if (PATTERN.test(content)) {
        offenders.push(path.relative(cwd, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

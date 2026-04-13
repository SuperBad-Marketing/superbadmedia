/**
 * Token-sync guard — lib/design-tokens.ts must match app/globals.css.
 *
 * We parse the :root block of globals.css, pull every `--foo: #hex;`
 * line, and diff against the TypeScript mirror. A mismatch fails the
 * build rather than silently drifting. Spec rule (design-system-baseline
 * §"Token storage"): tokens live in three places and stay in sync.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  brand,
  neutral,
  radius,
  semantic,
  space,
  typography,
} from "../lib/design-tokens";

const CSS_PATH = path.resolve(__dirname, "../app/globals.css");

function readRootBlock(): string {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const match = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!match) throw new Error("globals.css :root block not found");
  return match[1];
}

function readVar(rootBlock: string, name: string): string {
  const re = new RegExp(`--${name}:\\s*([^;]+);`);
  const m = rootBlock.match(re);
  if (!m) throw new Error(`CSS var --${name} not found in :root`);
  return m[1].trim();
}

describe("design tokens — CSS ↔ TS parity", () => {
  const root = readRootBlock();

  it("neutral scale matches", () => {
    for (const [step, hex] of Object.entries(neutral)) {
      expect(readVar(root, `neutral-${step}`).toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it("brand palette matches", () => {
    for (const [key, hex] of Object.entries(brand)) {
      expect(readVar(root, `brand-${key}`).toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it("semantic tokens match (success hex only — warning/error/info alias vars)", () => {
    expect(readVar(root, "success").toLowerCase()).toBe(semantic.success.toLowerCase());
  });

  it("spacing scale matches (px)", () => {
    for (const [step, px] of Object.entries(space)) {
      expect(readVar(root, `space-${step}`)).toBe(`${px}px`);
    }
  });

  it("radius tokens match (px)", () => {
    for (const [key, px] of Object.entries(radius)) {
      expect(readVar(root, `radius-${key}`)).toBe(`${px}px`);
    }
  });

  it("type scale sizes + line heights match", () => {
    for (const [role, { size, lineHeight }] of Object.entries(typography)) {
      expect(readVar(root, `text-${role}`)).toBe(`${size}px`);
      // Numbers serialise without trailing zeros in CSS; compare as numbers.
      expect(Number(readVar(root, `text-${role}-lh`))).toBe(lineHeight);
    }
  });
});

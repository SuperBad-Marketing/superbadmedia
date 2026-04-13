import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  MODELS,
  MODEL_IDS,
  MODEL_JOB_SLUGS,
  modelFor,
  modelTierFor,
} from "@/lib/ai/models";

describe("LLM model registry", () => {
  it("maps every INDEX.md prompt slug to a tier", () => {
    const indexPath = path.join(process.cwd(), "lib/ai/prompts/INDEX.md");
    const md = fs.readFileSync(indexPath, "utf-8");
    const slugs = [
      ...md.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|/gm),
    ].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThanOrEqual(50);
    for (const slug of slugs) {
      expect(MODEL_JOB_SLUGS).toContain(slug);
    }
  });

  it("all tier values resolve to a known model ID", () => {
    for (const slug of MODEL_JOB_SLUGS) {
      const tier = modelTierFor(slug);
      expect(["opus", "sonnet", "haiku"]).toContain(tier);
      expect(modelFor(slug)).toBe(MODEL_IDS[tier]);
    }
  });

  it("MODEL_IDS stays pinned to the Claude 4.6 family", () => {
    expect(MODEL_IDS.opus).toBe("claude-opus-4-6");
    expect(MODEL_IDS.sonnet).toBe("claude-sonnet-4-6");
    expect(MODEL_IDS.haiku).toBe("claude-haiku-4-5-20251001");
  });

  it("no model ID strings leak into app/ or components/", () => {
    const offenders: string[] = [];
    const needles = [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku",
    ];
    function walk(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(tsx?|mdx?|jsx?)$/.test(entry.name)) {
          const contents = fs.readFileSync(p, "utf-8");
          for (const n of needles) {
            if (contents.includes(n)) offenders.push(`${p}: ${n}`);
          }
        }
      }
    }
    walk(path.join(process.cwd(), "app"));
    walk(path.join(process.cwd(), "components"));
    expect(offenders).toEqual([]);
  });

  it("every slug is unique", () => {
    expect(new Set(MODEL_JOB_SLUGS).size).toBe(MODEL_JOB_SLUGS.length);
    expect(Object.keys(MODELS).length).toBe(MODEL_JOB_SLUGS.length);
  });
});

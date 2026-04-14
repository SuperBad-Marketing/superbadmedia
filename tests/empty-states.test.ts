import { describe, it, expect } from "vitest";
import {
  EMPTY_STATES,
  getEmptyState,
  type EmptyStateKey,
} from "@/lib/copy/empty-states";
import {
  STAGE_COLUMNS,
  getStageEmptyState,
} from "@/components/lite/sales-pipeline/stage-config";

describe("empty-state copy bank", () => {
  it("registers all 8 pipeline column keys + 2 feed surfaces", () => {
    const keys = Object.keys(EMPTY_STATES);
    expect(keys).toContain("pipeline.column.lead");
    expect(keys).toContain("pipeline.column.won");
    expect(keys).toContain("pipeline.column.lost");
    expect(keys).toContain("pipeline.deal_activity_feed");
    expect(keys).toContain("pipeline.company_feed_new");
    expect(keys.length).toBe(10);
  });

  it("every entry is unique copy (no duplicate messages across the bank)", () => {
    const messages = Object.values(EMPTY_STATES).map((e) => e.message);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("carries the spec-canonical copy for locked pipeline entries", () => {
    expect(getEmptyState("pipeline.column.lead").message).toMatch(
      /Lead Gen will fill this in/,
    );
    expect(getEmptyState("pipeline.column.won").message).toBe(
      "Quiet in here. For now.",
    );
    expect(getEmptyState("pipeline.column.contacted").message).toMatch(
      /Enviable/,
    );
  });

  it("bans exclamation marks and 'success'/'🎉' from pipeline entries", () => {
    for (const [key, entry] of Object.entries(EMPTY_STATES) as Array<
      [EmptyStateKey, (typeof EMPTY_STATES)[EmptyStateKey]]
    >) {
      if (!key.startsWith("pipeline.")) continue;
      expect(entry.message, `${key} must not use "!"`).not.toContain("!");
      expect(
        entry.message.toLowerCase(),
        `${key} must not cheerlead`,
      ).not.toContain("success");
      expect(entry.message, `${key} must not use party emoji`).not.toContain(
        "🎉",
      );
    }
  });

  it("every STAGE_COLUMN resolves via getStageEmptyState", () => {
    for (const col of STAGE_COLUMNS) {
      const copy = getStageEmptyState(col);
      expect(copy).toBeDefined();
      expect(copy.message.length).toBeGreaterThan(0);
    }
  });
});

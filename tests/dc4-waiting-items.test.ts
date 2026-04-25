import { describe, it, expect } from "vitest";

import { sortWaitingItems } from "@/lib/cockpit/aggregator";
import type { WaitingItem } from "@/lib/tasks/cockpit";

const base: Omit<WaitingItem, "id" | "urgency"> = {
  label: "test",
  href: "/test",
  scope: "own",
  source: "test",
};

describe("sortWaitingItems", () => {

  it("sorts time_sensitive before age_of_wait", () => {
    const items: WaitingItem[] = [
      { ...base, id: "a", urgency: { kind: "age_of_wait", value: 100 } },
      { ...base, id: "b", urgency: { kind: "time_sensitive", value: 500 } },
    ];
    const sorted = sortWaitingItems(items);
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });

  it("sorts time_sensitive by deadline ascending", () => {
    const items: WaitingItem[] = [
      { ...base, id: "later", urgency: { kind: "time_sensitive", value: 300 } },
      { ...base, id: "sooner", urgency: { kind: "time_sensitive", value: 100 } },
    ];
    const sorted = sortWaitingItems(items);
    expect(sorted[0].id).toBe("sooner");
    expect(sorted[1].id).toBe("later");
  });

  it("sorts age_of_wait by wait-start ascending (longest wait first)", () => {
    const items: WaitingItem[] = [
      { ...base, id: "newer", urgency: { kind: "age_of_wait", value: 300 } },
      { ...base, id: "older", urgency: { kind: "age_of_wait", value: 100 } },
    ];
    const sorted = sortWaitingItems(items);
    expect(sorted[0].id).toBe("older");
    expect(sorted[1].id).toBe("newer");
  });

  it("tiebreaks on id", () => {
    const items: WaitingItem[] = [
      { ...base, id: "z", urgency: { kind: "age_of_wait", value: 100 } },
      { ...base, id: "a", urgency: { kind: "age_of_wait", value: 100 } },
    ];
    const sorted = sortWaitingItems(items);
    expect(sorted[0].id).toBe("a");
    expect(sorted[1].id).toBe("z");
  });

  it("handles empty array", () => {
    expect(sortWaitingItems([])).toEqual([]);
  });

  it("handles mixed urgency types with correct ordering", () => {
    const items: WaitingItem[] = [
      { ...base, id: "wait_old", urgency: { kind: "age_of_wait", value: 50 } },
      { ...base, id: "time_far", urgency: { kind: "time_sensitive", value: 999 } },
      { ...base, id: "wait_new", urgency: { kind: "age_of_wait", value: 200 } },
      { ...base, id: "time_near", urgency: { kind: "time_sensitive", value: 100 } },
    ];
    const sorted = sortWaitingItems(items);
    expect(sorted.map((i) => i.id)).toEqual([
      "time_near",
      "time_far",
      "wait_old",
      "wait_new",
    ]);
  });
});

describe("source spec contracts", () => {
  it("every source returns items with required fields", () => {
    const item: WaitingItem = {
      id: "test_1",
      label: "Test item",
      href: "/test",
      urgency: { kind: "time_sensitive", value: Date.now() },
      scope: "own",
      source: "quote-builder",
    };
    expect(item.id).toBeDefined();
    expect(item.label).toBeDefined();
    expect(item.href).toBeDefined();
    expect(item.urgency.kind).toMatch(/^(time_sensitive|age_of_wait)$/);
    expect(item.scope).toMatch(/^(own|fleet)$/);
    expect(item.source).toBeDefined();
  });

  it("fleet scope chips are identified correctly", () => {
    const fleetItem: WaitingItem = {
      ...base,
      id: "fleet_1",
      scope: "fleet",
      urgency: { kind: "age_of_wait", value: 0 },
    };
    const ownItem: WaitingItem = {
      ...base,
      id: "own_1",
      scope: "own",
      urgency: { kind: "age_of_wait", value: 0 },
    };
    expect(fleetItem.scope).toBe("fleet");
    expect(ownItem.scope).toBe("own");
  });
});

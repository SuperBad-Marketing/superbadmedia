import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
        limit: () => Promise.resolve([]),
      }),
    }),
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { llm_calls_enabled: true },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

const mockInvokeLlmText = vi.fn();
vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: (...args: unknown[]) => mockInvokeLlmText(...args),
}));

import { parseBraindump } from "@/lib/ai/parse-braindump";
import type { ParsedBraindump } from "@/lib/ai/parse-braindump";
import { killSwitches } from "@/lib/kill-switches";

describe("parseBraindump", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("throws when kill switch is off", async () => {
    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;
    await expect(parseBraindump("test")).rejects.toThrow("kill switch");
  });

  it("parses a valid LLM response into ParsedBraindump", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [
          {
            title: "Call Belle about shoot",
            body: null,
            kind: "client_task",
            priority: "high",
            due_at_iso: "2026-04-22",
            entity_candidates: [
              { entity_type: "contact", entity_id: "c1", entity_name: "Belle Robinson", confidence: 0.9 },
              { entity_type: "company", entity_id: "co1", entity_name: "Belle Bakery", confidence: 0.4 },
            ],
            checklist: null,
            confidence: { title: 0.95, kind: 0.8, due_at: 0.9, entity: 0.7 },
          },
          {
            title: "Write 3 instagram posts",
            body: "For the monthly content calendar",
            kind: "client_deliverable",
            priority: "normal",
            due_at_iso: null,
            entity_candidates: [],
            checklist: ["Post 1", "Post 2", "Post 3"],
            confidence: { title: 0.9, kind: 0.85, due_at: 0, entity: 0 },
          },
        ],
        global_confidence: 0.82,
      }),
    );

    const result: ParsedBraindump = await parseBraindump("call belle about the shoot\n3 instagram posts for monthly calendar");

    expect(result.tasks).toHaveLength(2);
    expect(result.global_confidence).toBeCloseTo(0.82);

    const t1 = result.tasks[0];
    expect(t1.title).toBe("Call Belle about shoot");
    expect(t1.kind).toBe("client_task");
    expect(t1.priority).toBe("high");
    expect(t1.entity_type).toBe("contact");
    expect(t1.entity_id).toBe("c1");
    expect(t1.entity_name).toBe("Belle Robinson");
    expect(t1.alternatives?.entity).toHaveLength(2);
    expect(t1.due_at_ms).toBeTypeOf("number");
    expect(t1.confidence.title).toBeCloseTo(0.95);

    const t2 = result.tasks[1];
    expect(t2.kind).toBe("client_deliverable");
    expect(t2.checklist).toHaveLength(3);
    expect(t2.checklist![0].text).toBe("Post 1");
    expect(t2.checklist![0].checked).toBe(false);
    expect(t2.entity_type).toBeNull();
    expect(t2.alternatives).toBeUndefined();
  });

  it("handles invalid kind by defaulting to admin", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [{ title: "Do thing", kind: "bogus_kind", priority: "normal", confidence: { title: 0.9, kind: 0.5, due_at: 0, entity: 0 } }],
        global_confidence: 0.5,
      }),
    );

    const result = await parseBraindump("do thing");
    expect(result.tasks[0].kind).toBe("admin");
  });

  it("handles invalid priority by defaulting to normal", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [{ title: "Do thing", kind: "admin", priority: "extreme", confidence: { title: 0.9, kind: 0.5, due_at: 0, entity: 0 } }],
        global_confidence: 0.5,
      }),
    );

    const result = await parseBraindump("do thing");
    expect(result.tasks[0].priority).toBe("normal");
  });

  it("throws on invalid JSON response", async () => {
    mockInvokeLlmText.mockResolvedValueOnce("this is not json at all");
    await expect(parseBraindump("test")).rejects.toThrow("Failed to parse");
  });

  it("throws when tasks array is missing", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(JSON.stringify({ global_confidence: 0.5 }));
    await expect(parseBraindump("test")).rejects.toThrow("missing tasks array");
  });

  it("clamps confidence values to 0-1 range", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [{ title: "Test", kind: "admin", priority: "normal", confidence: { title: 1.5, kind: -0.3, due_at: 0.5, entity: 2.0 } }],
        global_confidence: 1.8,
      }),
    );

    const result = await parseBraindump("test");
    expect(result.tasks[0].confidence.title).toBe(1);
    expect(result.tasks[0].confidence.kind).toBe(0);
    expect(result.tasks[0].confidence.entity).toBe(1);
    expect(result.global_confidence).toBe(1);
  });

  it("strips markdown code fences from response", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      '```json\n{"tasks":[{"title":"Test","kind":"admin","priority":"normal","confidence":{"title":0.9,"kind":0.8,"due_at":0,"entity":0}}],"global_confidence":0.7}\n```',
    );

    const result = await parseBraindump("test");
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Test");
  });

  it("passes job slug task-manager-parse-braindump to invokeLlmText", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [{ title: "Test", kind: "admin", priority: "normal", confidence: { title: 0.9, kind: 0.8, due_at: 0, entity: 0 } }],
        global_confidence: 0.7,
      }),
    );

    await parseBraindump("test");
    expect(mockInvokeLlmText).toHaveBeenCalledWith(
      expect.objectContaining({ job: "task-manager-parse-braindump" }),
    );
  });

  it("picks highest-confidence entity candidate as primary", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [{
          title: "Follow up with Belle",
          kind: "prospect_followup",
          priority: "normal",
          entity_candidates: [
            { entity_type: "company", entity_id: "co1", entity_name: "Belle Bakery", confidence: 0.4 },
            { entity_type: "contact", entity_id: "c1", entity_name: "Belle Robinson", confidence: 0.9 },
            { entity_type: "company", entity_id: "co2", entity_name: "Belle Tailors", confidence: 0.3 },
          ],
          confidence: { title: 0.9, kind: 0.8, due_at: 0, entity: 0.7 },
        }],
        global_confidence: 0.75,
      }),
    );

    const result = await parseBraindump("follow up with belle");
    const t = result.tasks[0];
    expect(t.entity_id).toBe("c1");
    expect(t.entity_name).toBe("Belle Robinson");
    expect(t.alternatives?.entity).toHaveLength(3);
  });

  it("includes surface context in prompt when provided", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [{ title: "Test", kind: "admin", priority: "normal", confidence: { title: 0.9, kind: 0.8, due_at: 0, entity: 0 } }],
        global_confidence: 0.7,
      }),
    );

    await parseBraindump("test", { entityType: "client", entityId: "cl-123" });
    const callArgs = mockInvokeLlmText.mock.calls[0][0] as { prompt: string };
    expect(callArgs.prompt).toContain("client");
    expect(callArgs.prompt).toContain("cl-123");
  });
});

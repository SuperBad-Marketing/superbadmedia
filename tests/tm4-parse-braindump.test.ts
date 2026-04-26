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

  it("parses tasks, content ideas, and script ideas", async () => {
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
        ],
        content_ideas: [
          {
            brief: "Businesses waste money on stock photography when their phone takes better pictures",
            content_type: "anti_motivation",
            slide_count: 1,
            confidence: 0.85,
          },
        ],
        script_ideas: [
          {
            topic: "Why agencies won't tell you the real cost of their 'free' audit",
            pillar: "agency_wont_say",
            format: "short",
            angle: "The audit is free because your data is the product",
            confidence: 0.9,
          },
        ],
        global_confidence: 0.82,
      }),
    );

    const result: ParsedBraindump = await parseBraindump(
      "call belle about the shoot\npost idea: stock photos are a waste\nvideo: agencies lie about free audits",
    );

    expect(result.tasks).toHaveLength(1);
    expect(result.content_ideas).toHaveLength(1);
    expect(result.script_ideas).toHaveLength(1);
    expect(result.global_confidence).toBeCloseTo(0.82);

    const t1 = result.tasks[0];
    expect(t1.title).toBe("Call Belle about shoot");
    expect(t1.kind).toBe("client_task");
    expect(t1.entity_id).toBe("c1");
    expect(t1.alternatives?.entity).toHaveLength(2);

    const c1 = result.content_ideas[0];
    expect(c1.brief).toContain("stock photography");
    expect(c1.content_type).toBe("anti_motivation");
    expect(c1.slide_count).toBe(1);
    expect(c1.confidence).toBeCloseTo(0.85);

    const s1 = result.script_ideas[0];
    expect(s1.topic).toContain("free");
    expect(s1.pillar).toBe("agency_wont_say");
    expect(s1.format).toBe("short");
    expect(s1.angle).toContain("data is the product");
    expect(s1.confidence).toBeCloseTo(0.9);
  });

  it("handles tasks-only response (backward compat)", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [
          {
            title: "Invoice Jake",
            kind: "admin",
            priority: "normal",
            confidence: { title: 0.9, kind: 0.8, due_at: 0, entity: 0 },
          },
        ],
        global_confidence: 0.7,
      }),
    );

    const result = await parseBraindump("invoice jake");
    expect(result.tasks).toHaveLength(1);
    expect(result.content_ideas).toHaveLength(0);
    expect(result.script_ideas).toHaveLength(0);
  });

  it("handles invalid kind by defaulting to admin", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [{ title: "Do thing", kind: "bogus_kind", priority: "normal", confidence: { title: 0.9, kind: 0.5, due_at: 0, entity: 0 } }],
        content_ideas: [],
        script_ideas: [],
        global_confidence: 0.5,
      }),
    );

    const result = await parseBraindump("do thing");
    expect(result.tasks[0].kind).toBe("admin");
  });

  it("handles invalid content type by defaulting to tips", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [],
        content_ideas: [
          { brief: "Test post", content_type: "bogus_type", slide_count: 1, confidence: 0.5 },
        ],
        script_ideas: [],
        global_confidence: 0.5,
      }),
    );

    const result = await parseBraindump("make a post about something");
    expect(result.content_ideas[0].content_type).toBe("tips");
  });

  it("handles invalid pillar by defaulting to overheard_in_marketing", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [],
        content_ideas: [],
        script_ideas: [
          { topic: "Test script", pillar: "bogus_pillar", format: "short", angle: "test", confidence: 0.5 },
        ],
        global_confidence: 0.5,
      }),
    );

    const result = await parseBraindump("film a video about something");
    expect(result.script_ideas[0].pillar).toBe("overheard_in_marketing");
  });

  it("handles invalid format by defaulting to short", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [],
        content_ideas: [],
        script_ideas: [
          { topic: "Test", pillar: "agency_wont_say", format: "bogus", angle: "x", confidence: 0.5 },
        ],
        global_confidence: 0.5,
      }),
    );

    const result = await parseBraindump("test");
    expect(result.script_ideas[0].format).toBe("short");
  });

  it("clamps slide count to 1-10 range", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [],
        content_ideas: [
          { brief: "Test", content_type: "tips", slide_count: 25, confidence: 0.5 },
          { brief: "Test2", content_type: "tips", slide_count: 0, confidence: 0.5 },
        ],
        script_ideas: [],
        global_confidence: 0.5,
      }),
    );

    const result = await parseBraindump("test");
    expect(result.content_ideas[0].slide_count).toBe(10);
    expect(result.content_ideas[1].slide_count).toBe(1);
  });

  it("throws on invalid JSON response", async () => {
    mockInvokeLlmText.mockResolvedValueOnce("this is not json at all");
    await expect(parseBraindump("test")).rejects.toThrow("Failed to parse");
  });

  it("clamps confidence values to 0-1 range", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [{ title: "Test", kind: "admin", priority: "normal", confidence: { title: 1.5, kind: -0.3, due_at: 0.5, entity: 2.0 } }],
        content_ideas: [{ brief: "Test", content_type: "tips", slide_count: 1, confidence: 1.8 }],
        script_ideas: [{ topic: "Test", pillar: "agency_wont_say", format: "short", angle: "x", confidence: -0.5 }],
        global_confidence: 1.8,
      }),
    );

    const result = await parseBraindump("test");
    expect(result.tasks[0].confidence.title).toBe(1);
    expect(result.tasks[0].confidence.kind).toBe(0);
    expect(result.content_ideas[0].confidence).toBe(1);
    expect(result.script_ideas[0].confidence).toBe(0);
    expect(result.global_confidence).toBe(1);
  });

  it("strips markdown code fences from response", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      '```json\n{"tasks":[],"content_ideas":[{"brief":"Test","content_type":"tips","slide_count":1,"confidence":0.9}],"script_ideas":[],"global_confidence":0.7}\n```',
    );

    const result = await parseBraindump("test");
    expect(result.content_ideas).toHaveLength(1);
    expect(result.content_ideas[0].brief).toBe("Test");
  });

  it("passes job slug braindump-parse to invokeLlmText", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        tasks: [],
        content_ideas: [],
        script_ideas: [],
        global_confidence: 0.7,
      }),
    );

    await parseBraindump("test");
    expect(mockInvokeLlmText).toHaveBeenCalledWith(
      expect.objectContaining({ job: "braindump-parse" }),
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
        content_ideas: [],
        script_ideas: [],
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
        content_ideas: [],
        script_ideas: [],
        global_confidence: 0.7,
      }),
    );

    await parseBraindump("test", { entityType: "client", entityId: "cl-123" });
    const callArgs = mockInvokeLlmText.mock.calls[0][0] as { prompt: string };
    expect(callArgs.prompt).toContain("client");
    expect(callArgs.prompt).toContain("cl-123");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      candidates: { findFirst: vi.fn() },
      role_briefs: { findFirst: vi.fn() },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn(),
          returning: vi.fn(() => [
            {
              id: "rb-1",
              role_name: "Video Editor",
              status: "open",
              style_summary: "Cinematic food",
              extracted_tags_json: ["food", "cinematic"],
              style_do_list_json: ["handheld feel"],
              style_avoid_list_json: ["corporate"],
              discovery_search_hints_json: ["food reel vimeo"],
              reference_signals_json: [],
              andy_overrides: null,
              last_regenerated_at_ms: null,
              updated_at_ms: Date.now(),
            },
          ]),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: vi.fn(() => []),
          get: vi.fn(),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            all: vi.fn(() => []),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => [{ id: "task-1" }]),
        })),
        returning: vi.fn(() => [{}]),
      })),
    })),
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { llm_calls_enabled: true },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn((key: string) => {
      if (key === "hiring.brief.regen_on_bench_entry") return true;
      if (key === "hiring.brief.archive_retune_threshold") return 10;
      return null;
    }),
  },
}));

vi.mock("@/lib/hiring/queries", () => ({
  getCandidateById: vi.fn(),
  getRoleBriefById: vi.fn(),
  getArchivesForCandidate: vi.fn(),
  updateRoleBrief: vi.fn(),
  listCandidates: vi.fn(),
  createRoleBrief: vi.fn(),
  listRoleBriefs: vi.fn(),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(() => ({ id: "task-1" })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { regenerateRoleBrief } from "@/lib/hiring/regenerate-brief";
import { maybeRegenerateRoleBrief } from "@/lib/hiring/maybe-regenerate-brief";
import { handleHiringRoleBriefRegenerate } from "@/lib/scheduled-tasks/handlers/hiring-role-brief-regenerate";
import { getRoleBriefById, listCandidates, getArchivesForCandidate, updateRoleBrief } from "@/lib/hiring/queries";
import { invokeLlmText } from "@/lib/ai/invoke";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { logActivity } from "@/lib/activity-log";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

const mockGetRoleBriefById = getRoleBriefById as ReturnType<typeof vi.fn>;
const mockListCandidates = listCandidates as ReturnType<typeof vi.fn>;
const mockGetArchives = getArchivesForCandidate as ReturnType<typeof vi.fn>;
const mockUpdateRoleBrief = updateRoleBrief as ReturnType<typeof vi.fn>;
const mockInvokeLlm = invokeLlmText as ReturnType<typeof vi.fn>;
const mockEnqueueTask = enqueueTask as ReturnType<typeof vi.fn>;
const mockLogActivity = logActivity as ReturnType<typeof vi.fn>;

const STUB_BRIEF = {
  id: "rb-1",
  role_name: "Video Editor",
  engagement_type: "contractor",
  status: "open" as const,
  rate_min_aud: 80,
  rate_max_aud: 120,
  rate_unit: "per_hour",
  target_hours_per_week: 15,
  location_pref_city: "Melbourne",
  remote_ok: true,
  open_count: 2,
  reference_urls_json: ["https://vimeo.com/example"],
  reference_signals_json: [
    { url: "https://vimeo.com/example", platform: "vimeo", extracted_tags: ["food"], work_samples: [] },
  ],
  style_summary: "Cinematic food/beverage documentary feel.",
  extracted_tags_json: ["food", "cinematic", "documentary"],
  style_do_list_json: ["handheld feel", "natural lighting"],
  style_avoid_list_json: ["corporate", "stock footage"],
  discovery_search_hints_json: ["food reel vimeo melbourne"],
  andy_overrides: null,
  last_regenerated_at_ms: null,
  last_discovery_run_at_ms: null,
  created_at_ms: Date.now() - 86400000,
  updated_at_ms: Date.now(),
};

function stubTask(overrides?: Partial<ScheduledTaskRow>): ScheduledTaskRow {
  return {
    id: "task-1",
    task_type: "hiring_role_brief_regenerate",
    run_at_ms: Date.now(),
    payload: { role_brief_id: "rb-1", trigger: "manual_retune" },
    status: "pending",
    attempts: 0,
    last_attempted_at_ms: null,
    last_error: null,
    idempotency_key: null,
    created_at_ms: Date.now(),
    done_at_ms: null,
    reclaimed_at_ms: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// regenerateRoleBrief
// ---------------------------------------------------------------------------

describe("regenerateRoleBrief", () => {
  it("regenerates an open brief with LLM synthesis", async () => {
    mockGetRoleBriefById.mockResolvedValue(STUB_BRIEF);
    mockListCandidates.mockResolvedValue([
      { id: "c-1", stage: "bench", role_brief_id: "rb-1" },
    ]);
    mockGetArchives.mockResolvedValue([]);
    mockInvokeLlm.mockResolvedValue(
      JSON.stringify({
        style_summary: "Updated cinematic food/beverage style.",
        extracted_tags: ["food", "cinematic", "documentary", "narrative"],
        style_do_list: ["handheld feel", "natural lighting", "pace variation"],
        style_avoid_list: ["corporate", "stock footage"],
        discovery_search_hints: ["food reel vimeo", "documentary editor portfolio"],
      }),
    );

    const result = await regenerateRoleBrief("rb-1", "manual_retune");

    expect(result.ok).toBe(true);
    expect(mockInvokeLlm).toHaveBeenCalledOnce();
    expect(mockInvokeLlm).toHaveBeenCalledWith(
      expect.objectContaining({ job: "hiring-brief-synthesize" }),
    );
    expect(mockUpdateRoleBrief).toHaveBeenCalledWith(
      "rb-1",
      expect.objectContaining({
        style_summary: "Updated cinematic food/beverage style.",
        last_regenerated_at_ms: expect.any(Number),
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "role_brief_regenerated",
        meta: expect.objectContaining({ trigger: "manual_retune" }),
      }),
    );
  });

  it("skips regen for closed/filled briefs", async () => {
    mockGetRoleBriefById.mockResolvedValue({ ...STUB_BRIEF, status: "filled" });

    const result = await regenerateRoleBrief("rb-1", "bench_entry");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("filled");
    expect(mockInvokeLlm).not.toHaveBeenCalled();
  });

  it("returns error when brief not found", async () => {
    mockGetRoleBriefById.mockResolvedValue(undefined);

    const result = await regenerateRoleBrief("rb-999", "manual_retune");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("includes archive reflections in the prompt", async () => {
    mockGetRoleBriefById.mockResolvedValue(STUB_BRIEF);
    mockListCandidates.mockResolvedValue([
      { id: "c-2", stage: "archived", role_brief_id: "rb-1" },
    ]);
    mockGetArchives.mockResolvedValue([
      {
        id: "a-1",
        candidate_id: "c-2",
        reason_code: "style_mismatch",
        reason_free_text: "Too corporate",
        reflection_text: "Heavy filter presets, no natural grading",
        created_at_ms: Date.now(),
      },
    ]);
    mockInvokeLlm.mockResolvedValue(
      JSON.stringify({
        style_summary: "Updated.",
        extracted_tags: ["food"],
        style_do_list: ["handheld"],
        style_avoid_list: ["corporate", "heavy filter presets"],
        discovery_search_hints: ["food reel"],
      }),
    );

    await regenerateRoleBrief("rb-1", "archive_reflection");

    const prompt = mockInvokeLlm.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Heavy filter presets");
    expect(prompt).toContain("style_mismatch");
  });
});

// ---------------------------------------------------------------------------
// maybeRegenerateRoleBrief
// ---------------------------------------------------------------------------

describe("maybeRegenerateRoleBrief", () => {
  it("enqueues a regen task for manual retune", async () => {
    mockGetRoleBriefById.mockResolvedValue(STUB_BRIEF);
    mockEnqueueTask.mockResolvedValue({ id: "task-1" });

    const result = await maybeRegenerateRoleBrief("rb-1", "manual_retune");

    expect(result.enqueued).toBe(true);
    expect(mockEnqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "hiring_role_brief_regenerate",
        payload: { role_brief_id: "rb-1", trigger: "manual_retune" },
      }),
    );
  });

  it("enqueues for bench_entry when setting enabled", async () => {
    mockGetRoleBriefById.mockResolvedValue(STUB_BRIEF);
    mockEnqueueTask.mockResolvedValue({ id: "task-1" });

    const result = await maybeRegenerateRoleBrief("rb-1", "bench_entry");

    expect(result.enqueued).toBe(true);
  });

  it("skips for filled briefs", async () => {
    mockGetRoleBriefById.mockResolvedValue({ ...STUB_BRIEF, status: "filled" });

    const result = await maybeRegenerateRoleBrief("rb-1", "manual_retune");

    expect(result.enqueued).toBe(false);
    expect(mockEnqueueTask).not.toHaveBeenCalled();
  });

  it("reports debounce when task already queued", async () => {
    mockGetRoleBriefById.mockResolvedValue(STUB_BRIEF);
    mockEnqueueTask.mockResolvedValue(null);

    const result = await maybeRegenerateRoleBrief("rb-1", "archive_reflection");

    expect(result.enqueued).toBe(false);
    expect(result.reason).toContain("Debounced");
  });
});

// ---------------------------------------------------------------------------
// Scheduled task handler
// ---------------------------------------------------------------------------

describe("handleHiringRoleBriefRegenerate", () => {
  it("calls regenerateRoleBrief with correct args", async () => {
    mockGetRoleBriefById.mockResolvedValue(STUB_BRIEF);
    mockListCandidates.mockResolvedValue([]);
    mockInvokeLlm.mockResolvedValue(
      JSON.stringify({
        style_summary: "Refreshed.",
        extracted_tags: ["food"],
        style_do_list: ["handheld"],
        style_avoid_list: ["corporate"],
        discovery_search_hints: ["food reel"],
      }),
    );

    const task = stubTask({
      payload: { role_brief_id: "rb-1", trigger: "archive_reflection" },
    });

    await handleHiringRoleBriefRegenerate(task);

    expect(mockInvokeLlm).toHaveBeenCalledOnce();
  });

  it("skips when kill switch disabled", async () => {
    const { killSwitches } = await import("@/lib/kill-switches");
    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;

    const task = stubTask();
    await handleHiringRoleBriefRegenerate(task);

    expect(mockInvokeLlm).not.toHaveBeenCalled();

    (killSwitches as Record<string, boolean>).llm_calls_enabled = true;
  });

  it("skips when no role_brief_id in payload", async () => {
    const task = stubTask({ payload: {} });
    await handleHiringRoleBriefRegenerate(task);

    expect(mockInvokeLlm).not.toHaveBeenCalled();
  });
});

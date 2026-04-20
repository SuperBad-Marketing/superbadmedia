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
          returning: vi.fn(() => [{}]),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: vi.fn(() => []),
          get: vi.fn(),
        })),
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

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/hiring/queries", () => ({
  getCandidateById: vi.fn(),
  getRoleBriefById: vi.fn(),
  getArchivesForCandidate: vi.fn(),
  updateRoleBrief: vi.fn(),
  markArchiveUnarchived: vi.fn(),
  createCandidateArchive: vi.fn(() => ({ id: "archive-1" })),
}));

vi.mock("@/lib/hiring/transition-candidate-stage", () => ({
  transitionCandidateStage: vi.fn(),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ingestArchiveReflection } from "@/lib/hiring/archive-reflection";
import { handleHiringArchiveReflectionIngest } from "@/lib/scheduled-tasks/handlers/hiring-archive-reflection";
import {
  buildArchiveReflectionPrompt,
  buildArchiveReflectionSystem,
} from "@/lib/ai/prompts/hiring/archive-reflection-ingest";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";
import {
  getCandidateById,
  getRoleBriefById,
  getArchivesForCandidate,
  updateRoleBrief,
} from "@/lib/hiring/queries";
import { killSwitches } from "@/lib/kill-switches";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockCandidate = {
  id: "cand-1",
  name: "Jordan Lee",
  role_brief_id: "rb-1",
  stage: "archived" as const,
  stage_before_archive: "screened",
  email: "jordan@example.com",
};

const mockBrief = {
  id: "rb-1",
  role_name: "Video Editor",
  style_summary: "Clean, kinetic food content",
  style_avoid_list_json: ["overly cinematic slow motion"],
};

const mockArchive = {
  id: "archive-1",
  candidate_id: "cand-1",
  reason_code: "portfolio_didnt_land",
  reason_free_text: null,
  reflection_text: "Too heavy on corporate reels, not enough raw energy",
  disposition_direction: "we_archived",
  stage_when_archived: "screened",
  archived_at_ms: Date.now(),
  un_archived_at_ms: null,
  created_at_ms: Date.now(),
};

function makeTask(payload: Record<string, unknown>): ScheduledTaskRow {
  return {
    id: "task-1",
    task_type: "hiring_archive_reflection_ingest",
    run_at_ms: Date.now(),
    status: "pending",
    payload,
    idempotency_key: null,
    attempts: 0,
    last_error: null,
    created_at_ms: Date.now(),
    updated_at_ms: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests — Prompt builder
// ---------------------------------------------------------------------------

describe("archive-reflection-ingest prompt", () => {
  it("builds a prompt with candidate and brief context", () => {
    const prompt = buildArchiveReflectionPrompt({
      candidateName: "Jordan Lee",
      roleName: "Video Editor",
      reasonCode: "portfolio_didnt_land",
      reasonFreeText: null,
      reflectionText: "Too corporate",
      currentAvoidList: ["slow motion"],
      briefStyleSummary: "Clean, kinetic",
    });
    expect(prompt).toContain("Jordan Lee");
    expect(prompt).toContain("Video Editor");
    expect(prompt).toContain("Too corporate");
    expect(prompt).toContain("slow motion");
  });

  it("handles empty avoid list", () => {
    const prompt = buildArchiveReflectionPrompt({
      candidateName: "A",
      roleName: "B",
      reasonCode: "other",
      reasonFreeText: "testing",
      reflectionText: "notes",
      currentAvoidList: [],
      briefStyleSummary: null,
    });
    expect(prompt).toContain("avoid list is currently empty");
  });

  it("system prompt is non-empty", () => {
    expect(buildArchiveReflectionSystem().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — ingestArchiveReflection
// ---------------------------------------------------------------------------

describe("ingestArchiveReflection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCandidateById).mockResolvedValue(mockCandidate as any);
    vi.mocked(getRoleBriefById).mockResolvedValue(mockBrief as any);
    vi.mocked(getArchivesForCandidate).mockResolvedValue([mockArchive as any]);
  });

  it("calls LLM and merges new items into style_avoid_list", async () => {
    vi.mocked(invokeLlmText).mockResolvedValue(
      "corporate reel style\ntoo polished transitions",
    );

    const result = await ingestArchiveReflection("cand-1", "archive-1");

    expect(result.newItems).toEqual([
      "corporate reel style",
      "too polished transitions",
    ]);
    expect(updateRoleBrief).toHaveBeenCalledWith("rb-1", {
      style_avoid_list_json: [
        "overly cinematic slow motion",
        "corporate reel style",
        "too polished transitions",
      ],
    });
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "role_brief_regenerated",
        meta: expect.objectContaining({
          new_items: ["corporate reel style", "too polished transitions"],
        }),
      }),
    );
  });

  it("caps at 3 new items", async () => {
    vi.mocked(invokeLlmText).mockResolvedValue(
      "item one\nitem two\nitem three\nitem four",
    );

    const result = await ingestArchiveReflection("cand-1", "archive-1");
    expect(result.newItems).toHaveLength(3);
  });

  it("returns empty when LLM returns empty", async () => {
    vi.mocked(invokeLlmText).mockResolvedValue("");

    const result = await ingestArchiveReflection("cand-1", "archive-1");
    expect(result.newItems).toEqual([]);
    expect(updateRoleBrief).not.toHaveBeenCalled();
  });

  it("returns empty when candidate not found", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(undefined);

    const result = await ingestArchiveReflection("cand-1", "archive-1");
    expect(result.newItems).toEqual([]);
    expect(invokeLlmText).not.toHaveBeenCalled();
  });

  it("returns empty when candidate has no role_brief_id", async () => {
    vi.mocked(getCandidateById).mockResolvedValue({
      ...mockCandidate,
      role_brief_id: null,
    } as any);

    const result = await ingestArchiveReflection("cand-1", "archive-1");
    expect(result.newItems).toEqual([]);
  });

  it("returns empty when archive has no reflection_text", async () => {
    vi.mocked(getArchivesForCandidate).mockResolvedValue([
      { ...mockArchive, reflection_text: null } as any,
    ]);

    const result = await ingestArchiveReflection("cand-1", "archive-1");
    expect(result.newItems).toEqual([]);
    expect(invokeLlmText).not.toHaveBeenCalled();
  });

  it("filters out lines exceeding 100 chars", async () => {
    const longLine = "x".repeat(101);
    vi.mocked(invokeLlmText).mockResolvedValue(`short item\n${longLine}`);

    const result = await ingestArchiveReflection("cand-1", "archive-1");
    expect(result.newItems).toEqual(["short item"]);
  });

  it("uses hiring-archive-reflection-ingest job name", async () => {
    vi.mocked(invokeLlmText).mockResolvedValue("a new item");

    await ingestArchiveReflection("cand-1", "archive-1");

    expect(invokeLlmText).toHaveBeenCalledWith(
      expect.objectContaining({
        job: "hiring-archive-reflection-ingest",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — Scheduled task handler
// ---------------------------------------------------------------------------

describe("handleHiringArchiveReflectionIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCandidateById).mockResolvedValue(mockCandidate as any);
    vi.mocked(getRoleBriefById).mockResolvedValue(mockBrief as any);
    vi.mocked(getArchivesForCandidate).mockResolvedValue([mockArchive as any]);
    vi.mocked(invokeLlmText).mockResolvedValue("new avoid item");
  });

  it("calls ingestArchiveReflection with correct ids", async () => {
    const task = makeTask({
      candidate_id: "cand-1",
      archive_id: "archive-1",
    });

    await handleHiringArchiveReflectionIngest(task);

    expect(invokeLlmText).toHaveBeenCalled();
    expect(updateRoleBrief).toHaveBeenCalled();
  });

  it("skips when llm_calls_enabled is false", async () => {
    (killSwitches as any).llm_calls_enabled = false;

    const task = makeTask({
      candidate_id: "cand-1",
      archive_id: "archive-1",
    });

    await handleHiringArchiveReflectionIngest(task);

    expect(invokeLlmText).not.toHaveBeenCalled();

    (killSwitches as any).llm_calls_enabled = true;
  });

  it("skips when payload is missing candidate_id", async () => {
    const task = makeTask({ archive_id: "archive-1" });

    await handleHiringArchiveReflectionIngest(task);

    expect(invokeLlmText).not.toHaveBeenCalled();
  });

  it("skips when payload is missing archive_id", async () => {
    const task = makeTask({ candidate_id: "cand-1" });

    await handleHiringArchiveReflectionIngest(task);

    expect(invokeLlmText).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — Handler registry
// ---------------------------------------------------------------------------

describe("handler registry", () => {
  it("hiring_archive_reflection_ingest is registered", async () => {
    const { HANDLER_REGISTRY } = await import(
      "@/lib/scheduled-tasks/handlers/index"
    );
    expect(HANDLER_REGISTRY).toHaveProperty(
      "hiring_archive_reflection_ingest",
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — Scheduled task type
// ---------------------------------------------------------------------------

describe("scheduled task type", () => {
  it("hiring_archive_reflection_ingest is a valid task type", async () => {
    const { SCHEDULED_TASK_TYPES } = await import(
      "@/lib/db/schema/scheduled-tasks"
    );
    expect(SCHEDULED_TASK_TYPES).toContain(
      "hiring_archive_reflection_ingest",
    );
  });
});

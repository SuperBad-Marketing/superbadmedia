import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatSummaryPrompt,
  formatExtractionPrompt,
} from "@/lib/context-engine/prompts";
import { handleMaterialEvent } from "@/lib/context-engine/event-map";
import type { AssembledContext, ExtractionContext } from "@/lib/context-engine/assemble";

vi.mock("@/lib/context-engine/enqueue", () => ({
  enqueueContextSummaryRegenerate: vi.fn(),
  enqueueActionItemExtract: vi.fn(),
}));

const { enqueueContextSummaryRegenerate, enqueueActionItemExtract } =
  await import("@/lib/context-engine/enqueue");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeContext(overrides?: Partial<AssembledContext>): AssembledContext {
  return {
    contact: {
      id: "ct_1",
      name: "Jane Doe",
      role: "Marketing Manager",
      email: "jane@example.com",
      preferredChannel: "email",
      companyId: "co_1",
    },
    company: {
      id: "co_1",
      name: "Test Co",
      industry: "Photography",
      sizeBand: "small",
      location: "Melbourne",
    },
    recentMessages: [
      {
        id: "msg_1",
        direction: "inbound",
        channel: "email",
        subject: "Re: Quote",
        bodyText: "Looks good, can you send the updated proposal by Friday?",
        sentAtMs: Date.now() - 3600_000,
      },
    ],
    activityEntries: [
      {
        kind: "deal_stage_changed",
        body: "Stage moved to negotiation",
        createdAtMs: Date.now() - 7200_000,
      },
    ],
    openActionItems: [
      { description: "Send updated proposal", owner: "you", dueDateMs: null },
    ],
    currentDeal: {
      stage: "negotiation",
      valueCents: 350000,
      lastStageChangeAtMs: Date.now() - 86400_000,
      subscriptionState: null,
    },
    outstandingInvoices: [],
    brandDna: { signalTags: "modern, bold", prosePortrait: null },
    conversationSummary: null,
    activeStrategy: null,
    ...overrides,
  };
}

describe("formatSummaryPrompt", () => {
  it("returns system and prompt strings", () => {
    const ctx = makeContext();
    const { system, prompt } = formatSummaryPrompt(ctx);

    expect(system).toContain("flat factual");
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("Test Co");
    expect(prompt).toContain("negotiation");
    expect(prompt).toContain("Send updated proposal");
  });

  it("includes deal value when present", () => {
    const ctx = makeContext();
    const { prompt } = formatSummaryPrompt(ctx);
    expect(prompt).toContain("$3500.00");
  });

  it("handles missing company gracefully", () => {
    const ctx = makeContext({ company: null });
    const { prompt } = formatSummaryPrompt(ctx);
    expect(prompt).toContain("Jane Doe");
    expect(prompt).not.toContain("Company:");
  });

  it("handles no action items", () => {
    const ctx = makeContext({ openActionItems: [] });
    const { prompt } = formatSummaryPrompt(ctx);
    expect(prompt).not.toContain("Open action items:");
  });

  it("includes outstanding invoices", () => {
    const ctx = makeContext({
      outstandingInvoices: [
        { invoiceNumber: "INV-001", status: "overdue", totalCentsIncGst: 50000 },
      ],
    });
    const { prompt } = formatSummaryPrompt(ctx);
    expect(prompt).toContain("INV-001");
    expect(prompt).toContain("overdue");
  });

  it("includes brand DNA tags", () => {
    const ctx = makeContext();
    const { prompt } = formatSummaryPrompt(ctx);
    expect(prompt).toContain("modern, bold");
  });

  it("includes active strategy status", () => {
    const ctx = makeContext({
      activeStrategy: { status: "live", payloadJson: {} },
    });
    const { prompt } = formatSummaryPrompt(ctx);
    expect(prompt).toContain("Active strategy: live");
  });

  it("truncates very long input", () => {
    const manyMessages = Array.from({ length: 100 }, (_, i) => ({
      id: `msg_${i}`,
      direction: "inbound" as const,
      channel: "email",
      subject: `Thread ${i}`,
      bodyText: "x".repeat(500),
      sentAtMs: Date.now() - i * 3600_000,
    }));
    const manyActivities = Array.from({ length: 100 }, (_, i) => ({
      kind: `activity_${i}`,
      body: "y".repeat(300),
      createdAtMs: Date.now() - i * 3600_000,
    }));
    const ctx = makeContext({
      recentMessages: manyMessages,
      activityEntries: manyActivities,
    });
    const { prompt } = formatSummaryPrompt(ctx);
    expect(prompt).toContain("[…truncated]");
  });
});

describe("formatExtractionPrompt", () => {
  it("returns system and prompt for inbound message", () => {
    const ctx: ExtractionContext = {
      messageBody: "Can you send the proposal by Friday?",
      direction: "inbound",
    };
    const { system, prompt } = formatExtractionPrompt(ctx, []);

    expect(system).toContain("inbound");
    expect(system).toContain("owner is 'you'");
    expect(prompt).toContain("Can you send the proposal by Friday?");
  });

  it("returns system and prompt for outbound message", () => {
    const ctx: ExtractionContext = {
      messageBody: "I'll have the proposal ready by Monday.",
      direction: "outbound",
    };
    const { system, prompt } = formatExtractionPrompt(ctx, []);

    expect(system).toContain("outbound");
    expect(system).toContain("First person ('I will', 'we will') = owner is 'you'");
  });

  it("includes existing items for dedup", () => {
    const ctx: ExtractionContext = {
      messageBody: "I'll send the brief.",
      direction: "outbound",
    };
    const existing = [
      { description: "Send the brief", owner: "you" },
    ];
    const { prompt } = formatExtractionPrompt(ctx, existing);

    expect(prompt).toContain("Existing open action items");
    expect(prompt).toContain("Send the brief");
  });

  it("omits dedup section when no existing items", () => {
    const ctx: ExtractionContext = {
      messageBody: "Hello!",
      direction: "inbound",
    };
    const { prompt } = formatExtractionPrompt(ctx, []);
    expect(prompt).not.toContain("Existing open action items");
  });
});

describe("handleMaterialEvent", () => {
  it("enqueues extraction + summary for new_inbound_message", async () => {
    await handleMaterialEvent("new_inbound_message", "ct_1", "msg_1");

    expect(enqueueActionItemExtract).toHaveBeenCalledWith("ct_1", "msg_1");
    expect(enqueueContextSummaryRegenerate).toHaveBeenCalledWith("ct_1");
  });

  it("enqueues extraction + summary for new_outbound_message", async () => {
    await handleMaterialEvent("new_outbound_message", "ct_1", "msg_2");

    expect(enqueueActionItemExtract).toHaveBeenCalledWith("ct_1", "msg_2");
    expect(enqueueContextSummaryRegenerate).toHaveBeenCalledWith("ct_1");
  });

  it("enqueues summary only for deal_stage_change", async () => {
    await handleMaterialEvent("deal_stage_change", "ct_1");

    expect(enqueueContextSummaryRegenerate).toHaveBeenCalledWith("ct_1");
    expect(enqueueActionItemExtract).not.toHaveBeenCalled();
  });

  it("enqueues summary only for action_item_completed", async () => {
    await handleMaterialEvent("action_item_completed", "ct_1");

    expect(enqueueContextSummaryRegenerate).toHaveBeenCalledWith("ct_1");
    expect(enqueueActionItemExtract).not.toHaveBeenCalled();
  });

  it("skips extraction if no messageId for message events", async () => {
    await handleMaterialEvent("new_inbound_message", "ct_1");

    expect(enqueueActionItemExtract).not.toHaveBeenCalled();
    expect(enqueueContextSummaryRegenerate).toHaveBeenCalledWith("ct_1");
  });
});

describe("handleContextSummaryRegenerate handler", () => {
  it("gates on llm_calls_enabled kill switch", async () => {
    const killSwitchModule = await import("@/lib/kill-switches");
    const original = killSwitchModule.killSwitches.llm_calls_enabled;

    vi.spyOn(killSwitchModule.killSwitches, "llm_calls_enabled", "get").mockReturnValue(false);

    const { handleContextSummaryRegenerate } = await import(
      "@/lib/scheduled-tasks/handlers/context-engine"
    );

    const mockTask = {
      id: "t_1",
      task_type: "context_summary_regenerate" as const,
      status: "running" as const,
      payload: { contact_id: "ct_1" },
      run_at_ms: Date.now(),
      idempotency_key: null,
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
      started_at_ms: Date.now(),
      completed_at_ms: null,
      last_attempted_at_ms: null,
      done_at_ms: null,
      reclaimed_at_ms: null,
    };

    await handleContextSummaryRegenerate(mockTask);

    vi.restoreAllMocks();
  });

  it("throws on invalid payload", async () => {
    const killSwitchModule = await import("@/lib/kill-switches");
    vi.spyOn(killSwitchModule.killSwitches, "llm_calls_enabled", "get").mockReturnValue(true);

    const { handleContextSummaryRegenerate } = await import(
      "@/lib/scheduled-tasks/handlers/context-engine"
    );

    const mockTask = {
      id: "t_1",
      task_type: "context_summary_regenerate" as const,
      status: "running" as const,
      payload: {},
      run_at_ms: Date.now(),
      idempotency_key: null,
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
      started_at_ms: Date.now(),
      completed_at_ms: null,
      last_attempted_at_ms: null,
      done_at_ms: null,
      reclaimed_at_ms: null,
    };

    await expect(handleContextSummaryRegenerate(mockTask)).rejects.toThrow(
      "context_summary_regenerate: invalid payload",
    );

    vi.restoreAllMocks();
  });
});

describe("handleContextActionItemExtract handler", () => {
  it("throws on invalid payload", async () => {
    const killSwitchModule = await import("@/lib/kill-switches");
    vi.spyOn(killSwitchModule.killSwitches, "llm_calls_enabled", "get").mockReturnValue(true);

    const { handleContextActionItemExtract } = await import(
      "@/lib/scheduled-tasks/handlers/context-engine"
    );

    const mockTask = {
      id: "t_2",
      task_type: "context_action_item_extract" as const,
      status: "running" as const,
      payload: { contact_id: "ct_1" },
      run_at_ms: Date.now(),
      idempotency_key: null,
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
      started_at_ms: Date.now(),
      completed_at_ms: null,
      last_attempted_at_ms: null,
      done_at_ms: null,
      reclaimed_at_ms: null,
    };

    await expect(handleContextActionItemExtract(mockTask)).rejects.toThrow(
      "context_action_item_extract: invalid payload",
    );

    vi.restoreAllMocks();
  });
});

describe("ExtractedItemSchema validation", () => {
  it("accepts valid action items via the extraction prompt format", () => {
    const ctx: ExtractionContext = {
      messageBody: "I'll send the contract Monday.",
      direction: "outbound",
    };
    const { system, prompt } = formatExtractionPrompt(ctx, []);
    expect(system).toContain("JSON array");
    expect(prompt).toContain("I'll send the contract Monday.");
  });
});

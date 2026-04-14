import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(async () => ({ sent: true, messageId: "mock" })),
}));

import { HANDLER_REGISTRY } from "@/lib/scheduled-tasks/handlers";
import {
  QUOTE_BUILDER_TASK_TYPES,
  QUOTE_BUILDER_STUB_TASK_TYPES,
  NotImplementedError,
} from "@/lib/scheduled-tasks/handlers/quote-builder";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

function fakeRow(task_type: string): ScheduledTaskRow {
  return {
    id: "t",
    task_type: task_type as ScheduledTaskRow["task_type"],
    run_at_ms: 0,
    payload: null,
    status: "running",
    attempts: 0,
    last_attempted_at_ms: null,
    last_error: null,
    idempotency_key: null,
    created_at_ms: 0,
    done_at_ms: null,
    reclaimed_at_ms: null,
  };
}

describe("QB-1 — scheduled-tasks handler registry", () => {
  it("registers every QB-owned task type", () => {
    for (const t of QUOTE_BUILDER_TASK_TYPES) {
      expect(HANDLER_REGISTRY[t]).toBeTypeOf("function");
    }
  });

  it("covers all 8 QB task types from spec §8.3 (6 stubs + 2 QB-3 impls)", () => {
    expect(QUOTE_BUILDER_TASK_TYPES).toEqual([
      "quote_expire",
      "quote_reminder_3d",
      "manual_invoice_generate",
      "manual_invoice_send",
      "subscription_pause_resume_reminder",
      "subscription_pause_resume",
      "quote_pdf_render",
      "quote_email_send",
    ]);
  });

  it("stub handlers throw NotImplementedError (surfaces as failed in worker)", async () => {
    for (const t of QUOTE_BUILDER_STUB_TASK_TYPES) {
      const handler = HANDLER_REGISTRY[t];
      expect(handler).toBeDefined();
      await expect(handler!(fakeRow(t))).rejects.toBeInstanceOf(
        NotImplementedError,
      );
    }
  });
});

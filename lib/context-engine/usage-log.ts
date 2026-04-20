import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  llm_usage_log,
  type LlmCallType,
  type LlmUsageLogRow,
} from "@/lib/db/schema/llm-usage-log";
import { type ModelTier } from "@/lib/ai/models";

export async function logLlmUsage(input: {
  callType: LlmCallType;
  contactId?: string | null;
  model: ModelTier;
  inputTokens: number;
  outputTokens: number;
}): Promise<LlmUsageLogRow> {
  const row = {
    id: randomUUID(),
    call_type: input.callType,
    contact_id: input.contactId ?? null,
    model: input.model,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    created_at_ms: Date.now(),
  };
  const [inserted] = await db.insert(llm_usage_log).values(row).returning();
  return inserted;
}

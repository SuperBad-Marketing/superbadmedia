import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema/messages";
import { threads } from "@/lib/db/schema/messages";
import { assembleContext } from "@/lib/context-engine/assemble";
import { upsertContextSummary } from "@/lib/context-engine/summary";
import {
  getActionItems,
  createActionItem,
} from "@/lib/context-engine/action-items";
import { logLlmUsage } from "@/lib/context-engine/usage-log";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmTextWithMeta } from "@/lib/ai/invoke";
import { modelTierFor } from "@/lib/ai/models";
import {
  formatSummaryPrompt,
  formatExtractionPrompt,
} from "@/lib/context-engine/prompts";

const SummaryRegeneratePayloadSchema = z.object({
  contact_id: z.string().min(1),
});

const ActionItemExtractPayloadSchema = z.object({
  contact_id: z.string().min(1),
  message_id: z.string().min(1),
});

export const handleContextSummaryRegenerate: TaskHandler = async (task) => {
  if (!killSwitches.llm_calls_enabled) return;

  const parsed = SummaryRegeneratePayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `context_summary_regenerate: invalid payload (${parsed.error.message})`,
    );
  }

  const { contact_id } = parsed.data;

  const ctx = await assembleContext(contact_id, "summary");
  const { system, prompt } = formatSummaryPrompt(ctx);

  const result = await invokeLlmTextWithMeta({
    job: "client-context-summarise",
    system,
    prompt,
    maxTokens: 512,
  });

  await upsertContextSummary(contact_id, result.text);

  await logLlmUsage({
    callType: "summary_regeneration",
    contactId: contact_id,
    model: modelTierFor("client-context-summarise"),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  await logActivity({
    contactId: contact_id,
    kind: "context_summary_regenerated",
    body: result.text,
  });
};

const ExtractedItemSchema = z.object({
  description: z.string(),
  owner: z.enum(["you", "them"]),
  due_date: z.string().nullable(),
});

export const handleContextActionItemExtract: TaskHandler = async (task) => {
  if (!killSwitches.llm_calls_enabled) return;

  const parsed = ActionItemExtractPayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `context_action_item_extract: invalid payload (${parsed.error.message})`,
    );
  }

  const { contact_id, message_id } = parsed.data;

  const msg = await db
    .select({
      bodyText: messages.body_text,
      direction: messages.direction,
      sentAtMs: messages.sent_at_ms,
    })
    .from(messages)
    .where(eq(messages.id, message_id))
    .get();

  if (!msg) return;

  const extractionCtx = await assembleContext(
    contact_id,
    "extraction",
    msg.bodyText,
    msg.direction as "inbound" | "outbound",
  );

  const existingOpen = await getActionItems(contact_id, { status: "open" });
  const existingForDedup = existingOpen.map((i) => ({
    description: i.description,
    owner: i.owner,
  }));

  const { system, prompt } = formatExtractionPrompt(
    extractionCtx,
    existingForDedup,
  );

  const result = await invokeLlmTextWithMeta({
    job: "client-context-extract-action-items",
    system,
    prompt,
    maxTokens: 1024,
  });

  let items: Array<{ description: string; owner: "you" | "them"; due_date: string | null }> = [];
  try {
    const raw = JSON.parse(result.text);
    const arr = Array.isArray(raw) ? raw : [];
    for (const entry of arr) {
      const r = ExtractedItemSchema.safeParse(entry);
      if (r.success) items.push(r.data);
    }
  } catch {
    // LLM returned non-JSON — no items extracted
  }

  for (const item of items) {
    let dueDateMs: number | null = null;
    if (item.due_date) {
      const parsed = Date.parse(item.due_date);
      if (!Number.isNaN(parsed)) dueDateMs = parsed;
    }

    await createActionItem({
      contactId: contact_id,
      description: item.description,
      owner: item.owner,
      dueDateMs,
      source: "claude_extract",
      sourceMessageId: message_id,
    });
  }

  await logLlmUsage({
    callType: "action_item_extraction",
    contactId: contact_id,
    model: modelTierFor("client-context-extract-action-items"),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
};

export const CONTEXT_ENGINE_HANDLERS: HandlerMap = {
  context_summary_regenerate: handleContextSummaryRegenerate,
  context_action_item_extract: handleContextActionItemExtract,
};

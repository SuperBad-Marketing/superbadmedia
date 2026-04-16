/**
 * Scheduled-task handler for `inbox_draft_generate` — the async
 * Opus-tier cached-draft generator enqueued from `lib/graph/sync.ts`
 * after the three parallel inbound classifiers settle.
 *
 * Payload: `{ thread_id: string }`. The handler delegates to
 * `generateCachedDraftReply(thread_id)` in `lib/graph/draft-reply.ts`.
 *
 * Failures fall through to the worker's retry/backoff: the generator
 * itself swallows LLM errors (discipline #63 — no write on fallback),
 * so the only failures bubbled up from here are invalid payloads.
 */
import { z } from "zod";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { generateCachedDraftReply } from "@/lib/graph/draft-reply";

export const InboxDraftGeneratePayloadSchema = z.object({
  thread_id: z.string().min(1),
});

export type InboxDraftGeneratePayload = z.infer<
  typeof InboxDraftGeneratePayloadSchema
>;

export const handleInboxDraftGenerate: TaskHandler = async (task) => {
  const parsed = InboxDraftGeneratePayloadSchema.safeParse(task.payload);
  if (!parsed.success) {
    throw new Error(
      `inbox_draft_generate: invalid payload (${parsed.error.message})`,
    );
  }
  await generateCachedDraftReply(parsed.data.thread_id);
};

export const INBOX_DRAFT_HANDLERS: HandlerMap = {
  inbox_draft_generate: handleInboxDraftGenerate,
};

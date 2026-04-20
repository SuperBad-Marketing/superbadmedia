import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

export async function enqueueContextSummaryRegenerate(
  contactId: string,
): Promise<void> {
  const pending = await db
    .select({ id: scheduled_tasks.id })
    .from(scheduled_tasks)
    .where(
      and(
        eq(scheduled_tasks.task_type, "context_summary_regenerate"),
        eq(scheduled_tasks.status, "pending"),
        eq(
          scheduled_tasks.idempotency_key,
          `ctx_summary_${contactId}`,
        ),
      ),
    )
    .get();

  if (pending) return;

  await enqueueTask({
    task_type: "context_summary_regenerate",
    runAt: Date.now(),
    payload: { contact_id: contactId },
    idempotencyKey: `ctx_summary_${contactId}`,
  });
}

export async function enqueueActionItemExtract(
  contactId: string,
  messageId: string,
): Promise<void> {
  await enqueueTask({
    task_type: "context_action_item_extract",
    runAt: Date.now(),
    payload: { contact_id: contactId, message_id: messageId },
    idempotencyKey: `ctx_extract_${messageId}`,
  });
}

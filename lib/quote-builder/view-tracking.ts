import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { transitionQuoteStatus } from "@/lib/quote-builder/transitions";
import { logActivity } from "@/lib/activity-log";

type DatabaseLike = typeof defaultDb;

/**
 * First-fetch view tracking per spec §3.2.2.
 *
 * Idempotent: only the `sent → viewed` transition runs the side effects.
 * Calling on a row already in `viewed` (or any later state) is a no-op
 * and returns the row as-is. Designed to be called inside a server
 * component render — never throws on benign races.
 */
export async function markQuoteViewed(
  quote: Pick<QuoteRow, "id" | "status" | "company_id" | "deal_id">,
  dbOverride?: DatabaseLike,
): Promise<void> {
  if (quote.status !== "sent") return;
  const database = dbOverride ?? defaultDb;
  try {
    await transitionQuoteStatus(
      {
        quote_id: quote.id,
        from: "sent",
        to: "viewed",
        patch: { viewed_at_ms: Date.now() },
      },
      database,
    );
  } catch {
    // Concurrency race — another visitor flipped sent → viewed first, or
    // an admin transitioned to a terminal state between SELECT and UPDATE.
    // Either way nothing to do; do not double-log.
    return;
  }

  await logActivity({
    companyId: quote.company_id,
    dealId: quote.deal_id,
    kind: "quote_viewed",
    body: "Client opened the quote page.",
  });

  // Mark the pending 3-day reminder skipped (spec §3.2.2). The reminder
  // is enqueued at send time using a deterministic idempotency key — if
  // the row exists and is still pending, flip it to `skipped`. If no
  // row exists this is a no-op.
  await database
    .update(scheduled_tasks)
    .set({ status: "skipped", done_at_ms: Date.now() })
    .where(
      and(
        eq(scheduled_tasks.idempotency_key, `quote_reminder_3d:${quote.id}`),
        eq(scheduled_tasks.status, "pending"),
      ),
    );
}

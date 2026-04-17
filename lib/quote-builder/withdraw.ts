import { and, eq, like } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow, type QuoteStatus } from "@/lib/db/schema/quotes";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { assertQuoteTransition } from "@/lib/quote-builder/transitions";
import { logActivity } from "@/lib/activity-log";

type DatabaseLike = typeof defaultDb;

export interface WithdrawQuoteInput {
  quote_id: string;
  /** Optional human reason captured in activity-log meta. */
  reason?: string | null;
  /** User id of the admin initiating the withdraw (audit trail). */
  by_user_id?: string | null;
}

export interface WithdrawQuoteResult {
  ok: boolean;
  quote?: QuoteRow;
  error?: string;
}

/**
 * Withdraw a quote per spec §7.8. Legal transitions:
 *   draft → withdrawn
 *   sent  → withdrawn
 *   viewed → withdrawn
 * Terminal states refuse. Pending `scheduled_tasks` rows keyed on the
 * quote (by deterministic idempotency key prefixes) flip to
 * `status='skipped'` in the same transaction so expired-reminder
 * stragglers don't fire against a dead row.
 *
 * Activity-log write happens outside the transaction — the state
 * change is the irreversible side effect; a log write failure must
 * not roll it back.
 */
export async function withdrawQuote(
  input: WithdrawQuoteInput,
  dbOverride?: DatabaseLike,
): Promise<WithdrawQuoteResult> {
  const database = dbOverride ?? defaultDb;
  const existing = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get();
  if (!existing) return { ok: false, error: "quote_not_found" };

  const from = existing.status as QuoteStatus;
  try {
    assertQuoteTransition(from, "withdrawn");
  } catch {
    return { ok: false, error: `illegal_transition:${from}→withdrawn` };
  }

  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txRunner = database as any;
  let updated: QuoteRow | null = null;
  txRunner.transaction((tx: DatabaseLike) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;
    const rows = txDb
      .update(quotes)
      .set({ status: "withdrawn", withdrawn_at_ms: now })
      .where(and(eq(quotes.id, input.quote_id), eq(quotes.status, from)))
      .returning()
      .all() as QuoteRow[];
    if (rows.length === 0) {
      throw new Error("withdrawQuote: concurrent transition");
    }
    updated = rows[0];
    cancelPendingQuoteTasks(txDb, input.quote_id, now);
  });

  if (!updated) return { ok: false, error: "transition_failed" };
  const row: QuoteRow = updated;

  await logActivity({
    companyId: row.company_id,
    dealId: row.deal_id,
    kind: "quote_withdrawn",
    body: `Quote ${row.quote_number} withdrawn from ${from}.`,
    meta: {
      quote_id: row.id,
      prior_status: from,
      reason: input.reason ?? null,
    },
    createdBy: input.by_user_id ?? null,
  });

  return { ok: true, quote: row };
}

/**
 * Flip all pending scheduled_tasks for this quote to 'skipped'. Keyed
 * on the deterministic idempotency_key prefixes the quote-builder
 * handlers use (`quote_reminder_3d:<id>`, `quote_expire:<id>`,
 * `quote_pdf_render:<id>`, `quote_settle_email:<id>`, etc.). Runs
 * inside a caller-supplied transaction.
 */
export function cancelPendingQuoteTasks(
  txDb: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle tx type is opaque
  quoteId: string,
  nowMs: number,
): void {
  // SQLite LIKE with a stable prefix; idempotency keys are
  // `<task_type>:<quote_id>[:suffix]`. We match the `<quote_id>`
  // segment to catch every per-quote task type in one shot.
  // Match `<task_type>:<quoteId>` and `<task_type>:<quoteId>:<suffix>`
  // in one shot by anchoring on `:<quoteId>` and allowing a trailing
  // segment (or end-of-string via a second LIKE).
  txDb
    .update(scheduled_tasks)
    .set({ status: "skipped", done_at_ms: nowMs })
    .where(
      and(
        eq(scheduled_tasks.status, "pending"),
        like(scheduled_tasks.idempotency_key, `%:${quoteId}`),
      ),
    )
    .run();
  txDb
    .update(scheduled_tasks)
    .set({ status: "skipped", done_at_ms: nowMs })
    .where(
      and(
        eq(scheduled_tasks.status, "pending"),
        like(scheduled_tasks.idempotency_key, `%:${quoteId}:%`),
      ),
    )
    .run();
}

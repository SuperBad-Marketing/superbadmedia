import { and, eq, like } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import {
  deals,
  type DealRow,
  type DealSubscriptionState,
} from "@/lib/db/schema/deals";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { logActivity } from "@/lib/activity-log";

type DatabaseLike = typeof defaultDb;

export interface EarlyCancelInput {
  deal_id: string;
  /** User id of the admin or client initiating the transition. */
  by_user_id?: string | null;
}

export interface EarlyCancelResult {
  ok: boolean;
  deal?: DealRow;
  error?: string;
}

/**
 * Flip `subscription_state: active → pending_early_exit` atomically.
 *
 * Called from the Client Portal cancel flow the moment the client picks
 * option 2 (pay remainder) or option 3 (buyout), *before* we hit Stripe
 * for the charge. The `pending_early_exit` state is how we resist
 * double-submits and give the back-out path (`abandonEarlyCancelIntent`)
 * somewhere to land if Stripe confirmation fails or the client changes
 * their mind mid-payment.
 *
 * Concurrency guard: `WHERE subscription_state = 'active'` — if anything
 * else has already moved the row off `active`, the UPDATE matches zero
 * rows and we return `illegal_transition` rather than clobbering state.
 */
export async function beginEarlyCancelIntent(
  input: EarlyCancelInput,
  dbOverride?: DatabaseLike,
): Promise<EarlyCancelResult> {
  const database = dbOverride ?? defaultDb;
  const now = Date.now();

  const updated = await database
    .update(deals)
    .set({ subscription_state: "pending_early_exit", updated_at_ms: now })
    .where(
      and(eq(deals.id, input.deal_id), eq(deals.subscription_state, "active")),
    )
    .returning();

  if (updated.length === 0) {
    return pickIllegalOrNotFound(database, input.deal_id, "active");
  }
  return { ok: true, deal: updated[0] };
}

/**
 * Back-out of a pending early-cancel. Flips
 * `pending_early_exit → active`. Used by (a) the "let's chat" /
 * "actually, stay" button if it's reachable after begin, and (b) the
 * Stripe payment-failed branch in the Client Portal wave.
 */
export async function abandonEarlyCancelIntent(
  input: EarlyCancelInput,
  dbOverride?: DatabaseLike,
): Promise<EarlyCancelResult> {
  const database = dbOverride ?? defaultDb;
  const now = Date.now();

  const updated = await database
    .update(deals)
    .set({ subscription_state: "active", updated_at_ms: now })
    .where(
      and(
        eq(deals.id, input.deal_id),
        eq(deals.subscription_state, "pending_early_exit"),
      ),
    )
    .returning();

  if (updated.length === 0) {
    return pickIllegalOrNotFound(
      database,
      input.deal_id,
      "pending_early_exit",
    );
  }
  return { ok: true, deal: updated[0] };
}

/**
 * Finalise option 2 — client paid the remaining committed cycles in
 * full. Flips `pending_early_exit → cancelled_paid_remainder`, cancels
 * pending per-deal scheduled tasks, and stamps the activity log.
 *
 * Data shape only — the Stripe charge + subscription cancel run in the
 * Client Portal wave before this finalise fires. This helper is what
 * the webhook / confirm step calls once the money is in.
 */
export async function finaliseEarlyCancelPaidRemainder(
  input: EarlyCancelInput,
  dbOverride?: DatabaseLike,
): Promise<EarlyCancelResult> {
  return finaliseTerminal(
    input,
    "cancelled_paid_remainder",
    "subscription_early_cancel_paid_remainder",
    dbOverride,
  );
}

/**
 * Finalise option 3 — client paid the 50% buyout. Flips
 * `pending_early_exit → cancelled_buyout`, cancels pending per-deal
 * scheduled tasks, and stamps the activity log.
 */
export async function finaliseEarlyCancelBuyout(
  input: EarlyCancelInput,
  dbOverride?: DatabaseLike,
): Promise<EarlyCancelResult> {
  return finaliseTerminal(
    input,
    "cancelled_buyout",
    "subscription_early_cancel_buyout_50pct",
    dbOverride,
  );
}

async function finaliseTerminal(
  input: EarlyCancelInput,
  target:
    | "cancelled_paid_remainder"
    | "cancelled_buyout",
  activityKind:
    | "subscription_early_cancel_paid_remainder"
    | "subscription_early_cancel_buyout_50pct",
  dbOverride?: DatabaseLike,
): Promise<EarlyCancelResult> {
  const database = dbOverride ?? defaultDb;
  const now = Date.now();

  let updated: DealRow | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txRunner = database as any;
  try {
    txRunner.transaction((tx: DatabaseLike) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txDb = tx as any;
      const rows = txDb
        .update(deals)
        .set({ subscription_state: target, updated_at_ms: now })
        .where(
          and(
            eq(deals.id, input.deal_id),
            eq(deals.subscription_state, "pending_early_exit"),
          ),
        )
        .returning()
        .all() as DealRow[];
      if (rows.length === 0) {
        throw new Error("finaliseTerminal: concurrent transition");
      }
      updated = rows[0];
      cancelPendingDealTasks(txDb, input.deal_id, now);
    });
  } catch {
    return pickIllegalOrNotFound(
      database,
      input.deal_id,
      "pending_early_exit",
    );
  }

  if (!updated) return { ok: false, error: "transition_failed" };
  const row: DealRow = updated;

  await logActivity({
    companyId: row.company_id,
    dealId: row.id,
    kind: activityKind,
    body:
      target === "cancelled_paid_remainder"
        ? `Retainer cancelled — paid remainder.`
        : `Retainer cancelled — 50% buyout.`,
    meta: {
      deal_id: row.id,
      terminal_state: target,
      billing_cadence: row.billing_cadence,
      committed_until_date_ms: row.committed_until_date_ms,
    },
    createdBy: input.by_user_id ?? null,
  });

  return { ok: true, deal: row };
}

/**
 * Cancel pending per-deal scheduled_tasks. Same idempotency-key-prefix
 * trick the quote-builder helpers use. Per-deal keys are shaped
 * `<task_type>:<deal_id>[:<suffix>]` (e.g.
 * `subscription_pause_resume:<deal_id>`). Runs inside the caller's tx.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cancelPendingDealTasks(
  txDb: any,
  dealId: string,
  nowMs: number,
): void {
  txDb
    .update(scheduled_tasks)
    .set({ status: "skipped", done_at_ms: nowMs })
    .where(
      and(
        eq(scheduled_tasks.status, "pending"),
        like(scheduled_tasks.idempotency_key, `%:${dealId}`),
      ),
    )
    .run();
  txDb
    .update(scheduled_tasks)
    .set({ status: "skipped", done_at_ms: nowMs })
    .where(
      and(
        eq(scheduled_tasks.status, "pending"),
        like(scheduled_tasks.idempotency_key, `%:${dealId}:%`),
      ),
    )
    .run();
}

async function pickIllegalOrNotFound(
  database: DatabaseLike,
  dealId: string,
  expected: DealSubscriptionState,
): Promise<EarlyCancelResult> {
  const existing = await database
    .select()
    .from(deals)
    .where(eq(deals.id, dealId))
    .get();
  if (!existing) return { ok: false, error: "deal_not_found" };
  const from = existing.subscription_state ?? "null";
  return {
    ok: false,
    error: `illegal_transition:${from}→(expected ${expected})`,
  };
}

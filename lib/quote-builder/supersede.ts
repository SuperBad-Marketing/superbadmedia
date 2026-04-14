import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteRow } from "@/lib/db/schema/quotes";
import {
  assertQuoteTransition,
  isTerminal,
} from "@/lib/quote-builder/transitions";
import {
  computeTotals,
  inferStructure,
  type QuoteContent,
} from "@/lib/quote-builder/content-shape";
import { allocateQuoteNumber } from "@/lib/quote-builder/sequences";
import { logActivity } from "@/lib/activity-log";
import { cancelPendingQuoteTasks } from "@/lib/quote-builder/withdraw";

type DatabaseLike = typeof defaultDb;

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface ForkDraftFromSentInput {
  source_quote_id: string;
  user_id: string;
}

export interface ForkDraftFromSentResult {
  ok: boolean;
  quote?: QuoteRow;
  error?: string;
}

/**
 * Edit-after-send fork (spec §7.7). Creates a new `draft` row that
 * points at the sent source via `supersedes_quote_id`, copying content
 * so the editor opens with the old values. The source row is NOT
 * mutated — it stays in its current status until the new draft is
 * sent, at which point `finaliseSupersedeOnSend` atomically transitions
 * old → superseded and new → sent in the same transaction.
 *
 * Idempotency: if an open draft already exists with
 * `supersedes_quote_id === source_quote_id` (and status='draft'),
 * returns that row instead of creating a second one. Prevents runaway
 * duplicate forks if Andy clicks Edit twice.
 */
export async function forkDraftFromSent(
  input: ForkDraftFromSentInput,
  dbOverride?: DatabaseLike,
): Promise<ForkDraftFromSentResult> {
  const database = dbOverride ?? defaultDb;
  const source = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.source_quote_id))
    .get();
  if (!source) return { ok: false, error: "source_not_found" };
  if (source.status !== "sent" && source.status !== "viewed") {
    return { ok: false, error: `source_not_live:${source.status}` };
  }

  // Idempotency — an existing open draft forked from the same source.
  const existing = await database
    .select()
    .from(quotes)
    .where(
      and(
        eq(quotes.supersedes_quote_id, source.id),
        eq(quotes.status, "draft"),
      ),
    )
    .get();
  if (existing) return { ok: true, quote: existing };

  const content = (source.content_json as QuoteContent | null) ?? null;
  const totals = content
    ? computeTotals(content)
    : {
        total_cents_inc_gst: source.total_cents_inc_gst,
        retainer_monthly_cents_inc_gst: source.retainer_monthly_cents_inc_gst,
        one_off_cents_inc_gst: source.one_off_cents_inc_gst,
      };
  const structure = content ? inferStructure(content) : source.structure;
  const quoteNumber = await allocateQuoteNumber({ db: database });
  const now = Date.now();
  const id = randomUUID();

  await database.insert(quotes).values({
    id,
    deal_id: source.deal_id,
    company_id: source.company_id,
    token: generateToken(),
    quote_number: quoteNumber,
    status: "draft",
    structure,
    content_json: content,
    catalogue_snapshot_json: source.catalogue_snapshot_json,
    total_cents_inc_gst: totals.total_cents_inc_gst,
    retainer_monthly_cents_inc_gst: totals.retainer_monthly_cents_inc_gst,
    one_off_cents_inc_gst: totals.one_off_cents_inc_gst,
    term_length_months: source.term_length_months,
    buyout_percentage: source.buyout_percentage,
    tier_rank: source.tier_rank,
    supersedes_quote_id: source.id,
    created_at_ms: now,
    last_edited_by_user_id: input.user_id,
  });

  const row = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, id))
    .get();
  if (!row) return { ok: false, error: "fork_insert_missing" };
  return { ok: true, quote: row };
}

export interface FinaliseSupersedeInput {
  new_quote_id: string;
  /** Result of the send-email dispatch — mirrored onto the new row. */
  thread_message_id?: string | null;
}

export interface FinaliseSupersedeResult {
  ok: boolean;
  newQuote?: QuoteRow;
  oldQuote?: QuoteRow;
  error?: string;
}

/**
 * Atomically transition the new draft → sent AND the old sent/viewed
 * row → superseded in a single transaction (spec §7.7). Cancels any
 * pending scheduled_tasks on the old row in the same tx so the
 * expire/reminder handlers don't fire against a dead row.
 *
 * Called from `sendQuoteAction` when the draft being sent carries a
 * `supersedes_quote_id`. Activity-log write runs outside the tx.
 */
export async function finaliseSupersedeOnSend(
  input: FinaliseSupersedeInput,
  dbOverride?: DatabaseLike,
): Promise<FinaliseSupersedeResult> {
  const database = dbOverride ?? defaultDb;
  const newDraft = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, input.new_quote_id))
    .get();
  if (!newDraft) return { ok: false, error: "new_not_found" };
  if (newDraft.status !== "draft") {
    return { ok: false, error: `new_not_draft:${newDraft.status}` };
  }
  if (!newDraft.supersedes_quote_id) {
    return { ok: false, error: "new_has_no_source" };
  }

  const oldRow = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, newDraft.supersedes_quote_id))
    .get();
  if (!oldRow) return { ok: false, error: "old_not_found" };

  const oldFrom = oldRow.status;
  // Old might already be terminal (accepted before the new draft sent,
  // or expired mid-edit). Refuse — the admin needs to start over.
  if (isTerminal(oldFrom)) {
    return { ok: false, error: `old_terminal:${oldFrom}` };
  }
  try {
    assertQuoteTransition(oldFrom, "superseded");
  } catch {
    return { ok: false, error: `illegal_old_transition:${oldFrom}` };
  }
  try {
    assertQuoteTransition("draft", "sent");
  } catch {
    return { ok: false, error: "illegal_new_transition" };
  }

  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txRunner = database as any;
  let newAfter: QuoteRow | null = null;
  let oldAfter: QuoteRow | null = null;
  txRunner.transaction((tx: DatabaseLike) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;

    const oldUpdated = txDb
      .update(quotes)
      .set({
        status: "superseded",
        superseded_at_ms: now,
        superseded_by_quote_id: newDraft.id,
      })
      .where(and(eq(quotes.id, oldRow.id), eq(quotes.status, oldFrom)))
      .returning()
      .all() as QuoteRow[];
    if (oldUpdated.length === 0) {
      throw new Error("finaliseSupersedeOnSend: old row concurrent transition");
    }
    oldAfter = oldUpdated[0];

    const newUpdated = txDb
      .update(quotes)
      .set({
        status: "sent",
        sent_at_ms: now,
        thread_message_id: input.thread_message_id ?? null,
      })
      .where(and(eq(quotes.id, newDraft.id), eq(quotes.status, "draft")))
      .returning()
      .all() as QuoteRow[];
    if (newUpdated.length === 0) {
      throw new Error("finaliseSupersedeOnSend: new row concurrent transition");
    }
    newAfter = newUpdated[0];

    cancelPendingQuoteTasks(txDb, oldRow.id, now);
  });

  if (!newAfter || !oldAfter) {
    return { ok: false, error: "transaction_failed" };
  }
  const newFinal: QuoteRow = newAfter;
  const oldFinal: QuoteRow = oldAfter;

  await logActivity({
    companyId: newFinal.company_id,
    dealId: newFinal.deal_id,
    kind: "quote_superseded",
    body: `Quote ${oldFinal.quote_number} replaced by ${newFinal.quote_number}.`,
    meta: {
      old_quote_id: oldFinal.id,
      new_quote_id: newFinal.id,
      old_prior_status: oldFrom,
    },
  });

  return { ok: true, newQuote: newFinal, oldQuote: oldFinal };
}

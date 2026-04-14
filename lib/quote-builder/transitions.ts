import { eq, and } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { quotes, type QuoteStatus, type QuoteRow } from "@/lib/db/schema/quotes";

/**
 * Quote state machine per `docs/specs/quote-builder.md` §5.1.
 *
 * Terminal states: `accepted`, `superseded`, `withdrawn`, `expired`.
 * All mutations to `quotes.status` MUST pass through
 * `transitionQuoteStatus()`; direct UPDATE bypasses validation and is
 * a bug.
 */
const LEGAL_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["sent", "withdrawn"],
  sent: ["viewed", "accepted", "superseded", "withdrawn", "expired"],
  viewed: ["accepted", "superseded", "withdrawn", "expired"],
  accepted: [],
  superseded: [],
  withdrawn: [],
  expired: [],
};

export function canTransitionQuote(
  from: QuoteStatus,
  to: QuoteStatus,
): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export class IllegalQuoteTransitionError extends Error {
  constructor(
    public readonly from: QuoteStatus,
    public readonly to: QuoteStatus,
  ) {
    super(`illegal quote transition: ${from} → ${to}`);
    this.name = "IllegalQuoteTransitionError";
  }
}

/**
 * Validate a quote state transition. Throws `IllegalQuoteTransitionError`
 * if the move is not in the §5.1 matrix. Callers run the actual UPDATE
 * themselves (inside whatever transaction makes sense for their slice of
 * the flow).
 */
export function assertQuoteTransition(
  from: QuoteStatus,
  to: QuoteStatus,
): void {
  if (!canTransitionQuote(from, to)) {
    throw new IllegalQuoteTransitionError(from, to);
  }
}

export const QUOTE_TERMINAL_STATUSES: readonly QuoteStatus[] = [
  "accepted",
  "superseded",
  "withdrawn",
  "expired",
];

export function isTerminal(status: QuoteStatus): boolean {
  return QUOTE_TERMINAL_STATUSES.includes(status);
}

type DatabaseLike = typeof defaultDb;

export type QuoteTransitionPatch = Partial<
  Pick<
    QuoteRow,
    | "sent_at_ms"
    | "viewed_at_ms"
    | "accepted_at_ms"
    | "expires_at_ms"
    | "expired_at_ms"
    | "superseded_at_ms"
    | "withdrawn_at_ms"
    | "accepted_content_hash"
    | "accepted_ip"
    | "accepted_user_agent"
    | "thread_message_id"
    | "pdf_cache_key"
    | "stripe_payment_intent_id"
    | "stripe_subscription_id"
    | "supersedes_quote_id"
    | "superseded_by_quote_id"
    | "committed_until_date_ms"
  >
>;

/**
 * Atomically transition a quote's status.
 *
 * Validates the move against `LEGAL_TRANSITIONS`, then issues a single
 * UPDATE that **also** asserts the row is still in `from` (concurrency
 * guard against a sibling worker mutating between SELECT and UPDATE).
 * Optional `patch` lands timestamps and lifecycle fields in the same
 * statement so callers don't issue two writes.
 *
 * Returns the updated row. Throws `IllegalQuoteTransitionError` if the
 * transition is not legal, or `Error("quote not in expected state")` if
 * the concurrency guard rejects (caller should re-read and decide).
 */
export async function transitionQuoteStatus(
  input: {
    quote_id: string;
    from: QuoteStatus;
    to: QuoteStatus;
    patch?: QuoteTransitionPatch;
  },
  dbOverride?: DatabaseLike,
): Promise<QuoteRow> {
  assertQuoteTransition(input.from, input.to);
  const database = dbOverride ?? defaultDb;
  const updated = await database
    .update(quotes)
    .set({ status: input.to, ...(input.patch ?? {}) })
    .where(and(eq(quotes.id, input.quote_id), eq(quotes.status, input.from)))
    .returning();
  if (updated.length === 0) {
    throw new Error(
      `transitionQuoteStatus: quote ${input.quote_id} not in expected state ${input.from}`,
    );
  }
  return updated[0];
}

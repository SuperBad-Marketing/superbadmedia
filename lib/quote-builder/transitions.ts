import type { QuoteStatus } from "@/lib/db/schema/quotes";

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

import { describe, it, expect } from "vitest";
import {
  canTransitionQuote,
  assertQuoteTransition,
  IllegalQuoteTransitionError,
  isTerminal,
  QUOTE_TERMINAL_STATUSES,
} from "@/lib/quote-builder/transitions";
import { QUOTE_STATUSES } from "@/lib/db/schema/quotes";

describe("QB-1 — quote state machine", () => {
  it("allows every §5.1 legal transition", () => {
    const legal: [string, string][] = [
      ["draft", "sent"],
      ["draft", "withdrawn"],
      ["sent", "viewed"],
      ["sent", "accepted"],
      ["sent", "superseded"],
      ["sent", "withdrawn"],
      ["sent", "expired"],
      ["viewed", "accepted"],
      ["viewed", "superseded"],
      ["viewed", "withdrawn"],
      ["viewed", "expired"],
    ];
    for (const [from, to] of legal) {
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        canTransitionQuote(from as any, to as any),
      ).toBe(true);
    }
  });

  it("rejects draft → accepted (must go via sent)", () => {
    expect(canTransitionQuote("draft", "accepted")).toBe(false);
    expect(() => assertQuoteTransition("draft", "accepted")).toThrow(
      IllegalQuoteTransitionError,
    );
  });

  it("treats accepted/superseded/withdrawn/expired as terminal", () => {
    for (const s of QUOTE_TERMINAL_STATUSES) {
      expect(isTerminal(s)).toBe(true);
      // No onward transitions from a terminal state.
      for (const to of QUOTE_STATUSES) {
        expect(canTransitionQuote(s, to)).toBe(false);
      }
    }
  });

  it("non-terminal states: draft + sent + viewed", () => {
    expect(isTerminal("draft")).toBe(false);
    expect(isTerminal("sent")).toBe(false);
    expect(isTerminal("viewed")).toBe(false);
  });

  it("illegal error exposes from + to", () => {
    try {
      assertQuoteTransition("draft", "expired");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalQuoteTransitionError);
      const e = err as IllegalQuoteTransitionError;
      expect(e.from).toBe("draft");
      expect(e.to).toBe("expired");
    }
  });
});

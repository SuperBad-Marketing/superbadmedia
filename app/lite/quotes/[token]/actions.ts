"use server";

/**
 * Public quote-page actions. QB-4a ships the Accept stub only — the
 * full Payment Element + Stripe customer/subscription wiring lands in
 * QB-4c. The stub returns a structured "not yet" response so the
 * client can show a friendly message instead of a 500.
 */
export async function acceptQuoteAction(_input: {
  token: string;
  acceptedTermsVersionId: string | null;
}): Promise<{ ok: false; error: string }> {
  return {
    ok: false,
    error: "Accepting quotes online lands in the next session — for now, reply to Andy's email and he'll lock it in.",
  };
}

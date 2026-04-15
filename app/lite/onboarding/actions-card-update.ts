"use server";

/**
 * SB-9 — subscriber-initiated card update Server Action.
 *
 * Called from the past_due lockout hero on the onboarding dashboard.
 * Verifies the authed subscriber owns the deal, then creates a Stripe
 * SetupIntent scoped to their customer and returns the client secret
 * for the Payment Element to mount.
 *
 * The Payment Element handles the confirmation client-side; Stripe
 * automatically attaches the PaymentMethod to the customer. A follow-up
 * `attachDefaultPaymentMethodAction` flips it to the default so dunning
 * retries land on the fresh card.
 */
import { auth } from "@/lib/auth/session";
import { loadSubscriberSummary } from "@/lib/saas-products/subscriber-summary";
import {
  attachDefaultPaymentMethod,
  createSubscriberSetupIntent,
} from "@/lib/stripe/setup-intents";
import { killSwitches } from "@/lib/kill-switches";

export interface CreateSetupIntentActionResult {
  ok: boolean;
  clientSecret?: string;
  error?: string;
}

export async function createSetupIntentAction(): Promise<CreateSetupIntentActionResult> {
  if (!killSwitches.saas_payment_recovery_enabled) {
    return { ok: false, error: "payment_recovery_disabled" };
  }
  const session = await auth();
  if (!session?.user || session.user.role !== "client" || !session.user.email) {
    return { ok: false, error: "unauthorised" };
  }
  const summary = await loadSubscriberSummary(session.user.email);
  if (!summary || !summary.stripeCustomerId) {
    return { ok: false, error: "no_subscription" };
  }

  try {
    const intent = await createSubscriberSetupIntent({
      stripeCustomerId: summary.stripeCustomerId,
    });
    if (!intent.client_secret) {
      return { ok: false, error: "no_client_secret" };
    }
    return { ok: true, clientSecret: intent.client_secret };
  } catch (err) {
    return {
      ok: false,
      error: `stripe_error:${(err as Error)?.message ?? "unknown"}`,
    };
  }
}

export interface AttachDefaultPaymentMethodActionResult {
  ok: boolean;
  error?: string;
}

export async function attachDefaultPaymentMethodAction(
  paymentMethodId: string,
): Promise<AttachDefaultPaymentMethodActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "client" || !session.user.email) {
    return { ok: false, error: "unauthorised" };
  }
  const summary = await loadSubscriberSummary(session.user.email);
  if (!summary || !summary.stripeCustomerId) {
    return { ok: false, error: "no_subscription" };
  }
  try {
    await attachDefaultPaymentMethod({
      stripeCustomerId: summary.stripeCustomerId,
      paymentMethodId,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `stripe_error:${(err as Error)?.message ?? "unknown"}`,
    };
  }
}

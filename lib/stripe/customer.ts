/**
 * Stripe customer helper — idempotent create/lookup by contactId.
 *
 * `ensureStripeCustomer()` is the single-entry-point for creating or
 * recovering a Stripe customer for a given Lite contact. It uses
 * Stripe's customer search by `metadata.contact_id` to guarantee
 * idempotency even if the calling code retries.
 *
 * Does NOT require the `contacts` table to exist — designed to work
 * before the Sales Pipeline wave lands. When contacts table ships (SP-1),
 * callers should also persist the returned customer ID on the contact row.
 *
 * Owner: A7. Consumer: Quote Builder (QB-3), SaaS billing (Wave 5+).
 */
import { getStripe } from "@/lib/stripe/client";
import type { ContactId } from "@/lib/types/glossary";

export interface EnsureStripeCustomerResult {
  customerId: string;
  created: boolean;
}

/**
 * Return the Stripe customer ID for `contactId`, creating one if it
 * doesn't exist. Calling this twice with the same `contactId` returns
 * the same customer ID.
 *
 * @param contactId - Branded ContactId from `lib/types/glossary.ts`
 * @returns `{ customerId, created }` — `created` is false if found
 */
export async function ensureStripeCustomer(
  contactId: ContactId | string,
): Promise<EnsureStripeCustomerResult> {
  const id = String(contactId);

  // Search for existing customer by metadata
  const stripe = getStripe();
  const existing = await stripe.customers.search({
    query: `metadata['contact_id']:'${id}'`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return { customerId: existing.data[0].id, created: false };
  }

  const customer = await stripe.customers.create({
    metadata: {
      contact_id: id,
      platform: "superbad-lite",
    },
  });

  return { customerId: customer.id, created: true };
}

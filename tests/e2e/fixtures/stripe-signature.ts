/**
 * Generate a Stripe webhook signature matching the dev-server's
 * `STRIPE_WEBHOOK_SECRET`. Mirrors Stripe's `v1` scheme exactly so the
 * route's `constructEvent` verifies without stubs:
 *
 *     header = `t=<unix-seconds>,v1=<hmac-sha256>`
 *     hmac-sha256 is computed over `${timestamp}.${raw-body}`.
 *
 * Inlined rather than going through `stripe.webhooks.generateTestHeaderString`
 * because the SDK's public type for that method requires fields the runtime
 * supplies defaults for (scheme/timestamp/cryptoProvider), so calling it
 * cleanly from TypeScript needs an awkward cast. A 4-line HMAC is clearer
 * and matches what Stripe sends on the wire.
 *
 * Owner: SW-5c.
 */
import { createHmac } from "node:crypto";
import { E2E_CONSTANTS } from "../../../playwright.config";

export function buildSignedWebhook(
  eventType = "customer.created",
  dataObject: Record<string, unknown> = { id: "cus_e2e_placeholder" },
): {
  body: string;
  signature: string;
  eventId: string;
} {
  const eventId = `evt_e2e_${Math.random().toString(36).slice(2, 10)}`;
  const payload = {
    id: eventId,
    object: "event",
    type: eventType,
    data: { object: dataObject },
  };
  const body = JSON.stringify(payload);

  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${body}`;
  const hmac = createHmac("sha256", E2E_CONSTANTS.STRIPE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  const signature = `t=${timestamp},v1=${hmac}`;

  return { body, signature, eventId };
}

/**
 * `stripe-admin` vendor manifest — seed for the first critical-flight wizard.
 *
 * SDK import is type-only (no runtime calls here — SW-5 owns the wizard
 * steps that actually hit Stripe). This file is the Observatory contract
 * surface: the declared jobs are what Stripe calls get band-tracked as,
 * and the kill-switch key is the safety-net flip.
 *
 * Owner: SW-3. Consumer: SW-5 (stripe-admin wizard definition).
 */
import type Stripe from "stripe";
import type { VendorManifest } from "@/lib/wizards/types";

export const stripeManifest: VendorManifest = {
  vendorKey: "stripe-admin",
  jobs: [
    {
      name: "stripe.customer.create",
      defaultBand: { p95: 500, p99: 1200 },
      unit: "ms",
    },
    {
      name: "stripe.invoice.create",
      defaultBand: { p95: 800, p99: 2000 },
      unit: "ms",
    },
    {
      name: "stripe.webhook.receive",
      defaultBand: { p95: 150, p99: 400 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Stripe admin integration — customer, invoice, and webhook pipeline.",
};

export type { Stripe };

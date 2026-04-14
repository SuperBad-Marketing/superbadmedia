/**
 * `resend` vendor manifest — second critical-flight wizard (SW-6).
 *
 * Mirrors `stripe.ts` shape. Resend has no handshake probe at provisioning
 * time (unlike Stripe's webhook round-trip) so the job set focuses on the
 * outbound send path — `resend.email.send` is the only band the wizard
 * registers. The first real transactional send is the later proof; the
 * wizard's completionContract pings `apiKeys.list()` instead as the
 * cheapest authenticated identity check.
 *
 * Owner: SW-6. Consumer: `lib/wizards/defs/resend.ts`.
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const resendManifest: VendorManifest = {
  vendorKey: "resend",
  jobs: [
    {
      name: "resend.email.send",
      defaultBand: { p95: 600, p99: 1500 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Resend transactional email — outbound send pipeline.",
};

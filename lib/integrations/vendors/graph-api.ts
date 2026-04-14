/**
 * `graph-api` vendor manifest — third critical-flight wizard (SW-7).
 *
 * Microsoft Graph covers outbound mail send + calendar read for the admin.
 * Unlike Stripe, Graph has no provisioning-time webhook handshake, so the
 * wizard's proof-of-connection is a live identity ping (`GET /me`) inside
 * `completionContract.verify` — the minimum scope every access token can
 * read.
 *
 * Job set is intentionally narrow (send + read) — the bands the Observatory
 * tracks. The broader Graph surface will expand as features consume more
 * of it; new jobs register via a band-additions patch, not a manifest rewrite.
 *
 * Owner: SW-7. Consumer: `lib/wizards/defs/graph-api-admin.ts`.
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const graphApiManifest: VendorManifest = {
  vendorKey: "graph-api",
  jobs: [
    {
      name: "graph.mail.send",
      defaultBand: { p95: 900, p99: 2200 },
      unit: "ms",
    },
    {
      name: "graph.calendar.read",
      defaultBand: { p95: 500, p99: 1500 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Microsoft Graph — admin mail send + calendar read pipeline.",
};

/**
 * OAuth scopes the wizard requests. Design-time constant, not an autonomy
 * threshold — lives here rather than in settings.
 */
export const GRAPH_OAUTH_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Send",
  "Calendars.Read",
];

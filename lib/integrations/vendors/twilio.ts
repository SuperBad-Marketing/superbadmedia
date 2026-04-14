/**
 * `twilio` vendor manifest — fourth non-critical admin integration (SW-12).
 *
 * Twilio doesn't use OAuth — admins paste an Account SID + Auth Token pair
 * straight from the Twilio console. The wizard verifies by hitting
 * `GET /2010-04-01/Accounts/<SID>.json` with HTTP Basic auth, the cheapest
 * authenticated check that also proves the account exists + is reachable.
 *
 * Kill-switch shares `setup_wizards_enabled` with the rest of the wizard
 * family — nothing Twilio-specific to disable independently.
 *
 * Owner: SW-12. Consumer: `lib/wizards/defs/twilio.ts`.
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const twilioManifest: VendorManifest = {
  vendorKey: "twilio",
  jobs: [
    {
      name: "twilio.account.read",
      defaultBand: { p95: 600, p99: 1800 },
      unit: "ms",
    },
    {
      name: "twilio.message.send",
      defaultBand: { p95: 900, p99: 2400 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Twilio — SMS + WhatsApp channel. Admin pastes Account SID + Auth Token (no OAuth).",
};

/**
 * Twilio REST API base. Design-time constant; not an autonomy threshold.
 * The account-read verify hits `${TWILIO_API_BASE}/Accounts/<SID>.json`.
 */
export const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

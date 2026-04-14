/**
 * `twilio` — fourth non-critical admin integration wizard (SW-12).
 *
 * Twilio is the first wizard since `pixieset-admin` using the form-step
 * shape (paste → review → celebration), and the first wizard storing a
 * *multi-field* credential — Account SID + Auth Token travel together.
 *
 * `completionContract.verify` pings `GET /Accounts/<SID>.json` with HTTP
 * Basic auth (`SID:authToken`). Twilio's minimum authenticated check;
 * also confirms the account SID exists + the token grants access.
 *
 * Credential blob is handed to `registerIntegration()` as a JSON string
 * (`credentials.plaintext` is typed `string`). Consumer feature sessions
 * parse it back into `{ accountSid, authToken }`.
 *
 * `capstone` is undefined — Twilio is non-critical, not part of the
 * first-run flight capstone arc.
 *
 * Owner: SW-12. Consumer: /lite/setup/admin/[key].
 */
import { z } from "zod";
import { twilioManifest, TWILIO_API_BASE } from "@/lib/integrations/vendors/twilio";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type TwilioPayload = {
  accountSid: string;
  authToken: string;
  verifiedAt: number;
  confirmedAt: number;
};

/**
 * Twilio's documented credential shapes:
 *   Account SID  — starts `AC`, followed by 32 hex chars (34 total).
 *   Auth Token   — 32 hex chars.
 * Exported so the per-wizard client can reuse the same validation.
 */
export const twilioCredentialsSchema = z.object({
  accountSid: z
    .string()
    .trim()
    .regex(
      /^AC[a-f0-9]{32}$/i,
      "Account SID starts with AC and is 34 characters.",
    ),
  authToken: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32}$/i, "Auth Token is 32 hex characters."),
});

export function maskTwilioSid(sid: string): string {
  return sid.length >= 6 ? `${sid.slice(0, 4)}…${sid.slice(-4)}` : sid;
}

export function maskTwilioToken(token: string): string {
  return token.length >= 4 ? `…${token.slice(-4)}` : token;
}

async function pingTwilioAccount(
  accountSid: string,
  authToken: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const url = `${TWILIO_API_BASE}/Accounts/${accountSid}.json`;
    const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${basic}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const snippet = body.slice(0, 140);
      return {
        ok: false,
        reason: `Twilio rejected those credentials: ${res.status} ${snippet || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Twilio ping failed: ${err.message}`
          : "Twilio ping failed.",
    };
  }
}

export const twilioWizard: WizardDefinition<TwilioPayload> = {
  key: "twilio",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-credentials",
      type: "form",
      label: "Paste credentials",
      resumable: true,
      config: { schema: twilioCredentialsSchema },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { ctaLabel: "Looks right — finish" },
    },
    {
      key: "celebrate",
      type: "celebration",
      label: "Done",
      resumable: false,
    },
  ],
  completionContract: {
    required: ["accountSid", "authToken", "verifiedAt", "confirmedAt"],
    verify: async (p) => pingTwilioAccount(p.accountSid, p.authToken),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: twilioManifest,
  voiceTreatment: {
    introCopy:
      "Twilio's a paste job — Account SID and Auth Token from the console. We'll ping the account so we know it's live.",
    outroCopy: "Twilio's on file. SMS and WhatsApp channels can send from here.",
    tabTitlePool: {
      setup: ["Setup — Twilio"],
      connecting: ["Saving Twilio…"],
      confirming: ["Confirming Twilio…"],
      connected: ["Twilio saved."],
      stuck: ["Twilio — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(twilioWizard);

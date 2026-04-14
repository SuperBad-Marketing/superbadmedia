"use server";

/**
 * Server Actions for the `twilio` wizard.
 *
 * Celebration orchestrator only. No `testTwilioAction` counterpart — the
 * live `GET /Accounts/<SID>.json` Basic-auth ping runs inside the wizard's
 * `completionContract.verify`, called from `verifyCompletion` after
 * `registerIntegration` has written the row.
 *
 * Credential blob shape: `{ accountSid, authToken }` — JSON.stringified
 * before handing off because `registerIntegration` credentials.plaintext
 * is typed `string`. Consumer feature sessions parse it back out.
 *
 * Rolls back (no partial rows) on any failure.
 *
 * Owner: SW-12. Mirrors `actions-pixieset.ts` + JSON-stringified blob.
 */
import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  twilioWizard,
  type TwilioPayload,
} from "@/lib/wizards/defs/twilio";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

function contractVersion(): string {
  const keys = twilioWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: twilioWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeTwilioAction(
  payload: TwilioPayload,
): Promise<CelebrationCompleteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired — sign in again." };
  }
  const ownerId = session.user.id;
  const ctx = { ownerType: "admin" as const, ownerId };

  const wizardCompletionId = randomUUID();

  try {
    const credentialBlob = JSON.stringify({
      accountSid: payload.accountSid,
      authToken: payload.authToken,
    });

    const { bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: twilioWizard.vendorManifest!,
      credentials: { plaintext: credentialBlob },
      metadata: {
        account_sid: payload.accountSid,
      },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(twilioWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: twilioWizard.key,
      user_id: ownerId,
      audience: "admin",
      completion_payload: payload,
      contract_version: contractVersion(),
      completed_at_ms: Date.now(),
    });

    return {
      ok: true,
      observatorySummary: `Bands registered: ${bandsRegistered.join(", ")}.`,
    };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? err.message
          : "Something went sideways finishing up.",
    };
  }
}

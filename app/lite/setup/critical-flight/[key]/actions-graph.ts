"use server";

/**
 * Server Actions for the `graph-api-admin` critical-flight wizard.
 *
 * One action:
 *   - `completeGraphAdminAction(payload)` — celebration onComplete
 *     orchestrator. Runs registerIntegration → verifyCompletion →
 *     wizard_completions insert → `unstable_update()` to refresh the JWT's
 *     `critical_flight_complete` claim. Mirrors stripe-admin / resend
 *     actions minus the api-key-test counterpart (graph-api uses
 *     oauth-consent; the token arrives via the callback route, not a paste).
 *
 * Owner: SW-7.
 */
import { randomUUID, createHash } from "node:crypto";
import { auth, unstable_update } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  graphApiAdminWizard,
  type GraphAdminPayload,
} from "@/lib/wizards/defs/graph-api-admin";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

function contractVersion(): string {
  const keys = graphApiAdminWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(
      JSON.stringify({ key: graphApiAdminWizard.key, required: keys }),
    )
    .digest("hex")
    .slice(0, 16);
}

export async function completeGraphAdminAction(
  payload: GraphAdminPayload,
): Promise<CelebrationCompleteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired — sign in again." };
  }
  const ownerId = session.user.id;
  const ctx = { ownerType: "admin" as const, ownerId };

  const wizardCompletionId = randomUUID();

  try {
    const { bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: graphApiAdminWizard.vendorManifest!,
      credentials: { plaintext: payload.accessToken },
      metadata: {
        verified_at_ms: payload.verifiedAt,
      },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(
      graphApiAdminWizard,
      payload,
      ctx,
    );
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: graphApiAdminWizard.key,
      user_id: ownerId,
      audience: "admin",
      completion_payload: payload,
      contract_version: contractVersion(),
      completed_at_ms: Date.now(),
    });

    await unstable_update({});

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

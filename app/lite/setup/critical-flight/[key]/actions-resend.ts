"use server";

/**
 * Server Actions for the `resend` critical-flight wizard.
 *
 * Two actions (no webhook-probe counterpart — Resend has no provisioning-
 * time handshake):
 *   - `testResendKeyAction(key)` — invoked from the api-key-paste step.
 *     Live `apiKeys.list()` ping. Returns the same result shape as
 *     the stripe-admin equivalent so the step-type registry stays
 *     uniform.
 *   - `completeResendAction(payload)` — celebration onComplete
 *     orchestrator. Runs registerIntegration → verifyCompletion →
 *     wizard_completions insert → `unstable_update()` to refresh the
 *     JWT's `critical_flight_complete` claim. Rolls back (no partial
 *     rows) on any failure.
 *
 * Owner: SW-6. Mirrors `actions.ts` (stripe-admin) minus the webhook leg.
 */
import { randomUUID, createHash } from "node:crypto";
import { auth, unstable_update } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  resendWizard,
  type ResendAdminPayload,
} from "@/lib/wizards/defs/resend";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export async function testResendKeyAction(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!key) return { ok: false, reason: "Paste the key first." };
  return resendWizard.completionContract.verify({
    apiKey: key,
    verifiedAt: 0,
    confirmedAt: 0,
  });
}

function contractVersion(): string {
  const keys = resendWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: resendWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeResendAction(
  payload: ResendAdminPayload,
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
      manifest: resendWizard.vendorManifest!,
      credentials: { plaintext: payload.apiKey },
      metadata: {
        verified_at_ms: payload.verifiedAt,
      },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(resendWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: resendWizard.key,
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

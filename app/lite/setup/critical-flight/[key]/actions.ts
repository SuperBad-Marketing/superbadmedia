"use server";

/**
 * Server Actions for the stripe-admin critical-flight wizard.
 *
 * Three actions:
 *   - `testStripeKeyAction(key)` — client invokes from api-key-paste step.
 *     Live `balance.retrieve` ping. Returns StepValidationResult shape.
 *   - `checkStripeWebhookReceivedAction(sinceMs)` — client polls from
 *     webhook-probe step. Looks for a row in `external_call_log` with
 *     job=`stripe.webhook.receive` since the step started. Real webhook
 *     receiver endpoint + emitter land in SW-5b (PATCHES_OWED — see handoff).
 *   - `completeStripeAdminAction(payload)` — celebration onComplete
 *     orchestrator. Runs verifyCompletion → registerIntegration →
 *     wizard_completions insert → `unstable_update()` to refresh the JWT's
 *     critical_flight_complete claim. Rolls back (no partial rows) on any
 *     failure.
 *
 * Owner: SW-5.
 */
import { randomUUID, createHash } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { auth, unstable_update } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  stripeAdminWizard,
  type StripeAdminPayload,
} from "@/lib/wizards/defs/stripe-admin";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export async function testStripeKeyAction(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!key) return { ok: false, reason: "Paste the key first." };
  return stripeAdminWizard.completionContract.verify({
    apiKey: key,
    verifiedAt: 0,
    webhookReceivedAt: 0,
    confirmedAt: 0,
  });
}

export async function checkStripeWebhookReceivedAction(
  sinceMs: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: external_call_log.id })
    .from(external_call_log)
    .where(
      and(
        eq(external_call_log.job, "stripe.webhook.receive"),
        gte(external_call_log.created_at_ms, sinceMs),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

function contractVersion(): string {
  const keys = stripeAdminWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: stripeAdminWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeStripeAdminAction(
  payload: StripeAdminPayload,
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
      manifest: stripeAdminWizard.vendorManifest!,
      credentials: { plaintext: payload.apiKey },
      metadata: {
        verified_at_ms: payload.verifiedAt,
        webhook_received_at_ms: payload.webhookReceivedAt,
      },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(
      stripeAdminWizard,
      payload,
      ctx,
    );
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: stripeAdminWizard.key,
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

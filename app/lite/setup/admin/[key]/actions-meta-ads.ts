"use server";

/**
 * Server Actions for the `meta-ads` wizard.
 *
 * One action — the celebration orchestrator. Mirrors `actions-graph.ts`
 * minus the `unstable_update()` call (non-critical wizards don't gate the
 * JWT's `critical_flight_complete` claim — SW-9 established the pattern
 * for the admin tree).
 *
 * Runs registerIntegration → verifyCompletion → wizard_completions insert.
 * Rolls back (no partial rows) on any failure.
 *
 * Owner: SW-10.
 */
import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  metaAdsWizard,
  type MetaAdsPayload,
} from "@/lib/wizards/defs/meta-ads";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

function contractVersion(): string {
  const keys = metaAdsWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: metaAdsWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeMetaAdsAction(
  payload: MetaAdsPayload,
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
      manifest: metaAdsWizard.vendorManifest!,
      credentials: { plaintext: payload.accessToken },
      metadata: {
        verified_at_ms: payload.verifiedAt,
      },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(metaAdsWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: metaAdsWizard.key,
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

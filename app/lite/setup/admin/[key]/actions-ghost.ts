"use server";

import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  ghostWizard,
  type GhostPayload,
} from "@/lib/wizards/defs/ghost";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

function contractVersion(): string {
  const keys = ghostWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: ghostWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeGhostAction(
  payload: GhostPayload,
): Promise<CelebrationCompleteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired, sign in again." };
  }
  const ownerId = session.user.id;
  const ctx = { ownerType: "admin" as const, ownerId };
  const wizardCompletionId = randomUUID();

  try {
    const credentialBlob = JSON.stringify({
      adminApiKey: payload.adminApiKey,
      adminUrl: payload.adminUrl,
    });

    const { bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: ghostWizard.vendorManifest!,
      credentials: { plaintext: credentialBlob },
      metadata: { admin_url: payload.adminUrl },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(ghostWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: ghostWizard.key,
      user_id: ownerId,
      audience: "admin",
      completion_payload: payload,
      contract_version: contractVersion(),
      completed_at_ms: Date.now(),
    });

    return {
      ok: true,
      observatorySummary: bandsRegistered.length
        ? `Bands registered: ${bandsRegistered.join(", ")}.`
        : "Ghost connected.",
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

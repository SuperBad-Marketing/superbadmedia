"use server";

import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  linkedinArticlesWizard,
  type LinkedinArticlesPayload,
} from "@/lib/wizards/defs/linkedin-articles";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

function contractVersion(): string {
  const keys = linkedinArticlesWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: linkedinArticlesWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeLinkedinArticlesAction(
  payload: LinkedinArticlesPayload,
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
      accessToken: payload.accessToken,
      authorUrn: payload.authorUrn,
    });

    const { bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: linkedinArticlesWizard.vendorManifest!,
      credentials: { plaintext: credentialBlob },
      metadata: { author_urn: payload.authorUrn },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(linkedinArticlesWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: linkedinArticlesWizard.key,
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
        : "LinkedIn Articles connected.",
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

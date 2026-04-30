"use server";

import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  wordpressWizard,
  type WordPressPayload,
} from "@/lib/wizards/defs/wordpress";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

function contractVersion(): string {
  const keys = wordpressWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: wordpressWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeWordPressAction(
  payload: WordPressPayload,
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
      siteId: payload.siteId,
    });

    const { bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: wordpressWizard.vendorManifest!,
      credentials: { plaintext: credentialBlob },
      metadata: { site_id: payload.siteId },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(wordpressWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: wordpressWizard.key,
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
        : "WordPress connected.",
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

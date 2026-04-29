"use server";

import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import {
  cloudinaryWizard,
  type CloudinaryPayload,
} from "@/lib/wizards/defs/cloudinary";
import { testConnection } from "@/lib/cloudinary";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

function contractVersion(): string {
  const keys = cloudinaryWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: cloudinaryWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeCloudinaryAction(
  payload: CloudinaryPayload,
): Promise<CelebrationCompleteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired, sign in again." };
  }
  const ownerId = session.user.id;

  const wizardCompletionId = randomUUID();

  try {
    const ping = await testConnection(
      payload.cloudName,
      payload.apiKey,
      payload.apiSecret,
    );
    if (!ping.ok) {
      return { ok: false, reason: ping.reason };
    }

    const { bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: cloudinaryWizard.vendorManifest!,
      credentials: {
        plaintext: JSON.stringify({
          cloudName: payload.cloudName,
          apiKey: payload.apiKey,
          apiSecret: payload.apiSecret,
        }),
      },
      metadata: {
        cloud_name: payload.cloudName,
      },
      ownerType: "admin",
      ownerId,
    });

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: cloudinaryWizard.key,
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

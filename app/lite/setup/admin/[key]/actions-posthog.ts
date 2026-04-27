"use server";

import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  posthogWizard,
  verifyPosthogKey,
} from "@/lib/wizards/defs/posthog";
import type { PosthogPayload } from "@/lib/wizards/defs/posthog-schema";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export async function testPosthogKeyAction(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!key) return { ok: false, reason: "Paste the key first." };
  return verifyPosthogKey(key);
}

function contractVersion(): string {
  const keys = posthogWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: posthogWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completePosthogAction(
  payload: PosthogPayload,
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
      manifest: posthogWizard.vendorManifest!,
      credentials: { plaintext: payload.apiKey },
      metadata: {
        posthog_host: payload.posthogHost || "https://us.i.posthog.com",
        verified_at_ms: payload.verifiedAt,
      },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(posthogWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: posthogWizard.key,
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
        : "PostHog connected.",
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

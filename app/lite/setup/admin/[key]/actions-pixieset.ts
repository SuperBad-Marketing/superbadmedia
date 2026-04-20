"use server";

/**
 * Server Actions for the `pixieset-admin` wizard.
 *
 * One action — the celebration orchestrator. Pixieset has no provisioning-
 * time handshake and no live API to test, so there's no `testPixiesetAction`
 * counterpart; validation happens at the Zod layer in the form step.
 *
 * `completePixiesetAction` runs registerIntegration → verifyCompletion →
 * wizard_completions insert. Rolls back (no partial rows) on any failure.
 *
 * Owner: SW-9. Mirrors `actions-resend.ts` minus the key-test leg.
 */
import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  pixiesetAdminWizard,
  type PixiesetAdminPayload,
} from "@/lib/wizards/defs/pixieset-admin";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

function contractVersion(): string {
  const keys = pixiesetAdminWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: pixiesetAdminWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completePixiesetAction(
  payload: PixiesetAdminPayload,
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
      manifest: pixiesetAdminWizard.vendorManifest!,
      credentials: { plaintext: payload.galleryUrl },
      metadata: {
        slug: payload.slug,
        gallery_url: payload.galleryUrl,
      },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(
      pixiesetAdminWizard,
      payload,
      ctx,
    );
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: pixiesetAdminWizard.key,
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

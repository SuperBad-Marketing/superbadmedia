"use server";

/**
 * Server Actions for the generic `api-key` wizard (SW-13).
 *
 * Two actions:
 *   - `testApiKeyAction(vendor, key)` — invoked from the api-key-paste
 *     step. Dispatches to the selected vendor profile's live verify-ping.
 *   - `completeApiKeyAction(payload)` — celebration onComplete
 *     orchestrator. Runs registerIntegration (using the per-vendor
 *     manifest selected from payload.vendor) → verifyCompletion →
 *     wizard_completions insert. Rolls back (no partial rows) on any
 *     failure.
 *
 * Each vendor writes its own `integration_connections` row with its own
 * `vendor_key` — not a shared "api-key" key. Feature sessions look up
 * credentials by vendor_key via `integration_connections`.
 *
 * Owner: SW-13. Mirrors `actions-resend.ts` + vendor dispatch.
 */
import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  apiKeyWizard,
  getApiKeyVendorProfile,
  isApiKeyVendor,
  type ApiKeyPayload,
  type ApiKeyVendor,
} from "@/lib/wizards/defs/api-key";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export async function testApiKeyAction(
  vendor: ApiKeyVendor,
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isApiKeyVendor(vendor)) {
    return { ok: false, reason: `Unknown vendor: ${String(vendor)}` };
  }
  if (!key) return { ok: false, reason: "Paste the key first." };
  return getApiKeyVendorProfile(vendor).verify(key);
}

function contractVersion(): string {
  const keys = apiKeyWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: apiKeyWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeApiKeyAction(
  payload: ApiKeyPayload,
): Promise<CelebrationCompleteResult> {
  if (!isApiKeyVendor(payload.vendor)) {
    return { ok: false, reason: `Unknown vendor: ${String(payload.vendor)}` };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired — sign in again." };
  }
  const ownerId = session.user.id;
  const ctx = { ownerType: "admin" as const, ownerId };
  const profile = getApiKeyVendorProfile(payload.vendor);

  const wizardCompletionId = randomUUID();

  try {
    const { bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: profile.manifest,
      credentials: { plaintext: payload.apiKey },
      metadata: {
        vendor: payload.vendor,
        verified_at_ms: payload.verifiedAt,
      },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(apiKeyWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: apiKeyWizard.key,
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

"use server";

import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { vault } from "@/lib/crypto/vault";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  spotifyWizard,
  type SpotifyPayload,
} from "@/lib/wizards/defs/spotify";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

const SPOTIFY_VAULT_CONTEXT = "spotify.credentials";

export async function decryptSpotifyTokenAction(
  ct: string,
): Promise<
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: string }
> {
  try {
    const decrypted = vault.decrypt(ct, SPOTIFY_VAULT_CONTEXT);
    const creds = JSON.parse(decrypted) as {
      accessToken: string;
      refreshToken: string;
    };
    return { ok: true, accessToken: creds.accessToken, refreshToken: creds.refreshToken };
  } catch {
    return { ok: false, reason: "Failed to decrypt Spotify OAuth token." };
  }
}

function contractVersion(): string {
  const keys = spotifyWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: spotifyWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeSpotifyAction(
  payload: SpotifyPayload,
): Promise<CelebrationCompleteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired, sign in again." };
  }
  const ownerId = session.user.id;
  const ctx = { ownerType: "admin" as const, ownerId };

  const wizardCompletionId = randomUUID();

  try {
    const { bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: spotifyWizard.vendorManifest!,
      credentials: {
        plaintext: JSON.stringify({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        }),
      },
      metadata: { verified_at_ms: payload.verifiedAt },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(spotifyWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: spotifyWizard.key,
      user_id: ownerId,
      audience: "admin",
      completion_payload: payload,
      contract_version: contractVersion(),
      completed_at_ms: Date.now(),
    });

    return {
      ok: true,
      observatorySummary: `Bands registered: ${bandsRegistered.join(", ")}. Spotify connected.`,
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

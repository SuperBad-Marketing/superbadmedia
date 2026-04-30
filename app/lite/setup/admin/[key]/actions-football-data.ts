"use server";

import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  footballDataWizard,
  type FootballDataPayload,
} from "@/lib/wizards/defs/football-data";
import { FOOTBALL_DATA_API_BASE } from "@/lib/integrations/vendors/football-data";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export async function testFootballDataKeyAction(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!key) return { ok: false, reason: "Paste the key first." };
  try {
    const res = await fetch(`${FOOTBALL_DATA_API_BASE}/competitions/PL`, {
      headers: { "X-Auth-Token": key },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Football-Data.org rejected that key: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Football-Data.org ping failed: ${err.message}`
          : "Football-Data.org ping failed.",
    };
  }
}

function contractVersion(): string {
  const keys = footballDataWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: footballDataWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeFootballDataAction(
  payload: FootballDataPayload,
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
      manifest: footballDataWizard.vendorManifest!,
      credentials: { plaintext: payload.apiKey },
      metadata: { verified_at_ms: payload.verifiedAt },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(footballDataWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: footballDataWizard.key,
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
        : "Football-Data.org connected.",
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

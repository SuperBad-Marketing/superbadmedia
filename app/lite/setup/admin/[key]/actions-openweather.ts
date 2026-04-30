"use server";

import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  openweatherWizard,
  type OpenWeatherPayload,
} from "@/lib/wizards/defs/openweather";
import { OPENWEATHER_API_BASE } from "@/lib/integrations/vendors/openweather";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export async function testOpenWeatherKeyAction(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!key) return { ok: false, reason: "Paste the key first." };
  try {
    const res = await fetch(
      `${OPENWEATHER_API_BASE}/onecall?lat=-37.81&lon=144.96&exclude=minutely,hourly,daily,alerts&appid=${key}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `OpenWeather rejected that key: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `OpenWeather ping failed: ${err.message}`
          : "OpenWeather ping failed.",
    };
  }
}

function contractVersion(): string {
  const keys = openweatherWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: openweatherWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

export async function completeOpenWeatherAction(
  payload: OpenWeatherPayload,
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
      manifest: openweatherWizard.vendorManifest!,
      credentials: { plaintext: payload.apiKey },
      metadata: { verified_at_ms: payload.verifiedAt },
      ownerType: "admin",
      ownerId,
    });

    const verified = await verifyCompletion(openweatherWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: openweatherWizard.key,
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
        : "OpenWeather connected.",
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

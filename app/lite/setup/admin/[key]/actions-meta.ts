"use server";

/**
 * Server Actions for the `meta` wizard.
 *
 * Celebration orchestrator: registerIntegration → discover Instagram
 * Business Account → create instagram_accounts row → wizard_completions
 * insert. Rolls back on any failure.
 *
 * Owner: SW-10. Extended by Instagram channel session.
 */
import { randomUUID, createHash } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { vault } from "@/lib/crypto/vault";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { instagram_accounts } from "@/lib/db/schema/instagram";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import {
  metaWizard,
  type MetaPayload,
} from "@/lib/wizards/defs/meta";
import { getPages, getInstagramAccountFromPage, getAccountInfo } from "@/lib/channels/instagram/client";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

const META_VAULT_CONTEXT = "meta.credentials";

export async function decryptMetaTokenAction(
  ct: string,
): Promise<{ ok: true; accessToken: string } | { ok: false; reason: string }> {
  try {
    const decrypted = vault.decrypt(ct, META_VAULT_CONTEXT);
    const creds = JSON.parse(decrypted) as { accessToken: string };
    return { ok: true, accessToken: creds.accessToken };
  } catch {
    return { ok: false, reason: "Failed to decrypt OAuth token." };
  }
}

function contractVersion(): string {
  const keys = metaWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ key: metaWizard.key, required: keys }))
    .digest("hex")
    .slice(0, 16);
}

async function discoverInstagramAccount(
  accessToken: string,
): Promise<
  | { ok: true; igUserId: string; username: string; pageAccessToken: string }
  | { ok: false; reason: string }
> {
  const pagesResult = await getPages(accessToken);
  if (!pagesResult.ok) {
    return { ok: false, reason: `Could not list Facebook Pages: ${pagesResult.error}` };
  }
  if (pagesResult.data.data.length === 0) {
    return { ok: false, reason: "No Facebook Pages found. Instagram Business accounts require a linked Facebook Page." };
  }

  for (const page of pagesResult.data.data) {
    const igResult = await getInstagramAccountFromPage(page.id, accessToken);
    if (!igResult.ok) continue;
    const igBizAccount = igResult.data?.instagram_business_account;
    if (!igBizAccount?.id) continue;

    const infoResult = await getAccountInfo(igBizAccount.id, page.access_token);
    if (!infoResult.ok) continue;

    return {
      ok: true,
      igUserId: igBizAccount.id,
      username: infoResult.data.username,
      pageAccessToken: page.access_token,
    };
  }

  return {
    ok: false,
    reason: "No Instagram Business Account found linked to your Facebook Pages. Connect one in Meta Business Suite first.",
  };
}

export async function completeMetaAction(
  payload: MetaPayload,
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
      manifest: metaWizard.vendorManifest!,
      credentials: { plaintext: payload.accessToken },
      metadata: {
        verified_at_ms: payload.verifiedAt,
      },
      ownerType: "admin",
      ownerId,
    });

    const igDiscovery = await discoverInstagramAccount(payload.accessToken);
    let igSummary = "";

    if (igDiscovery.ok) {
      const existing = await db.query.instagram_accounts.findFirst({
        where: (t, { eq }) => eq(t.instagram_user_id, igDiscovery.igUserId),
      });

      if (existing) {
        await db
          .update(instagram_accounts)
          .set({
            access_token: igDiscovery.pageAccessToken,
            token_expires_at_ms: Date.now() + 60 * 86400 * 1000,
            status: "active",
          })
          .where(
            (await import("drizzle-orm")).eq(
              instagram_accounts.id,
              existing.id,
            ),
          );
        igSummary = `Instagram @${igDiscovery.username} reconnected.`;
      } else {
        await db.insert(instagram_accounts).values({
          id: randomUUID(),
          instagram_user_id: igDiscovery.igUserId,
          username: igDiscovery.username,
          account_type: "own",
          access_token: igDiscovery.pageAccessToken,
          token_expires_at_ms: Date.now() + 60 * 86400 * 1000,
          connected_at_ms: Date.now(),
          status: "active",
        });
        igSummary = `Instagram @${igDiscovery.username} connected.`;
      }
    } else {
      igSummary = `Instagram: ${igDiscovery.reason}`;
    }

    const verified = await verifyCompletion(metaWizard, payload, ctx);
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: metaWizard.key,
      user_id: ownerId,
      audience: "admin",
      completion_payload: payload,
      contract_version: contractVersion(),
      completed_at_ms: Date.now(),
    });

    const refreshAtMs = Date.now() + 50 * 86400 * 1000;
    await enqueueTask({
      task_type: "instagram_token_refresh",
      runAt: refreshAtMs,
      idempotencyKey: `ig-token-refresh-${new Date(refreshAtMs).toISOString().slice(0, 10)}`,
    });

    return {
      ok: true,
      observatorySummary: `Bands registered: ${bandsRegistered.join(", ")}. ${igSummary}`,
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

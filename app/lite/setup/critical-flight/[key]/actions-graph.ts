"use server";

/**
 * Server Actions for the `graph-api-admin` critical-flight wizard.
 *
 * One action:
 *   - `completeGraphAdminAction(payload)` — celebration onComplete
 *     orchestrator. Runs registerIntegration → verifyCompletion →
 *     wizard_completions insert → `unstable_update()` to refresh the JWT's
 *     `critical_flight_complete` claim. Mirrors stripe-admin / resend
 *     actions minus the api-key-test counterpart (graph-api uses
 *     oauth-consent; the token arrives via the callback route, not a paste).
 *
 * Owner: SW-7.
 */
import { randomUUID, createHash } from "node:crypto";
import { auth, unstable_update } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { vault } from "@/lib/crypto/vault";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { eq } from "drizzle-orm";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { registerIntegration } from "@/lib/integrations/registerIntegration";
import { verifyCompletion } from "@/lib/wizards/verify-completion";
import { createGraphClient, createGraphSubscription } from "@/lib/graph/client";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import {
  graphApiAdminWizard,
  type GraphAdminPayload,
} from "@/lib/wizards/defs/graph-api-admin";
import { getAppUrl } from "@/lib/env/app-url";
import settings from "@/lib/settings";
import { ensureGraphSyncEnqueued } from "@/lib/scheduled-tasks/handlers/inbox-graph-sync";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export async function getGraphAuthorizeUrlAction(): Promise<string> {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const tenantId = process.env.MS_GRAPH_TENANT_ID ?? "common";
  const appUrl = getAppUrl();
  if (!clientId) return "#";
  const redirectUri = `${appUrl}/api/oauth/graph-api/callback`;
  const scopes = [
    "offline_access",
    "User.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "MailboxSettings.Read",
    "Calendars.ReadWrite",
  ].join(" ");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scopes,
    prompt: "consent",
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

const VAULT_CONTEXT = "graph-api.credentials";

export async function decryptGraphTokenAction(
  ct: string,
): Promise<
  | { ok: true; accessToken: string; credentialsJson: string }
  | { ok: false; reason: string }
> {
  try {
    const decrypted = vault.decrypt(ct, VAULT_CONTEXT);
    const creds = JSON.parse(decrypted) as { accessToken: string };
    return { ok: true, accessToken: creds.accessToken, credentialsJson: decrypted };
  } catch {
    return { ok: false, reason: "Failed to decrypt OAuth token." };
  }
}

function contractVersion(): string {
  const keys = graphApiAdminWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(
      JSON.stringify({ key: graphApiAdminWizard.key, required: keys }),
    )
    .digest("hex")
    .slice(0, 16);
}

export async function completeGraphAdminAction(
  payload: GraphAdminPayload,
): Promise<CelebrationCompleteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired — sign in again." };
  }
  const ownerId = session.user.id;
  const ctx = { ownerType: "admin" as const, ownerId };

  const wizardCompletionId = randomUUID();

  try {
    const { connectionId, bandsRegistered } = await registerIntegration({
      wizardCompletionId,
      manifest: graphApiAdminWizard.vendorManifest!,
      credentials: { plaintext: payload.credentialsJson },
      metadata: {
        verified_at_ms: payload.verifiedAt,
      },
      ownerType: "admin",
      ownerId,
    });

    const tenantId = process.env.MS_GRAPH_TENANT_ID ?? "common";
    const clientId = process.env.MS_GRAPH_CLIENT_ID ?? "";
    const now = Date.now();
    const graphStateId = randomUUID();
    await db.insert(graph_api_state).values({
      id: graphStateId,
      integration_connection_id: connectionId,
      user_id: ownerId,
      tenant_id: tenantId,
      client_id: clientId,
      initial_import_status: "in_progress",
      created_at_ms: now,
      updated_at_ms: now,
    });

    const verified = await verifyCompletion(
      graphApiAdminWizard,
      payload,
      ctx,
    );
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }

    await db.insert(wizard_completions).values({
      id: wizardCompletionId,
      wizard_key: graphApiAdminWizard.key,
      user_id: ownerId,
      audience: "admin",
      completion_payload: payload,
      contract_version: contractVersion(),
      completed_at_ms: Date.now(),
    });

    await unstable_update({});

    // Create webhook subscription so Microsoft pushes mail notifications
    try {
      const client = await createGraphClient(connectionId);
      const appUrl = getAppUrl();
      const webhookUrl = `${appUrl}/api/webhooks/graph`;
      const clientState = randomUUID();
      const sub = await createGraphSubscription(client, webhookUrl, clientState);
      await db
        .update(graph_api_state)
        .set({
          subscription_id: sub.id,
          subscription_expires_at_ms: new Date(sub.expirationDateTime).getTime(),
          updated_at_ms: Date.now(),
        })
        .where(eq(graph_api_state.id, graphStateId));
    } catch (subErr) {
      console.error("[graph-wizard] Webhook subscription failed (non-fatal):", subErr);
    }

    // Enqueue initial email history import
    const monthsBack = await settings.get("inbox.history_import_months");
    await enqueueTask({
      task_type: "inbox_initial_import",
      runAt: Date.now(),
      payload: { graph_state_id: graphStateId, months_back: monthsBack },
      idempotencyKey: `inbox_initial_import|${graphStateId}|start`,
    });

    void ensureGraphSyncEnqueued();

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

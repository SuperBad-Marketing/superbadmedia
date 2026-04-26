import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { instagram_accounts } from "@/lib/db/schema/instagram";
import { vault } from "@/lib/crypto/vault";
import {
  refreshLongLivedToken,
  getPages,
  getInstagramAccountFromPage,
} from "@/lib/channels/instagram/client";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";

const VAULT_CONTEXT = "meta.credentials";
const REFRESH_BUFFER_DAYS = 10;

async function handleInstagramTokenRefresh(): Promise<void> {
  const row = await db
    .select()
    .from(integration_connections)
    .where(
      and(
        eq(integration_connections.vendor_key, "meta"),
        eq(integration_connections.status, "active"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return;

  const plain = vault.decrypt(row.credentials, VAULT_CONTEXT);
  let creds: { accessToken: string; expiresAtMs?: number };
  try {
    creds = JSON.parse(plain) as { accessToken: string; expiresAtMs?: number };
  } catch {
    creds = { accessToken: plain };
  }

  const expiresAtMs = creds.expiresAtMs ?? 0;
  const bufferMs = REFRESH_BUFFER_DAYS * 86400 * 1000;
  const needsRefresh = expiresAtMs === 0 || Date.now() + bufferMs >= expiresAtMs;

  if (!needsRefresh) {
    await scheduleNext(expiresAtMs - bufferMs);
    return;
  }

  const appId = process.env.META_ADS_CLIENT_ID;
  const appSecret = process.env.META_ADS_CLIENT_SECRET;
  if (!appId || !appSecret) {
    console.error("[instagram-token-refresh] META_ADS_CLIENT_ID or META_ADS_CLIENT_SECRET not set");
    return;
  }

  const result = await refreshLongLivedToken(creds.accessToken, appId, appSecret);
  if (!result.ok) {
    console.error("[instagram-token-refresh] Meta token refresh failed:", result.error);
    await logActivity({
      kind: "instagram_token_refresh_failed",
      body: result.error,
    });
    return;
  }

  const newToken = result.data.access_token;
  const newExpiresAtMs = Date.now() + result.data.expires_in * 1000;

  const newCreds = JSON.stringify({
    accessToken: newToken,
    expiresAtMs: newExpiresAtMs,
  });
  const ciphertext = vault.encrypt(newCreds, VAULT_CONTEXT);

  await db
    .update(integration_connections)
    .set({
      credentials: ciphertext,
      connection_verified_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    })
    .where(eq(integration_connections.id, row.id));

  const pagesResult = await getPages(newToken);
  if (pagesResult.ok) {
    for (const page of pagesResult.data.data) {
      const igResult = await getInstagramAccountFromPage(page.id, newToken);
      if (!igResult.ok) continue;
      const igBiz = igResult.data?.instagram_business_account;
      if (!igBiz?.id) continue;

      const existing = await db
        .select({ id: instagram_accounts.id })
        .from(instagram_accounts)
        .where(eq(instagram_accounts.instagram_user_id, igBiz.id))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (existing) {
        await db
          .update(instagram_accounts)
          .set({
            access_token: page.access_token,
            token_expires_at_ms: newExpiresAtMs,
            status: "active",
          })
          .where(eq(instagram_accounts.id, existing.id));
      }
    }
  }

  await logActivity({
    kind: "instagram_token_refreshed",
    body: `Token refreshed, new expiry: ${new Date(newExpiresAtMs).toISOString()}`,
  });

  await scheduleNext(newExpiresAtMs - bufferMs);
}

async function scheduleNext(runAtMs: number): Promise<void> {
  const earliest = Date.now() + 86400 * 1000;
  const runAt = Math.max(runAtMs, earliest);
  await enqueueTask({
    task_type: "instagram_token_refresh",
    runAt: runAt,
    idempotencyKey: `ig-token-refresh-${new Date(runAt).toISOString().slice(0, 10)}`,
  });
}

export const INSTAGRAM_TOKEN_REFRESH_HANDLERS: HandlerMap = {
  instagram_token_refresh: handleInstagramTokenRefresh,
};

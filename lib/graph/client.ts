import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { vault } from "@/lib/crypto/vault";
import { killSwitches } from "@/lib/kill-switches";
import {
  GraphTokenResponseSchema,
  type GraphCredentials,
  type GraphSubscription,
  GraphSubscriptionSchema,
} from "./types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL_TEMPLATE =
  "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token";
const VAULT_CONTEXT = "graph-api.credentials";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function getClientId(): string {
  return getEnvOrThrow("MS_GRAPH_CLIENT_ID");
}
function getClientSecret(): string {
  return getEnvOrThrow("MS_GRAPH_CLIENT_SECRET");
}
function getTenantId(): string {
  return getEnvOrThrow("MS_GRAPH_TENANT_ID");
}
function getRedirectUri(): string {
  return `${getEnvOrThrow("NEXT_PUBLIC_APP_URL")}/api/oauth/graph-api/callback`;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<GraphCredentials> {
  const tokenUrl = TOKEN_URL_TEMPLATE.replace("{tenant}", getTenantId());
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
    scope: "offline_access User.Read Mail.ReadWrite Mail.Send MailboxSettings.Read",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const parsed = GraphTokenResponseSchema.parse(await res.json());
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? "",
    expiresAtMs: Date.now() + parsed.expires_in * 1000,
  };
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<GraphCredentials> {
  const tokenUrl = TOKEN_URL_TEMPLATE.replace("{tenant}", getTenantId());
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access User.Read Mail.ReadWrite Mail.Send MailboxSettings.Read",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token refresh failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const parsed = GraphTokenResponseSchema.parse(await res.json());
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? refreshToken,
    expiresAtMs: Date.now() + parsed.expires_in * 1000,
  };
}

export async function getValidAccessToken(
  integrationConnectionId: string,
): Promise<string> {
  const [row] = await db
    .select()
    .from(integration_connections)
    .where(eq(integration_connections.id, integrationConnectionId))
    .limit(1);
  if (!row) throw new Error(`No integration connection: ${integrationConnectionId}`);

  const creds: GraphCredentials = JSON.parse(
    vault.decrypt(row.credentials, VAULT_CONTEXT),
  );

  if (creds.expiresAtMs - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return creds.accessToken;
  }

  const refreshed = await refreshAccessToken(creds.refreshToken);
  const encrypted = vault.encrypt(JSON.stringify(refreshed), VAULT_CONTEXT);
  await db
    .update(integration_connections)
    .set({ credentials: encrypted, updated_at_ms: Date.now() })
    .where(eq(integration_connections.id, integrationConnectionId));

  return refreshed.accessToken;
}

export function encryptCredentials(creds: GraphCredentials): string {
  return vault.encrypt(JSON.stringify(creds), VAULT_CONTEXT);
}

export type GraphClient = {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  fetchJson: <T>(path: string, init?: RequestInit) => Promise<T>;
};

export async function createGraphClient(
  integrationConnectionId: string,
): Promise<GraphClient> {
  if (!killSwitches.inbox_sync_enabled) {
    throw new Error("Graph API calls are disabled (inbox_sync_enabled = false)");
  }

  const accessToken = await getValidAccessToken(integrationConnectionId);

  const graphFetch = async (
    path: string,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    return res;
  };

  const fetchJson = async <T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> => {
    const res = await graphFetch(path, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  };

  return { fetch: graphFetch, fetchJson };
}

export async function createGraphSubscription(
  client: GraphClient,
  webhookUrl: string,
  clientState: string,
  expirationMinutes: number = 4230,
): Promise<GraphSubscription> {
  const expiration = new Date(
    Date.now() + expirationMinutes * 60 * 1000,
  ).toISOString();

  const res = await client.fetchJson<unknown>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      changeType: "created,updated",
      notificationUrl: webhookUrl,
      resource: "me/mailFolders('Inbox')/messages",
      expirationDateTime: expiration,
      clientState,
    }),
  });

  return GraphSubscriptionSchema.parse(res);
}

export async function renewGraphSubscription(
  client: GraphClient,
  subscriptionId: string,
  expirationMinutes: number = 4230,
): Promise<GraphSubscription> {
  const expiration = new Date(
    Date.now() + expirationMinutes * 60 * 1000,
  ).toISOString();

  const res = await client.fetchJson<unknown>(
    `/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ expirationDateTime: expiration }),
    },
  );

  return GraphSubscriptionSchema.parse(res);
}

export async function getActiveGraphState() {
  const [row] = await db
    .select()
    .from(graph_api_state)
    .where(eq(graph_api_state.initial_import_status, "complete"))
    .limit(1);
  if (!row) {
    const [any] = await db.select().from(graph_api_state).limit(1);
    return any ?? null;
  }
  return row;
}

/**
 * Retrieve a decrypted credential from `integration_connections` for a
 * given vendor key. Returns `null` if no active connection exists.
 *
 * Fallback: if no DB row exists, checks for an env var using the
 * VENDOR_KEY_API_KEY naming convention (e.g. serpapi → SERPAPI_API_KEY).
 * This survives DB resets and avoids re-running wizards in dev.
 *
 * Owner: CE-2 (first consumer). Shared primitive: any feature that
 * needs runtime access to a wizard-registered API key uses this.
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { vault } from "@/lib/crypto/vault";

const ENV_VAR_MAP: Record<string, string> = {
  serpapi: "SERPAPI_API_KEY",
  apify: "APIFY_API_TOKEN",
  "hunter-io": "HUNTER_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  resend: "RESEND_API_KEY",
  "stripe-admin": "STRIPE_SECRET_KEY",
  cloudinary: "CLOUDINARY_API_KEY",
  twilio: "TWILIO_AUTH_TOKEN",
  meta: "META_ACCESS_TOKEN",
  posthog: "POSTHOG_API_KEY",
  higgsfield: "HIGGSFIELD_API_KEY",
  "google-ads": "GOOGLE_ADS_API_KEY",
};

export async function getCredential(
  vendorKey: string,
): Promise<string | null> {
  const row = await db
    .select({
      credentials: integration_connections.credentials,
      vendor_key: integration_connections.vendor_key,
    })
    .from(integration_connections)
    .where(
      and(
        eq(integration_connections.vendor_key, vendorKey),
        eq(integration_connections.status, "active"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (row) {
    return vault.decrypt(
      row.credentials,
      `${row.vendor_key}.credentials`,
    );
  }

  const envKey = ENV_VAR_MAP[vendorKey];
  return envKey ? process.env[envKey] ?? null : null;
}

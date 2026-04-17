/**
 * Retrieve a decrypted credential from `integration_connections` for a
 * given vendor key. Returns `null` if no active connection exists.
 *
 * Owner: CE-2 (first consumer). Shared primitive: any feature that
 * needs runtime access to a wizard-registered API key uses this.
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { vault } from "@/lib/crypto/vault";

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

  if (!row) return null;

  return vault.decrypt(
    row.credentials,
    `${row.vendor_key}.credentials`,
  );
}

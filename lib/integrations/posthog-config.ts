/**
 * Reads the PostHog project API key from integration_connections (wizard)
 * or falls back to NEXT_PUBLIC_POSTHOG_KEY env var.
 *
 * Called server-side in the root layout to pass the key to the client
 * provider. Cached per-request by Next.js since it's called from a
 * server component.
 */

export async function getPosthogConfig(): Promise<{
  key: string | null;
  host: string | null;
}> {
  try {
    const [
      { getCredential },
      { eq, and },
      { db },
      { integration_connections },
    ] = await Promise.all([
      import("./getCredential"),
      import("drizzle-orm"),
      import("@/lib/db"),
      import("@/lib/db/schema/integration-connections"),
    ]);

    const key = await getCredential("posthog");
    if (key) {
      const row = await db
        .select({ metadata: integration_connections.metadata })
        .from(integration_connections)
        .where(
          and(
            eq(integration_connections.vendor_key, "posthog"),
            eq(integration_connections.status, "active"),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      const meta = row?.metadata as { posthog_host?: string } | null;
      return {
        key,
        host: meta?.posthog_host ?? null,
      };
    }
  } catch {
    // DB not available (e.g. build time) — fall through to env
  }

  return {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? null,
  };
}

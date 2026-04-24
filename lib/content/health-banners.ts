import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import type { HealthBanner } from "@/lib/tasks/cockpit";

export async function getContentHealthBanners(
  _nowMs: number = Date.now(),
): Promise<HealthBanner[]> {
  const banners: HealthBanner[] = [];

  const failedConnections = await db
    .select({
      id: integration_connections.id,
      vendor_key: integration_connections.vendor_key,
      status: integration_connections.status,
    })
    .from(integration_connections)
    .where(
      and(
        sql`${integration_connections.vendor_key} IN ('cloudinary', 'meta', 'google-ads')`,
        sql`${integration_connections.status} IN ('revoked', 'lapsed')`,
      ),
    )
    .all();

  if (failedConnections.length > 0) {
    const vendors = [...new Set(failedConnections.map((c) => c.vendor_key))];
    const label = vendors.map((v) => v.replace(/-/g, " ")).join(", ");

    banners.push({
      id: "content_integration_degraded",
      severity: failedConnections.some((c) => c.status === "revoked")
        ? "critical"
        : "warning",
      summary: `Content delivery connections degraded: ${label}. Publishing may be affected.`,
      href: "/lite/content",
      source: "content-engine",
    });
  }

  return banners;
}

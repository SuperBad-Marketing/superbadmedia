import { and, eq, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { graph_api_state } from "@/lib/db/schema/graph-api-state";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import type { HealthBanner } from "@/lib/tasks/cockpit";

const MS_PER_DAY = 86_400_000;

export async function getInboxHealthBanners(
  nowMs: number = Date.now(),
): Promise<HealthBanner[]> {
  const banners: HealthBanner[] = [];

  // 1. Graph API subscription lapsed (expired and not renewed)
  const lapsedSubs = await db
    .select({
      id: graph_api_state.id,
      subscription_expires_at_ms: graph_api_state.subscription_expires_at_ms,
    })
    .from(graph_api_state)
    .innerJoin(
      integration_connections,
      eq(graph_api_state.integration_connection_id, integration_connections.id),
    )
    .where(
      and(
        eq(integration_connections.status, "active"),
        sql`${graph_api_state.subscription_expires_at_ms} IS NOT NULL`,
        lte(graph_api_state.subscription_expires_at_ms, nowMs),
      ),
    )
    .all();

  if (lapsedSubs.length > 0) {
    banners.push({
      id: "inbox_graph_api_subscription_lapsed",
      severity: "critical",
      summary: "Graph API subscription lapsed. New emails won't sync until renewed.",
      href: "/lite/setup/admin/graph-api-admin",
      source: "unified-inbox",
    });
  }

  // 2. SendAs permission revoked (integration connection status = 'revoked')
  const revokedConnections = await db
    .select({ id: integration_connections.id })
    .from(integration_connections)
    .where(
      and(
        eq(integration_connections.vendor_key, "graph-api-admin"),
        eq(integration_connections.status, "revoked"),
      ),
    )
    .all();

  if (revokedConnections.length > 0) {
    banners.push({
      id: "inbox_sendas_permission_revoked",
      severity: "critical",
      summary: "Graph API permissions revoked. Reconnect to restore email access.",
      href: "/lite/setup/admin/graph-api-admin",
      source: "unified-inbox",
    });
  }

  // 3. Import stuck (initial_import_status = 'in_progress' for >24h)
  const stuckImports = await db
    .select({ id: graph_api_state.id })
    .from(graph_api_state)
    .where(
      and(
        eq(graph_api_state.initial_import_status, "in_progress"),
        lte(graph_api_state.updated_at_ms, nowMs - MS_PER_DAY),
      ),
    )
    .all();

  if (stuckImports.length > 0) {
    banners.push({
      id: "inbox_import_stuck",
      severity: "warning",
      summary: "Email import has been running for over 24 hours. Might be stuck.",
      href: "/lite/inbox",
      source: "unified-inbox",
    });
  }

  return banners;
}

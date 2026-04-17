/**
 * /lite/content/list — Newsletter subscriber list management (CE-11).
 *
 * Spec: docs/specs/content-engine.md §8.1 (List tab), §4.2 (list management),
 * §4.3 (list hygiene).
 *
 * Admin-only. Shows: subscriber table, CSV import, embed code, health panel,
 * CSV export.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import {
  listSubscribers,
  getListHealth,
} from "@/lib/content-engine/subscriber-list";
import { ContentTabs } from "../_components/content-tabs";
import { SubscriberTable } from "../_components/subscriber-table";
import { CsvImport } from "../_components/csv-import";
import { CsvExportButton } from "../_components/csv-export-button";
import { EmbedCodePanel } from "../_components/embed-code-panel";
import { ListHealthPanel } from "../_components/list-health-panel";

export const metadata: Metadata = {
  title: "Subscriber List — SuperBad",
};

export default async function ListPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  // Get the first company's config (admin-wide; CE-10 precedent)
  const config = await db
    .select()
    .from(contentEngineConfig)
    .limit(1)
    .get();

  if (!config) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ContentTabs currentPath="/lite/content/list" />
        <p className="py-8 text-center text-sm text-muted-foreground">
          No content engine configured yet.
        </p>
      </div>
    );
  }

  const [subscribers, health] = await Promise.all([
    listSubscribers(config.company_id),
    getListHealth(config.company_id),
  ]);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ContentTabs currentPath="/lite/content/list" />

      {/* Header with export */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Subscriber list</h1>
          <p className="text-sm text-muted-foreground">
            {health.active} active of {health.total} total
          </p>
        </div>
        <CsvExportButton companyId={config.company_id} />
      </div>

      {/* Health panel */}
      <div className="mb-6">
        <ListHealthPanel health={health} />
      </div>

      {/* Import + Embed side by side */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <CsvImport companyId={config.company_id} />
        <EmbedCodePanel
          embedFormToken={config.embed_form_token}
          baseUrl={baseUrl}
        />
      </div>

      {/* Subscriber table */}
      <SubscriberTable subscribers={subscribers} />
    </div>
  );
}

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
        <div
          className="rounded-[12px] px-8 py-10 text-center"
          style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
        >
          <p className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "-0.2px" }}>
            No content engine configured yet.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
            run onboarding first.
          </p>
        </div>
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
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Content · List
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Subscriber List
          </h1>
          <CsvExportButton companyId={config.company_id} />
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Who&apos;s reading, who&apos;s bouncing.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {health.active > 0 ? "the list is alive." : "empty chairs at empty tables."}
          </em>
        </p>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {health.active}
          </span>
          <span>active</span>
          <span aria-hidden className="text-[color:var(--color-neutral-700)]">·</span>
          <span>{health.total} total</span>
        </div>
      </header>

      <ContentTabs currentPath="/lite/content/list" />

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

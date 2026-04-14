/**
 * /lite/admin/pipeline — Sales Pipeline Kanban board.
 * Spec: docs/specs/sales-pipeline.md §§ 5.1–5.6, 8.
 * Admin-only; non-admins redirect to sign-in.
 */
import { redirect } from "next/navigation";
import { desc, eq, and, asc, max } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { activity_log } from "@/lib/db/schema/activity-log";
import settingsRegistry from "@/lib/settings";
import { isDealStale, type PipelineStaleThresholds } from "@/lib/crm";

import { PipelineBoard } from "@/components/lite/sales-pipeline/pipeline-board";
import type { PipelineCardDeal } from "@/components/lite/sales-pipeline/deal-card";

export const metadata: Metadata = {
  title: "SuperBad — Sales Pipeline",
  robots: { index: false, follow: false },
};

function relativeLabel(tsMs: number | null, nowMs: number): string | null {
  if (tsMs == null) return null;
  const diff = nowMs - tsMs;
  const dayMs = 24 * 60 * 60 * 1000;
  if (diff < dayMs) return "today";
  const days = Math.floor(diff / dayMs);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

async function loadThresholds(): Promise<PipelineStaleThresholds> {
  const get = settingsRegistry.get;
  const [lead, contacted, conversation, trial_shoot, quoted, negotiating] =
    await Promise.all([
      get("pipeline.stale_thresholds.lead_days"),
      get("pipeline.stale_thresholds.contacted_days"),
      get("pipeline.stale_thresholds.conversation_days"),
      get("pipeline.stale_thresholds.trial_shoot_days"),
      get("pipeline.stale_thresholds.quoted_days"),
      get("pipeline.stale_thresholds.negotiating_days"),
    ]);
  return {
    lead_days: lead,
    contacted_days: contacted,
    conversation_days: conversation,
    trial_shoot_days: trial_shoot,
    quoted_days: quoted,
    negotiating_days: negotiating,
  };
}

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const nowMs = Date.now();
  const thresholds = await loadThresholds();

  // Single query. Primary contact resolution lives below (§ preflight rule):
  // prefer `deals.primary_contact_id`; else company's `is_primary` contact;
  // else earliest contact by `created_at_ms`.
  const rows = await db
    .select({
      deal: deals,
      company: companies,
      primaryContact: contacts,
    })
    .from(deals)
    .innerJoin(companies, eq(companies.id, deals.company_id))
    .leftJoin(contacts, eq(contacts.id, deals.primary_contact_id))
    .orderBy(asc(deals.stage), desc(deals.last_stage_change_at_ms));

  // Fallback contacts per company (when primary_contact_id is null): pick
  // is_primary=true first, then earliest created_at_ms. Load once per
  // company id that needs it.
  const companyIdsNeedingFallback = new Set<string>();
  for (const r of rows) {
    if (!r.deal.primary_contact_id) companyIdsNeedingFallback.add(r.company.id);
  }
  const fallbackByCompany = new Map<string, typeof contacts.$inferSelect>();
  if (companyIdsNeedingFallback.size > 0) {
    const fallbackRows = await db
      .select()
      .from(contacts)
      .orderBy(desc(contacts.is_primary), asc(contacts.created_at_ms));
    for (const c of fallbackRows) {
      if (!companyIdsNeedingFallback.has(c.company_id)) continue;
      if (!fallbackByCompany.has(c.company_id)) {
        fallbackByCompany.set(c.company_id, c);
      }
    }
  }

  // Last activity timestamp per deal — single grouped query.
  const lastActivityRows = await db
    .select({
      deal_id: activity_log.deal_id,
      last_at: max(activity_log.created_at_ms),
    })
    .from(activity_log)
    .groupBy(activity_log.deal_id);
  const lastActivityByDeal = new Map<string, number>();
  for (const r of lastActivityRows) {
    if (r.deal_id && r.last_at != null) {
      lastActivityByDeal.set(r.deal_id, r.last_at);
    }
  }

  const cards: PipelineCardDeal[] = rows.map((r) => {
    const contact =
      r.primaryContact ??
      fallbackByCompany.get(r.company.id) ??
      null;
    const stale = isDealStale(
      {
        stage: r.deal.stage,
        last_stage_change_at_ms: r.deal.last_stage_change_at_ms,
        snoozed_until_ms: r.deal.snoozed_until_ms,
      },
      thresholds,
      nowMs,
    );
    return {
      id: r.deal.id,
      stage: r.deal.stage,
      title: r.deal.title,
      value_cents: r.deal.value_cents,
      value_estimated: r.deal.value_estimated,
      won_outcome: r.deal.won_outcome,
      next_action_text: r.deal.next_action_text,
      is_stale: stale,
      company_name: r.company.name,
      contact_name: contact?.name ?? null,
      contact_role: contact?.role ?? null,
      last_activity_label: relativeLabel(
        lastActivityByDeal.get(r.deal.id) ?? null,
        nowMs,
      ),
    };
  });

  return (
    <main className="min-h-screen bg-background">
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-heading text-2xl font-semibold">Sales Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          {cards.length} deal{cards.length === 1 ? "" : "s"} across 8 stages.
        </p>
      </div>
      <PipelineBoard deals={cards} />
    </main>
  );
}

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
  const snoozeDefaultDays = await settingsRegistry.get(
    "pipeline.snooze_default_days",
  );

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
      billing_mode: r.company.billing_mode,
      contact_name: contact?.name ?? null,
      contact_role: contact?.role ?? null,
      last_activity_label: relativeLabel(
        lastActivityByDeal.get(r.deal.id) ?? null,
        nowMs,
      ),
    };
  });

  const staleCount = cards.filter((c) => c.is_stale).length;

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Pipeline
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Sales Pipeline
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Every deal, every stage, every stall.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {staleCount > 0
              ? "a few of them are waiting on you."
              : "momentum's your job."}
          </em>
        </p>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {cards.length}
          </span>
          <span>deal{cards.length === 1 ? "" : "s"}</span>
          <span aria-hidden className="text-[color:var(--color-neutral-700)]">
            ·
          </span>
          <span>8 stages</span>
          {staleCount > 0 ? (
            <>
              <span
                aria-hidden
                className="text-[color:var(--color-neutral-700)]"
              >
                ·
              </span>
              <span
                className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                {staleCount} stale
              </span>
            </>
          ) : null}
        </div>
      </header>
      <PipelineBoard deals={cards} snoozeDefaultDays={snoozeDefaultDays} />
    </div>
  );
}

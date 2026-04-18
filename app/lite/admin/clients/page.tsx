/**
 * /lite/admin/clients — Clients index.
 * Spec: docs/specs/client-management.md §11–§12 (locks #13, #14, #24–#26).
 * Admin-only; non-admins redirect to sign-in.
 */
import { redirect } from "next/navigation";
import { eq, and, sql, max, count, sum, inArray } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { invoices } from "@/lib/db/schema/invoices";
import { activity_log } from "@/lib/db/schema/activity-log";
import {
  ClientsIndexClient,
  type ClientIndexRow,
  type ClientsSummary,
  type ClientStageFilter,
} from "@/components/lite/admin/clients/clients-index-client";

export const metadata: Metadata = {
  title: "SuperBad — Clients",
  robots: { index: false, follow: false },
};

const STAGE_FILTERS: ClientStageFilter[] = [
  "active",
  "completed",
  "churned",
];

function parseFilter(raw: string | undefined): ClientStageFilter {
  if (!raw) return "active";
  const lower = raw.toLowerCase() as ClientStageFilter;
  return STAGE_FILTERS.includes(lower) ? lower : "active";
}

type HealthScore = "healthy" | "cooling" | "at_risk" | "stale";

function deriveHealthScore(lastActivityMs: number | null, nowMs: number): HealthScore {
  if (lastActivityMs == null) return "stale";
  const daysSince = (nowMs - lastActivityMs) / (24 * 60 * 60 * 1000);
  if (daysSince <= 7) return "healthy";
  if (daysSince <= 14) return "cooling";
  if (daysSince <= 30) return "at_risk";
  return "stale";
}

export default async function ClientsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const sp = await searchParams;
  const stageFilter = parseFilter(sp.stage);
  const nowMs = Date.now();

  // All companies that have at least one won deal (= clients per spec §11.5)
  const wonDealRows = await db
    .select({
      company_id: deals.company_id,
      won_outcome: deals.won_outcome,
      value_cents: deals.value_cents,
      subscription_state: deals.subscription_state,
      billing_cadence: deals.billing_cadence,
    })
    .from(deals)
    .where(eq(deals.stage, "won"));

  // Group by company to determine stage + monthly value
  const companyDealMap = new Map<
    string,
    {
      hasActive: boolean;
      hasCancelled: boolean;
      totalMonthlyValue: number;
      wonOutcomes: string[];
    }
  >();

  for (const d of wonDealRows) {
    let entry = companyDealMap.get(d.company_id);
    if (!entry) {
      entry = {
        hasActive: false,
        hasCancelled: false,
        totalMonthlyValue: 0,
        wonOutcomes: [],
      };
      companyDealMap.set(d.company_id, entry);
    }
    if (d.won_outcome) entry.wonOutcomes.push(d.won_outcome);

    const isActive =
      d.subscription_state === "active" ||
      d.subscription_state === "past_due" ||
      d.subscription_state === "paused";
    const isCancelled =
      d.subscription_state === "cancelled_paid_remainder" ||
      d.subscription_state === "cancelled_buyout" ||
      d.subscription_state === "cancelled_post_term";

    if (isActive) {
      entry.hasActive = true;
      if (d.value_cents) {
        if (d.billing_cadence === "annual_upfront") {
          entry.totalMonthlyValue += Math.round(d.value_cents / 12);
        } else {
          entry.totalMonthlyValue += d.value_cents;
        }
      }
    }
    if (isCancelled) entry.hasCancelled = true;
  }

  const clientCompanyIds = [...companyDealMap.keys()];
  if (clientCompanyIds.length === 0) {
    const summary: ClientsSummary = {
      active_count: 0,
      monthly_revenue_cents: 0,
      needing_attention_count: 0,
      overdue_invoice_count: 0,
    };
    return (
      <div>
        <ClientsHeader
          totalClients={0}
          attentionCount={0}
          stageFilter={stageFilter}
        />
        <ClientsIndexClient
          rows={[]}
          summary={summary}
          initialStage={stageFilter}
        />
      </div>
    );
  }

  // Load company data for client companies
  const companyRows = await db
    .select()
    .from(companies)
    .where(inArray(companies.id, clientCompanyIds));

  // Primary contacts per company
  const contactRows = await db
    .select()
    .from(contacts)
    .where(inArray(contacts.company_id, clientCompanyIds));

  const primaryContactByCompany = new Map<string, typeof contacts.$inferSelect>();
  const allContactsByCompany = new Map<string, (typeof contacts.$inferSelect)[]>();
  for (const c of contactRows) {
    const list = allContactsByCompany.get(c.company_id) ?? [];
    list.push(c);
    allContactsByCompany.set(c.company_id, list);

    const current = primaryContactByCompany.get(c.company_id);
    if (!current || (c.is_primary && !current.is_primary)) {
      primaryContactByCompany.set(c.company_id, c);
    } else if (
      !current.is_primary &&
      !c.is_primary &&
      c.created_at_ms < current.created_at_ms
    ) {
      primaryContactByCompany.set(c.company_id, c);
    }
  }

  // Last activity per company
  const activityRows = await db
    .select({
      company_id: activity_log.company_id,
      last_at: max(activity_log.created_at_ms),
    })
    .from(activity_log)
    .where(inArray(activity_log.company_id, clientCompanyIds))
    .groupBy(activity_log.company_id);

  const lastActivityByCompany = new Map<string, number>();
  for (const r of activityRows) {
    if (r.company_id && r.last_at != null) {
      lastActivityByCompany.set(r.company_id, r.last_at);
    }
  }

  // Overdue invoices per company
  const overdueRows = await db
    .select({
      company_id: invoices.company_id,
      overdue_count: count(),
    })
    .from(invoices)
    .where(
      and(
        inArray(invoices.company_id, clientCompanyIds),
        eq(invoices.status, "overdue"),
      ),
    )
    .groupBy(invoices.company_id);

  const overdueByCompany = new Map<string, number>();
  for (const r of overdueRows) {
    overdueByCompany.set(r.company_id, r.overdue_count);
  }

  // Total overdue invoices count across all clients
  const totalOverdueCount = overdueRows.reduce(
    (sum, r) => sum + r.overdue_count,
    0,
  );

  // Build rows
  const clientRows: ClientIndexRow[] = [];
  let activeCount = 0;
  let totalMonthlyRevenue = 0;
  let needingAttentionCount = 0;

  for (const company of companyRows) {
    const dealInfo = companyDealMap.get(company.id);
    if (!dealInfo) continue;

    // Determine relationship stage
    let stage: "active" | "completed" | "churned";
    if (dealInfo.hasActive) {
      stage = "active";
    } else if (dealInfo.hasCancelled) {
      stage = "churned";
    } else {
      stage = "completed";
    }

    if (stage === "active") {
      activeCount++;
      totalMonthlyRevenue += dealInfo.totalMonthlyValue;
    }

    const lastActivity = lastActivityByCompany.get(company.id) ?? null;
    const health = deriveHealthScore(lastActivity, nowMs);

    if (health === "at_risk" || health === "stale") {
      needingAttentionCount++;
    }

    const primary = primaryContactByCompany.get(company.id);
    const overdueCount = overdueByCompany.get(company.id) ?? 0;

    // Package type from won outcomes
    const packageType = dealInfo.wonOutcomes.includes("retainer")
      ? "retainer"
      : dealInfo.wonOutcomes.includes("project")
        ? "project"
        : dealInfo.wonOutcomes.includes("saas")
          ? "saas"
          : "project";

    clientRows.push({
      id: company.id,
      name: company.name,
      primary_contact_name: primary?.name ?? null,
      health,
      package_type: packageType,
      monthly_value_cents: dealInfo.totalMonthlyValue,
      last_activity_ms: lastActivity,
      overdue_invoice_count: overdueCount,
      stage,
      billing_mode: company.billing_mode,
      industry_vertical: company.industry_vertical ?? null,
    });
  }

  // Sort: worst health first, then last activity descending
  const healthOrder: Record<HealthScore, number> = {
    stale: 0,
    at_risk: 1,
    cooling: 2,
    healthy: 3,
  };
  clientRows.sort((a, b) => {
    const hDiff = healthOrder[a.health] - healthOrder[b.health];
    if (hDiff !== 0) return hDiff;
    return (b.last_activity_ms ?? 0) - (a.last_activity_ms ?? 0);
  });

  const summary: ClientsSummary = {
    active_count: activeCount,
    monthly_revenue_cents: totalMonthlyRevenue,
    needing_attention_count: needingAttentionCount,
    overdue_invoice_count: totalOverdueCount,
  };

  return (
    <div>
      <ClientsHeader
        totalClients={clientRows.length}
        attentionCount={needingAttentionCount}
        stageFilter={stageFilter}
      />
      <ClientsIndexClient
        rows={clientRows}
        summary={summary}
        initialStage={stageFilter}
      />
    </div>
  );
}

function ClientsHeader({
  totalClients,
  attentionCount,
  stageFilter,
}: {
  totalClients: number;
  attentionCount: number;
  stageFilter: ClientStageFilter;
}) {
  return (
    <header className="px-4 pt-6 pb-5">
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Admin · Clients
      </div>
      <h1
        className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.4px" }}
      >
        Clients
      </h1>
      <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
        Every relationship, every signal.{" "}
        <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
          {totalClients === 0
            ? "win a deal and they'll show up here."
            : attentionCount > 0
              ? "a few need your attention."
              : "all quiet on the western front."}
        </em>
      </p>
      <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
        <span
          className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {totalClients}
        </span>
        <span>client{totalClients === 1 ? "" : "s"}</span>
        {attentionCount > 0 && (
          <>
            <span
              aria-hidden
              className="text-[color:var(--color-neutral-700)]"
            >
              ·
            </span>
            <span
              className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-brand-orange)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {attentionCount} needing attention
            </span>
          </>
        )}
      </div>
    </header>
  );
}

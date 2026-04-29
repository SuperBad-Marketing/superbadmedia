import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { quotes } from "@/lib/db/schema/quotes";
import { call_logs } from "@/lib/db/schema/call-logs";
import {
  DealDetailClient,
  type DealDetailData,
} from "@/components/lite/sales-pipeline/deal-detail-client";
import { DealQuotesSection } from "@/components/lite/sales-pipeline/deal-quotes-section";
import { DealCallHistory } from "@/components/lite/sales-pipeline/deal-call-history";
import { AdHocNoteButton } from "@/components/lite/sales-pipeline/adhoc-note-button";
import { EnrichmentCard } from "@/components/lite/enrichment-card";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

export const metadata: Metadata = {
  title: "SuperBad — Deal Detail",
  robots: { index: false, follow: false },
};

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;

  const [row] = db
    .select({
      id: deals.id,
      title: deals.title,
      stage: deals.stage,
      value_cents: deals.value_cents,
      value_estimated: deals.value_estimated,
      next_action_text: deals.next_action_text,
      won_outcome: deals.won_outcome,
      loss_reason: deals.loss_reason,
      loss_notes: deals.loss_notes,
      source: deals.source,
      created_at_ms: deals.created_at_ms,
      company_id: deals.company_id,
      company_name: companies.name,
      company_viability_profile: companies.viability_profile_json,
      contact_id: deals.primary_contact_id,
      contact_name: contacts.name,
      contact_email: contacts.email,
      contact_phone: contacts.phone,
      contact_role: contacts.role,
    })
    .from(deals)
    .innerJoin(companies, eq(deals.company_id, companies.id))
    .leftJoin(contacts, eq(deals.primary_contact_id, contacts.id))
    .where(eq(deals.id, id))
    .limit(1)
    .all();

  if (!row) notFound();

  const dealQuotes = await db
    .select()
    .from(quotes)
    .where(eq(quotes.deal_id, id))
    .orderBy(desc(quotes.created_at_ms));

  const dealCalls = await db
    .select()
    .from(call_logs)
    .where(eq(call_logs.deal_id, id))
    .orderBy(desc(call_logs.created_at_ms));

  const deal: DealDetailData = {
    id: row.id,
    title: row.title,
    stage: row.stage,
    value_cents: row.value_cents,
    value_estimated: row.value_estimated,
    next_action_text: row.next_action_text,
    won_outcome: row.won_outcome,
    loss_reason: row.loss_reason,
    loss_notes: row.loss_notes,
    source: row.source,
    created_at_ms: row.created_at_ms,
    company_id: row.company_id,
    company_name: row.company_name,
    contact_id: row.contact_id,
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    contact_role: row.contact_role,
  };

  const stageBadgeStyles: Record<string, { bg: string; color: string }> = {
    won: { bg: "rgba(123,174,126,0.14)", color: "var(--color-success)" },
    lost: { bg: "rgba(200,49,43,0.12)", color: "var(--color-brand-red)" },
  };
  const badge = stageBadgeStyles[deal.stage];

  return (
    <div className="mx-auto max-w-[680px] px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <Link
          href="/lite/admin/pipeline"
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)] transition-colors"
          style={{ letterSpacing: "2px" }}
        >
          <span aria-hidden>&larr;</span> Pipeline
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1
              className="font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "-0.3px" }}
            >
              {deal.title}
            </h1>
            <p className="mt-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
              {deal.company_name}
              {deal.contact_name && (
                <>
                  {" "}
                  <span className="text-[color:var(--color-neutral-600)]">&middot;</span>{" "}
                  {deal.contact_name}
                </>
              )}
            </p>
          </div>
          {badge && (
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
              style={{
                letterSpacing: "1.5px",
                background: badge.bg,
                color: badge.color,
              }}
            >
              <span
                aria-hidden
                className="h-1 w-1 rounded-full"
                style={{ background: "currentColor", opacity: 0.85 }}
              />
              {deal.stage === "won" ? "Won" : "Lost"}
            </span>
          )}
        </div>
      </header>

      <div className="mt-4 px-4 flex justify-end">
        <AdHocNoteButton dealId={deal.id} />
      </div>

      <div className="mt-4 px-4">
        <DealCallHistory dealId={deal.id} dealStage={deal.stage} calls={dealCalls} />
      </div>

      <div className="mt-6 px-4">
        <DealDetailClient deal={deal} />
      </div>

      <div className="mt-8 px-4">
        <DealQuotesSection
          dealId={deal.id}
          companyId={deal.company_id}
          quotes={dealQuotes}
        />
      </div>

      <div className="mt-6 px-4">
        <EnrichmentCard
          profile={row.company_viability_profile as ViabilityProfile | null}
          companyId={deal.company_id}
        />
      </div>
    </div>
  );
}

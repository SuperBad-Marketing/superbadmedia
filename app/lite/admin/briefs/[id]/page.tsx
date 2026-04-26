import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { briefs } from "@/lib/db/schema/briefs";
import { brief_storyboards } from "@/lib/db/schema/brief-storyboards";
import { companies } from "@/lib/db/schema/companies";
import { BriefDetailClient } from "./brief-detail-client";

export const metadata: Metadata = {
  title: "SuperBad — Brief Detail",
  robots: { index: false, follow: false },
};

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;

  const brief = await db
    .select()
    .from(briefs)
    .where(eq(briefs.id, id))
    .get();

  if (!brief) notFound();

  let storyboard: typeof brief_storyboards.$inferSelect | null = null;
  try {
    storyboard = await db
      .select()
      .from(brief_storyboards)
      .where(eq(brief_storyboards.brief_id, id))
      .get() ?? null;
  } catch {
    storyboard = null;
  }

  let companyName: string | null = null;
  if (brief.company_id) {
    const c = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, brief.company_id))
      .get();
    companyName = c?.name ?? null;
  }

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">&middot;</span>{" "}
          <Link
            href="/lite/admin/briefs"
            className="transition-colors hover:text-[color:var(--color-brand-cream)]"
          >
            Briefs
          </Link>{" "}
          <span className="text-[color:var(--color-neutral-600)]">&middot;</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            {brief.reference_number}
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          {brief.project_title || `${brief.brief_type === "lean" ? "Lean" : "Structured"} Brief`}
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          {brief.business_name}
          {companyName && companyName !== brief.business_name
            ? ` — ${companyName}`
            : ""}
          {" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {brief.reference_number}
          </em>
        </p>
      </header>

      <BriefDetailClient
        brief={{
          id: brief.id,
          brief_type: brief.brief_type,
          status: brief.status,
          source: brief.source,
          business_name: brief.business_name,
          contact_name: brief.contact_name,
          contact_email: brief.contact_email,
          description: brief.description,
          delivery_date_ms: brief.delivery_date_ms,
          project_title: brief.project_title,
          brief_kind: brief.brief_kind,
          style_references: brief.style_references,
          key_messages: brief.key_messages,
          target_audience: brief.target_audience,
          deliverables_breakdown: brief.deliverables_breakdown,
          location_details: brief.location_details,
          talent_notes: brief.talent_notes,
          budget_range: brief.budget_range,
          additional_notes: brief.additional_notes,
          created_at_ms: brief.created_at_ms,
        }}
        storyboard={
          storyboard
            ? {
                id: storyboard.id,
                status: storyboard.status,
                scenes: storyboard.scenes_json ?? [],
                shotlist: storyboard.shotlist_json ?? [],
                chatHistory: storyboard.chat_history_json ?? [],
                errorMessage: storyboard.error_message,
                generatedAtMs: storyboard.generated_at_ms,
              }
            : null
        }
      />
    </div>
  );
}

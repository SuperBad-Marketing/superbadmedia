import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { briefs } from "@/lib/db/schema/briefs";
import { companies } from "@/lib/db/schema/companies";
import { BriefsIndexClient, type BriefIndexRow } from "./briefs-index-client";

export const metadata: Metadata = {
  title: "SuperBad — Briefs",
  robots: { index: false, follow: false },
};

export default async function BriefsIndexPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const allBriefs = await db
    .select()
    .from(briefs)
    .orderBy(desc(briefs.created_at_ms));

  const companyIds = [
    ...new Set(
      allBriefs
        .map((b) => b.company_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  const companyMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const companyRows = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies);
    for (const c of companyRows) {
      companyMap.set(c.id, c.name);
    }
  }

  const rows: BriefIndexRow[] = allBriefs.map((b) => ({
    id: b.id,
    reference_number: b.reference_number,
    brief_type: b.brief_type,
    status: b.status,
    source: b.source,
    business_name: b.business_name,
    contact_name: b.contact_name,
    delivery_date_ms: b.delivery_date_ms,
    company_id: b.company_id,
    company_name: b.company_id ? companyMap.get(b.company_id) ?? null : null,
    match_confidence: b.match_confidence,
    match_method: b.match_method,
    created_at_ms: b.created_at_ms,
  }));

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">Briefs</span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Briefs
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Every shoot and edit brief in one place.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            the inbox for what needs making.
          </em>
        </p>
      </header>
      <BriefsIndexClient rows={rows} />
    </div>
  );
}

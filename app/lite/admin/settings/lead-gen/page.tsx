import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { dncEmails } from "@/lib/db/schema/dnc";
import { dncDomains } from "@/lib/db/schema/dnc";
import { companies } from "@/lib/db/schema/companies";
import { DncTabs, type DncTabsProps } from "./DncTabs";

export const metadata: Metadata = {
  title: "SuperBad — Do Not Contact",
  robots: { index: false, follow: false },
};

export default async function LeadGenSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [rawEmails, rawDomains, rawCompanies] = await Promise.all([
    db
      .select({
        id: dncEmails.id,
        email: dncEmails.email,
        source: dncEmails.source,
        reason: dncEmails.reason,
        added_at: dncEmails.added_at,
      })
      .from(dncEmails)
      .orderBy(desc(dncEmails.added_at)),

    db
      .select({
        id: dncDomains.id,
        domain: dncDomains.domain,
        reason: dncDomains.reason,
        added_at: dncDomains.added_at,
      })
      .from(dncDomains)
      .orderBy(desc(dncDomains.added_at)),

    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.do_not_contact, true))
      .orderBy(asc(companies.name)),
  ]);

  const emails: DncTabsProps["emails"] = rawEmails.map((r) => ({
    id: r.id,
    email: r.email,
    source: r.source,
    reason: r.reason,
    added_at_ms: r.added_at?.getTime() ?? 0,
  }));

  const domains: DncTabsProps["domains"] = rawDomains.map((r) => ({
    id: r.id,
    domain: r.domain,
    reason: r.reason,
    added_at_ms: r.added_at?.getTime() ?? 0,
  }));

  const blockedCompanies: DncTabsProps["companies"] = rawCompanies.map(
    (r) => ({ id: r.id, name: r.name }),
  );

  return (
    <div className="flex flex-col gap-8 p-8">
      <header
        className="flex flex-col gap-2 pb-6"
        style={{ borderBottom: "1px solid rgba(253,245,230,0.05)" }}
      >
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span style={{ color: "var(--color-neutral-600)" }}>·</span>{" "}
          Settings{" "}
          <span style={{ color: "var(--color-neutral-600)" }}>·</span>{" "}
          <span style={{ color: "var(--color-brand-pink)" }}>
            Lead Generation
          </span>
        </div>
        <h1
          className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Do Not Contact.
        </h1>
        <p className="max-w-[560px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Companies, emails, and domains blocked from outreach. The machine
          won&apos;t touch them.
        </p>
        <p className="font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
          some doors you don&apos;t knock on twice.
        </p>
      </header>

      <DncTabs
        companies={blockedCompanies}
        emails={emails}
        domains={domains}
      />
    </div>
  );
}

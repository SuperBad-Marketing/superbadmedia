import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { dncEmails, dncDomains } from "@/lib/db/schema/dnc";
import { companies } from "@/lib/db/schema/companies";
import {
  DncTabs,
  type DncCompany,
  type DncEmail,
  type DncDomain,
} from "./DncTabs";

export const metadata: Metadata = {
  title: "SuperBad — Do Not Contact",
  robots: { index: false, follow: false },
};

export default async function LeadGenSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [blockedCompanies, blockedEmails, blockedDomains] = await Promise.all([
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.do_not_contact, true))
      .orderBy(companies.name),
    db
      .select({
        id: dncEmails.id,
        email: dncEmails.email,
        source: dncEmails.source,
        added_at: dncEmails.added_at,
      })
      .from(dncEmails)
      .orderBy(desc(dncEmails.added_at)),
    db
      .select({
        id: dncDomains.id,
        domain: dncDomains.domain,
        added_at: dncDomains.added_at,
      })
      .from(dncDomains)
      .orderBy(desc(dncDomains.added_at)),
  ]);

  const companiesForClient: DncCompany[] = blockedCompanies;

  const emailsForClient: DncEmail[] = blockedEmails.map((r) => ({
    id: r.id,
    email: r.email,
    source: r.source,
    added_at_ms: r.added_at ? r.added_at.getTime() : null,
  }));

  const domainsForClient: DncDomain[] = blockedDomains.map((r) => ({
    id: r.id,
    domain: r.domain,
    added_at_ms: r.added_at ? r.added_at.getTime() : null,
  }));

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page header */}
      <header
        className="pb-6"
        style={{ borderBottom: "1px solid rgba(253,245,230,0.05)" }}
      >
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span style={{ color: "var(--color-neutral-600)" }}>/</span>{" "}
          Settings{" "}
          <span style={{ color: "var(--color-neutral-600)" }}>/</span>{" "}
          <span style={{ color: "var(--color-brand-pink)" }}>
            Lead Generation
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Do Not Contact
        </h1>
        <p className="mt-3 max-w-[560px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Everyone who has opted out, complained, or been flagged. The machine
          skips these without asking.
        </p>
        <p className="mt-2 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
          once on the list, they stay off the list.
        </p>
      </header>

      {/* DNC tabs */}
      <section aria-labelledby="dnc-heading">
        <h2 id="dnc-heading" className="sr-only">
          Do Not Contact lists
        </h2>
        <DncTabs
          companies={companiesForClient}
          emails={emailsForClient}
          domains={domainsForClient}
        />
      </section>
    </div>
  );
}

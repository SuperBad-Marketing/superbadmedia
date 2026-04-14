/**
 * /lite/admin/companies/[id] — thin Company admin view.
 * Spec: docs/specs/sales-pipeline.md §9 (Trial Shoot panel).
 *
 * Scope is intentionally narrow: header + Trial Shoot panel only. The
 * Client Management spec owns the full Company profile (contacts, deals,
 * billing tabs); this route reserves the URL so that spec extends rather
 * than replaces.
 */
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";

import { TrialShootPanel } from "@/components/lite/company/trial-shoot-panel";

export const metadata: Metadata = {
  title: "SuperBad — Company",
  robots: { index: false, follow: false },
};

export default async function CompanyAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .get();
  if (!company) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-6">
      <div className="mb-6 space-y-2">
        <Link
          href="/lite/admin/pipeline"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Pipeline
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[company.shape, company.domain].filter(Boolean).join(" · ") ||
              "No shape or domain recorded."}
          </p>
        </div>
      </div>

      <TrialShootPanel
        companyId={company.id}
        initialStatus={company.trial_shoot_status}
        initialPlan={company.trial_shoot_plan}
        completedAtMs={company.trial_shoot_completed_at_ms}
        feedback={company.trial_shoot_feedback}
      />
    </main>
  );
}

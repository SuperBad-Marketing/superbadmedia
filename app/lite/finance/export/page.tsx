import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ne, desc } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { finance_exports } from "@/lib/db/schema/finance-exports";
import { getAllPresets } from "@/lib/finance/export-periods";
import { ExportClient } from "@/components/lite/finance/export-client";

export const metadata: Metadata = {
  title: "SuperBad — Finance Export",
  robots: { index: false, follow: false },
};

export default async function ExportPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const presets = getAllPresets();
  const pastExports = db
    .select()
    .from(finance_exports)
    .where(ne(finance_exports.status, "purged"))
    .orderBy(desc(finance_exports.created_at_ms))
    .limit(20)
    .all();

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <Link
          href="/lite/finance"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          ← Finance
        </Link>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Export
        </h1>
        <p className="mt-2 font-[family-name:var(--font-body)] text-sm text-[color:var(--color-neutral-400)]">
          BAS summary, P&amp;L, transactions, expenses, invoices, and per-client revenue — all in one zip.
        </p>
      </header>

      <div className="px-4 pb-10">
        <ExportClient presets={presets} pastExports={pastExports} />
      </div>
    </div>
  );
}

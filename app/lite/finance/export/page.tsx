import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth/session";
import { EmptyState } from "@/components/lite/empty-state";

export const metadata: Metadata = {
  title: "SuperBad — Finance Export",
  robots: { index: false, follow: false },
};

export default async function ExportPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

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
      </header>

      <div className="px-4 pb-10">
        <EmptyState
          hero="EXPORT"
          message="Accountant bundle export lands in Session D. BAS summary PDF, transactions CSV, expenses CSV, invoices CSV, P&L PDF, and per-client revenue CSV — all in one zip."
        />
      </div>
    </div>
  );
}

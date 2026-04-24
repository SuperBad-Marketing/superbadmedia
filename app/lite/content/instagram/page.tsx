import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { instagram_accounts } from "@/lib/db/schema/instagram";
import { ContentTabs } from "../_components/content-tabs";
import { InstagramDashboardClient } from "./_components/instagram-dashboard-client";

export const metadata: Metadata = {
  title: "SuperBad — Instagram",
  robots: { index: false, follow: false },
};

export default async function InstagramPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const accounts = await db
    .select()
    .from(instagram_accounts)
    .where(eq(instagram_accounts.status, "active"))
    .all();

  return (
    <div className="min-h-screen bg-[color:var(--color-neutral-950)]">
      <div className="mx-auto max-w-[1200px] px-6">
        <header className="pt-6 pb-2">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Content{" "}
            <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
            <span className="text-[color:var(--color-brand-pink)]">
              Instagram
            </span>
          </div>
          <h1
            className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            Instagram
          </h1>
          <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
            Publish, measure, optimise.{" "}
            <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
              the flywheel.
            </em>
          </p>
        </header>

        <ContentTabs currentPath="/lite/content/instagram" />

        <InstagramDashboardClient
          accounts={accounts.map((a) => ({
            id: a.id,
            username: a.username,
            account_type: a.account_type,
            status: a.status,
          }))}
        />
      </div>
    </div>
  );
}

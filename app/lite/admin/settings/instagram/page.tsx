import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { instagram_watched_accounts } from "@/lib/db/schema/instagram-competitive";
import { WatchedAccountsClient } from "./_components/watched-accounts-client";

export const metadata: Metadata = {
  title: "SuperBad — Instagram Settings",
  robots: { index: false, follow: false },
};

export default async function InstagramSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const accounts = await db
    .select()
    .from(instagram_watched_accounts)
    .where(eq(instagram_watched_accounts.status, "active"))
    .all();

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Settings{" "}
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
          Watched accounts for competitive intelligence.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            know the room before you walk in.
          </em>
        </p>
      </header>

      <div className="px-4 pb-8">
        <Link
          href="/lite/admin/settings"
          className="mb-4 inline-block font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
        >
          ← Settings
        </Link>

        <WatchedAccountsClient
          accounts={accounts.map((a) => ({
            id: a.id,
            username: a.username,
            displayName: a.display_name,
            category: a.category,
            followers: a.followers,
            postsScraped: a.posts_scraped,
            avgEngagementRate: a.avg_engagement_rate,
            lastScrapedAtMs: a.last_scraped_at_ms,
          }))}
        />
      </div>
    </div>
  );
}

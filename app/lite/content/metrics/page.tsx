/**
 * /lite/content/metrics — Content Engine metrics admin tab (CE-10).
 *
 * Spec: docs/specs/content-engine.md §8.1.
 * Shows: post counts, ranking trends, newsletter open/click rates,
 * list growth, social draft counts.
 *
 * Admin-only.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { getContentMetrics } from "@/lib/content-engine/metrics";
import { ContentTabs } from "../_components/content-tabs";
import { RankingTrendRow } from "../_components/ranking-trend-row";

export const metadata: Metadata = {
  title: "Content Metrics — SuperBad",
};

export default async function MetricsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  // Admin view: all companies
  const metrics = await getContentMetrics(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ContentTabs currentPath="/lite/content/metrics" />

      {/* Summary cards */}
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Published" value={metrics.posts.published} />
        <StatCard label="In Review" value={metrics.posts.inReview} />
        <StatCard
          label="Subscribers"
          value={metrics.subscribers.active}
          sub={`of ${metrics.subscribers.total} total`}
        />
        <StatCard
          label="Social Published"
          value={metrics.social.published}
          sub={`${metrics.social.ready} ready`}
        />
      </div>

      {/* Newsletter stats */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Newsletter</h2>
        {metrics.newsletter.totalSends === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No newsletters sent yet.
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-4">
              <StatCard
                label="Sends"
                value={metrics.newsletter.totalSends}
              />
              <StatCard
                label="Opens"
                value={metrics.newsletter.totalOpens}
              />
              <StatCard
                label="Clicks"
                value={metrics.newsletter.totalClicks}
              />
            </div>
            <div className="rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Subject</th>
                    <th className="px-4 py-2 font-medium">Sent</th>
                    <th className="px-4 py-2 font-medium text-right">
                      Recipients
                    </th>
                    <th className="px-4 py-2 font-medium text-right">
                      Opens
                    </th>
                    <th className="px-4 py-2 font-medium text-right">
                      Clicks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.newsletter.recentSends.map((send) => (
                    <tr
                      key={send.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="max-w-[200px] truncate px-4 py-2">
                        {send.subject}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {send.sentAtMs
                          ? new Date(send.sentAtMs).toLocaleDateString(
                              "en-AU",
                              { day: "numeric", month: "short" },
                            )
                          : "Scheduled"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {send.recipientCount ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {send.openCount}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {send.clickCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Subscriber breakdown */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Subscriber List Health</h2>
        {metrics.subscribers.total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No subscribers yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard
              label="Active"
              value={metrics.subscribers.active}
            />
            <StatCard
              label="Pending"
              value={metrics.subscribers.pendingConfirmation}
            />
            <StatCard
              label="Bounced"
              value={metrics.subscribers.bounced}
            />
            <StatCard
              label="Unsubscribed"
              value={metrics.subscribers.unsubscribed}
            />
            <StatCard
              label="Inactive Removed"
              value={metrics.subscribers.inactiveRemoved}
            />
          </div>
        )}
      </section>

      {/* Ranking trends */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Ranking Trends</h2>
        {metrics.rankings.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No ranking data yet.
          </p>
        ) : (
          <div className="rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Keyword</th>
                  <th className="px-4 py-2 font-medium text-right">
                    Entry
                  </th>
                  <th className="px-4 py-2 font-medium text-right">
                    Current
                  </th>
                  <th className="px-4 py-2 font-medium text-right">Peak</th>
                  <th className="px-4 py-2 font-medium text-right">
                    Direction
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.rankings.map((r) => (
                  <RankingTrendRow key={r.blogPostId} trend={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && (
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

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
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Content · Metrics
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Metrics
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          The engine&apos;s vital signs.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            numbers that matter, nothing that doesn&apos;t.
          </em>
        </p>
      </header>

      <ContentTabs currentPath="/lite/content/metrics" />

      {/* Summary cards */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Published" value={metrics.posts.published} />
        <StatCard label="In Review" value={metrics.posts.inReview} accent={metrics.posts.inReview > 0} />
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
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Newsletter
        </div>
        {metrics.newsletter.totalSends === 0 ? (
          <div
            className="rounded-[12px] px-8 py-10 text-center"
            style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
          >
            <p className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "-0.2px" }}>
              No newsletters sent yet.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
              the inbox is patient.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <StatCard label="Sends" value={metrics.newsletter.totalSends} />
              <StatCard label="Opens" value={metrics.newsletter.totalOpens} />
              <StatCard label="Clicks" value={metrics.newsletter.totalClicks} />
            </div>
            <div
              className="overflow-hidden rounded-[12px]"
              style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
            >
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    {["Subject", "Sent", "Recipients", "Opens", "Clicks"].map((h, i) => (
                      <th
                        key={h}
                        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                        style={{
                          letterSpacing: "2px",
                          padding: "12px 14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                          textAlign: i >= 2 ? "right" : "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.newsletter.recentSends.map((send) => (
                    <tr
                      key={send.id}
                      className="transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.025)]"
                      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
                    >
                      <td className="max-w-[200px] truncate px-[14px] py-[14px] font-medium text-[color:var(--color-brand-cream)]">
                        {send.subject}
                      </td>
                      <td className="px-[14px] py-[14px] text-[12px] italic text-[color:var(--color-brand-pink)]">
                        {send.sentAtMs
                          ? new Date(send.sentAtMs).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
                          : "Scheduled"}
                      </td>
                      <td className="px-[14px] py-[14px] text-right font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "1px" }}>
                        {send.recipientCount ?? "\u2014"}
                      </td>
                      <td className="px-[14px] py-[14px] text-right font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "1px" }}>
                        {send.openCount}
                      </td>
                      <td className="px-[14px] py-[14px] text-right font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "1px" }}>
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
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Subscriber List Health
        </div>
        {metrics.subscribers.total === 0 ? (
          <div
            className="rounded-[12px] px-8 py-10 text-center"
            style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
          >
            <p className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "-0.2px" }}>
              No subscribers yet.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
              build it and they&apos;ll come. probably.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Active" value={metrics.subscribers.active} />
            <StatCard label="Pending" value={metrics.subscribers.pendingConfirmation} />
            <StatCard label="Bounced" value={metrics.subscribers.bounced} accent={metrics.subscribers.bounced > 0} />
            <StatCard label="Unsubscribed" value={metrics.subscribers.unsubscribed} />
            <StatCard label="Inactive Removed" value={metrics.subscribers.inactiveRemoved} />
          </div>
        )}
      </section>

      {/* Ranking trends */}
      <section>
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Ranking Trends
        </div>
        {metrics.rankings.length === 0 ? (
          <div
            className="rounded-[12px] px-8 py-10 text-center"
            style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
          >
            <p className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "-0.2px" }}>
              No ranking data yet.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
              publish something and google will notice.
            </p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-[12px]"
            style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  {["Keyword", "Entry", "Current", "Peak", "Direction"].map((h, i) => (
                    <th
                      key={h}
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                      style={{
                        letterSpacing: "2px",
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                        textAlign: i >= 1 ? "right" : "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
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
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-[10px] px-4 py-3"
      style={{
        background: accent
          ? "linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))"
          : "var(--color-surface-2)",
        border: accent
          ? "1px solid rgba(178, 40, 72, 0.25)"
          : "1px solid rgba(253, 245, 230, 0.05)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </div>
      <div
        className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-none tabular-nums"
        style={{
          color: accent ? "var(--color-brand-orange)" : "var(--color-brand-cream)",
          letterSpacing: "-0.3px",
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[12px] italic text-[color:var(--color-brand-pink)]">
          {sub}
        </div>
      )}
    </div>
  );
}

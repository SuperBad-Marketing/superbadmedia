/**
 * /lite/content/subscribers — Subscriber fleet overview (CE-11).
 *
 * Spec: docs/specs/content-engine.md §8.2.
 *
 * Admin-only. Summary cards + compact list of subscriber companies
 * with engine status, post count, list size, last review date.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import {
  getFleetSummary,
  getFleetList,
  type EngineStatus,
} from "@/lib/content-engine/fleet-overview";

export const metadata: Metadata = {
  title: "Content Subscribers — SuperBad",
};

const STATUS_STYLES: Record<
  EngineStatus,
  { label: string; bg: string; color: string }
> = {
  healthy: {
    label: "Healthy",
    bg: "rgba(123, 174, 126, 0.14)",
    color: "var(--color-success)",
  },
  draft_waiting: {
    label: "Draft waiting",
    bg: "rgba(242, 140, 82, 0.15)",
    color: "var(--color-brand-orange)",
  },
  domain_not_verified: {
    label: "Domain pending",
    bg: "rgba(178, 40, 72, 0.18)",
    color: "var(--color-brand-pink)",
  },
  list_declining: {
    label: "List declining",
    bg: "rgba(242, 140, 82, 0.18)",
    color: "var(--color-brand-orange)",
  },
};

export default async function SubscribersFleetPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [summary, fleet] = await Promise.all([
    getFleetSummary(),
    getFleetList(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Content · Subscribers
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Subscribers
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Fleet overview — every content engine subscriber.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {summary.subscribersWithUnreviewedDrafts > 0
              ? "some have drafts waiting."
              : "all engines running."}
          </em>
        </p>
      </header>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FleetStatCard label="Subscribers" value={summary.totalSubscribers} />
        <FleetStatCard label="Posts this month" value={summary.postsPublishedThisMonth} />
        <FleetStatCard label="Aggregate list" value={summary.aggregateListSize} />
        <FleetStatCard
          label="Drafts waiting"
          value={summary.subscribersWithUnreviewedDrafts}
          accent={summary.subscribersWithUnreviewedDrafts > 0}
        />
      </div>

      {/* Fleet list */}
      {fleet.length === 0 ? (
        <div
          className="rounded-[12px] px-8 py-10 text-center"
          style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
        >
          <p className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "-0.2px" }}>
            No subscribers yet.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
            onboard a client and they&apos;ll show up here.
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden overflow-x-auto rounded-[12px]"
          style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                {[
                  { label: "Company", align: "left" as const },
                  { label: "Status", align: "left" as const },
                  { label: "Posts", align: "right" as const },
                  { label: "List size", align: "right" as const },
                  { label: "Last review", align: "left" as const },
                ].map((h) => (
                  <th
                    key={h.label}
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      padding: "12px 14px",
                      borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                      textAlign: h.align,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fleet.map((row) => {
                const statusInfo = STATUS_STYLES[row.engineStatus];
                return (
                  <tr
                    key={row.companyId}
                    className="transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.025)]"
                    style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
                  >
                    <td className="px-[14px] py-[14px] font-medium text-[color:var(--color-brand-cream)]">
                      {row.companyName}
                    </td>
                    <td className="px-[14px] py-[14px]">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
                        style={{
                          letterSpacing: "1.5px",
                          background: statusInfo.bg,
                          color: statusInfo.color,
                        }}
                      >
                        <span aria-hidden className="h-1 w-1 rounded-full" style={{ background: "currentColor", opacity: 0.85 }} />
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-[14px] py-[14px] text-right font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "1px" }}>
                      {row.postCount}
                    </td>
                    <td className="px-[14px] py-[14px] text-right font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "1px" }}>
                      {row.listSize}
                    </td>
                    <td className="px-[14px] py-[14px] text-[12px] italic text-[color:var(--color-brand-pink)]">
                      {row.lastReviewDateMs
                        ? new Date(row.lastReviewDateMs).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FleetStatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
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
    </div>
  );
}

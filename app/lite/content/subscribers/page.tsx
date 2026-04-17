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

const STATUS_STYLES: Record<EngineStatus, { label: string; className: string }> =
  {
    healthy: {
      label: "Healthy",
      className: "bg-emerald-100 text-emerald-800",
    },
    draft_waiting: {
      label: "Draft waiting",
      className: "bg-amber-100 text-amber-800",
    },
    domain_not_verified: {
      label: "Domain pending",
      className: "bg-red-100 text-red-800",
    },
    list_declining: {
      label: "List declining",
      className: "bg-orange-100 text-orange-800",
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
      <h1 className="mb-6 text-lg font-semibold">Content Engine subscribers</h1>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Subscribers" value={summary.totalSubscribers} />
        <SummaryCard
          label="Posts this month"
          value={summary.postsPublishedThisMonth}
        />
        <SummaryCard
          label="Aggregate list"
          value={summary.aggregateListSize}
        />
        <SummaryCard
          label="Drafts waiting"
          value={summary.subscribersWithUnreviewedDrafts}
          warn={summary.subscribersWithUnreviewedDrafts > 0}
        />
      </div>

      {/* Fleet list */}
      {fleet.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No content engine subscribers yet.
        </p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Posts</th>
                <th className="px-4 py-2 font-medium text-right">
                  List size
                </th>
                <th className="px-4 py-2 font-medium">Last review</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((row) => {
                const statusInfo = STATUS_STYLES[row.engineStatus];
                return (
                  <tr
                    key={row.companyId}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2 font-medium">
                      {row.companyName}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.postCount}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.listSize}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {row.lastReviewDateMs
                        ? new Date(row.lastReviewDateMs).toLocaleDateString(
                            "en-AU",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )
                        : "—"}
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

function SummaryCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          warn ? "text-amber-600" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

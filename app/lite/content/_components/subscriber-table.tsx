"use client";

/**
 * Subscriber list table with status badges and consent source labels (CE-11).
 *
 * Read-only. Spec §4.3: "Subscriber sees a read-only list health panel."
 * Admin surface: shows all subscribers with status, source, and last open.
 */

import type { SubscriberListItem } from "@/lib/content-engine/subscriber-list";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending_confirmation: "bg-amber-100 text-amber-800",
  bounced: "bg-red-100 text-red-800",
  unsubscribed: "bg-neutral-200 text-neutral-600",
  inactive_removed: "bg-neutral-200 text-neutral-500",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending_confirmation: "Pending",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
  inactive_removed: "Inactive",
};

const SOURCE_LABELS: Record<string, string> = {
  csv_import: "CSV",
  embed_form: "Form",
  blog_cta: "Blog",
  outreach_reply: "Outreach",
  permission_pass: "Permission",
};

interface SubscriberTableProps {
  subscribers: SubscriberListItem[];
}

export function SubscriberTable({ subscribers }: SubscriberTableProps) {
  if (subscribers.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No subscribers yet.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Source</th>
            <th className="px-4 py-2 font-medium text-right">Bounces</th>
            <th className="px-4 py-2 font-medium">Last open</th>
            <th className="px-4 py-2 font-medium">Added</th>
          </tr>
        </thead>
        <tbody>
          {subscribers.map((sub) => (
            <tr
              key={sub.id}
              className="border-b border-border last:border-0"
            >
              <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs">
                {sub.email}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {sub.name ?? "—"}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[sub.status] ?? "bg-neutral-100"}`}
                >
                  {STATUS_LABELS[sub.status] ?? sub.status}
                </span>
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {SOURCE_LABELS[sub.consentSource] ?? sub.consentSource}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {sub.bounceCount}
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {sub.lastOpenedAtMs
                  ? new Date(sub.lastOpenedAtMs).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })
                  : "—"}
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {new Date(sub.createdAtMs).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

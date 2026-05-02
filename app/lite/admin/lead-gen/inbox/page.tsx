import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getInboxItems, getInboxSummary } from "@/lib/lead-gen/queries";
import { LeadGenTabs } from "../_components/lead-gen-tabs";
import { InboxList } from "./_components/inbox-list";

export const metadata: Metadata = {
  title: "Inbox — Lead Gen — SuperBad",
};

function MetricCell({
  label,
  value,
  rate,
  color,
}: {
  label: string;
  value: number;
  rate?: number;
  color?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-3 py-3"
      style={{ backgroundColor: "var(--color-surface-2)" }}
    >
      <span
        className="font-[family-name:var(--font-display)] text-[22px] leading-none"
        style={{ color: color ?? "var(--color-brand-cream)" }}
      >
        {value}
      </span>
      <span
        className="font-[family-name:var(--font-label)] text-[9px] uppercase"
        style={{ letterSpacing: "1.2px", color: "var(--color-neutral-500)" }}
      >
        {label}
      </span>
      {rate !== undefined && (
        <span
          className="font-[family-name:var(--font-body)] text-[11px]"
          style={{ color: color ?? "var(--color-neutral-400)" }}
        >
          {rate}%
        </span>
      )}
    </div>
  );
}

export default async function LeadGenInboxPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [items, summary] = await Promise.all([
    getInboxItems(200),
    getInboxSummary(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Lead Gen · Inbox
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Inbox
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Every outreach email and reply, in one place.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {summary.pendingReplyDrafts > 0
              ? `${summary.pendingReplyDrafts} reply draft${summary.pendingReplyDrafts === 1 ? "" : "s"} waiting for your eyes.`
              : "all quiet on the western front."}
          </em>
        </p>
        {summary.totalSent > 0 ? (
          <div
            className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl sm:grid-cols-6"
            style={{ backgroundColor: "rgba(253, 245, 230, 0.04)" }}
          >
            <MetricCell label="Sent" value={summary.totalSent} />
            <MetricCell
              label="Delivered"
              value={summary.totalDelivered}
              rate={summary.deliveryRate}
              color="#86efac"
            />
            <MetricCell
              label="Opened"
              value={summary.totalOpened}
              rate={summary.openRate}
              color="#93c5fd"
            />
            <MetricCell
              label="Clicked"
              value={summary.totalClicked}
              rate={summary.clickRate}
              color="#c084fc"
            />
            <MetricCell
              label="Replied"
              value={summary.totalReplied}
              rate={summary.replyRate}
              color="#fbbf24"
            />
            <MetricCell
              label="Bounced"
              value={summary.totalBounced}
              rate={summary.bounceRate}
              color="#fca5a5"
            />
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-6 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
            <span>No emails sent yet.</span>
          </div>
        )}
        {summary.pendingReplyDrafts > 0 && (
          <div className="mt-3 flex items-center gap-2 font-[family-name:var(--font-body)] text-[12px]">
            <span
              className="font-[family-name:var(--font-label)] uppercase"
              style={{ letterSpacing: "1.5px", color: "var(--color-brand-pink)" }}
            >
              {summary.pendingReplyDrafts}
            </span>
            <span style={{ color: "var(--color-brand-pink)" }}>
              reply draft{summary.pendingReplyDrafts === 1 ? "" : "s"} pending
            </span>
          </div>
        )}
      </header>
      <LeadGenTabs currentPath="/lite/admin/lead-gen/inbox" />

      {items.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-[28px] text-[color:var(--color-brand-cream)]">
            Nothing here yet.
          </p>
          <p className="mt-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            Send an outreach email to a candidate and it'll show up here.
          </p>
        </div>
      ) : (
        <div className="px-4">
          <InboxList items={JSON.parse(JSON.stringify(items))} />
        </div>
      )}
    </div>
  );
}

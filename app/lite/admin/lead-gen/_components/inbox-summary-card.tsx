import Link from "next/link";
import { getInboxItems, getInboxSummary } from "@/lib/lead-gen/queries";
import type { InboxItem } from "@/lib/lead-gen/queries/inbox";

const MELB_TZ = "Australia/Melbourne";

function formatRelative(d: Date | number): string {
  const now = Date.now();
  const ms = typeof d === "number" ? d : new Date(d).getTime();
  const diffMin = Math.floor((now - ms) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function itemTime(item: InboxItem): Date | number {
  if (item.kind === "sent") return item.sentAt;
  if (item.kind === "rundown") return item.sentAtMs;
  return item.createdAtMs;
}

function itemLabel(item: InboxItem): string {
  if (item.kind === "sent") return item.companyName;
  if (item.kind === "rundown") return item.businessName;
  return item.companyName;
}

const BADGE_STYLES: Record<InboxItem["kind"], { bg: string; color: string; label: string }> = {
  sent: { bg: "rgba(168, 85, 247, 0.1)", color: "#c084fc", label: "Sent" },
  rundown: { bg: "rgba(244, 160, 176, 0.1)", color: "#f4a0b0", label: "Rundown" },
  reply: { bg: "rgba(34, 197, 94, 0.1)", color: "#86efac", label: "Reply" },
};

function ItemRow({ item }: { item: InboxItem }) {
  const time = formatRelative(itemTime(item));
  const badge = BADGE_STYLES[item.kind];
  const href = item.kind === "rundown"
    ? "/lite/admin/lead-gen/inbox"
    : `/lite/admin/lead-gen/candidates/${item.candidateId}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[rgba(253,245,230,0.03)]"
    >
      <span
        className="inline-block w-[52px] shrink-0 rounded-full px-1.5 py-0.5 text-center font-[family-name:var(--font-label)] text-[8px] uppercase"
        style={{
          letterSpacing: "1px",
          backgroundColor: badge.bg,
          color: badge.color,
        }}
      >
        {badge.label}
      </span>
      <span className="flex-1 min-w-0 truncate font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)]">
        {itemLabel(item)}
      </span>
      {item.kind === "reply" && (
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
          style={{
            letterSpacing: "1px",
            backgroundColor:
              item.classification === "positive"
                ? "rgba(34, 197, 94, 0.12)"
                : item.classification === "negative"
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(253, 245, 230, 0.06)",
            color:
              item.classification === "positive"
                ? "#86efac"
                : item.classification === "negative"
                  ? "#fca5a5"
                  : "var(--color-neutral-500)",
          }}
        >
          {item.classification.replace(/_/g, " ")}
        </span>
      )}
      {(item.kind === "sent" || item.kind === "rundown") && item.openCount > 0 && (
        <span className="shrink-0 font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
          {item.openCount} open{item.openCount === 1 ? "" : "s"}
        </span>
      )}
      <span className="shrink-0 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
        {time}
      </span>
    </Link>
  );
}

export async function InboxSummaryCard() {
  const [items, summary] = await Promise.all([
    getInboxItems(5),
    getInboxSummary(),
  ]);

  if (summary.totalSent === 0 && summary.totalReplies === 0) return null;

  return (
    <div
      className="mb-6 rounded-xl p-4"
      style={{
        backgroundColor: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Outreach activity
          </span>
          <div className="flex items-center gap-3 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
            <span>{summary.totalSent} sent</span>
            <span>{summary.totalReplies} replies</span>
            {summary.pendingReplyDrafts > 0 && (
              <span style={{ color: "var(--color-brand-pink)" }}>
                {summary.pendingReplyDrafts} pending
              </span>
            )}
          </div>
        </div>
        <Link
          href="/lite/admin/lead-gen/inbox"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-pink)] transition-colors"
          style={{ letterSpacing: "1.2px" }}
        >
          View all &rarr;
        </Link>
      </div>

      <div className="flex flex-col">
        {items.map((item) => (
          <ItemRow key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

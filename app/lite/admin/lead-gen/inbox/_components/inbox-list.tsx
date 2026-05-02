"use client";

import { useState } from "react";
import Link from "next/link";
import type { InboxItem } from "@/lib/lead-gen/queries/inbox";

type FilterKind = "all" | "sent" | "rundown" | "reply";

const MELB_TZ = "Australia/Melbourne";
const DATE_FMT: Intl.DateTimeFormatOptions = {
  timeZone: MELB_TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function formatDate(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : new Date(d);
  return new Intl.DateTimeFormat("en-AU", DATE_FMT).format(date);
}

function ClassificationBadge({ classification }: { classification: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    positive: { bg: "rgba(34, 197, 94, 0.12)", text: "#86efac" },
    question: { bg: "rgba(59, 130, 246, 0.12)", text: "#93c5fd" },
    objection: { bg: "rgba(245, 158, 11, 0.12)", text: "#fcd34d" },
    negative: { bg: "rgba(239, 68, 68, 0.12)", text: "#fca5a5" },
    auto_responder: { bg: "rgba(253, 245, 230, 0.06)", text: "var(--color-neutral-500)" },
  };
  const c = colors[classification] ?? colors.auto_responder;

  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{ letterSpacing: "1.2px", backgroundColor: c.bg, color: c.text }}
    >
      {classification.replace(/_/g, " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPending = status === "pending_approval";
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{
        letterSpacing: "1.2px",
        backgroundColor: isPending ? "rgba(245, 158, 11, 0.12)" : "rgba(253, 245, 230, 0.06)",
        color: isPending ? "#fcd34d" : "var(--color-neutral-500)",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function DeliveryTimeline({
  deliveredAt,
  openCount,
  clickCount,
  repliedAt,
  bouncedAt,
}: {
  deliveredAt: Date | null;
  openCount: number;
  clickCount: number;
  repliedAt: Date | null;
  bouncedAt: Date | null;
}) {
  if (bouncedAt) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{ letterSpacing: "1.2px", backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#fca5a5" }}
        >
          Bounced
        </span>
      </div>
    );
  }

  const steps: Array<{ label: string; active: boolean; color: string }> = [
    { label: "Sent", active: true, color: "var(--color-neutral-400)" },
    { label: "Delivered", active: !!deliveredAt, color: "#86efac" },
    { label: "Opened", active: openCount > 0, color: "#93c5fd" },
    { label: "Clicked", active: clickCount > 0, color: "#c084fc" },
    { label: "Replied", active: !!repliedAt, color: "#fbbf24" },
  ];

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          {i > 0 && (
            <div
              className="h-px w-2"
              style={{
                backgroundColor: step.active
                  ? "rgba(253, 245, 230, 0.15)"
                  : "rgba(253, 245, 230, 0.05)",
              }}
            />
          )}
          <span
            className="font-[family-name:var(--font-label)] text-[8px] uppercase"
            style={{
              letterSpacing: "1px",
              color: step.active ? step.color : "var(--color-neutral-600)",
            }}
          >
            {step.label}
            {step.label === "Opened" && openCount > 1 ? ` (${openCount})` : ""}
            {step.label === "Clicked" && clickCount > 1 ? ` (${clickCount})` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function SentCard({ item }: { item: Extract<InboxItem, { kind: "sent" }> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl p-4 transition-all duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        backgroundColor: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: "rgba(168, 85, 247, 0.1)",
                color: "#c084fc",
              }}
            >
              Sent
            </span>
            <span
              className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: "rgba(253, 245, 230, 0.04)",
                color: "var(--color-neutral-500)",
              }}
            >
              {item.touchKind.replace(/_/g, " ")} #{item.touchIndex}
            </span>
            <DeliveryTimeline
              deliveredAt={item.deliveredAt}
              openCount={item.openCount}
              clickCount={item.clickCount}
              repliedAt={item.repliedAt}
              bouncedAt={item.bouncedAt}
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Link
              href={`/lite/admin/lead-gen/candidates/${item.candidateId}`}
              className="font-[family-name:var(--font-display)] text-[18px] leading-tight text-[color:var(--color-brand-cream)] hover:text-[color:var(--color-brand-pink)] transition-colors"
            >
              {item.companyName}
            </Link>
            {item.contactEmail && (
              <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                {item.contactEmail}
              </span>
            )}
          </div>

          <p className="mt-1 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-300)]">
            {item.subject}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
            {formatDate(item.sentAt)}
          </div>
        </div>
      </div>

      {expanded && (
        <div
          className="mt-3 rounded-lg p-3 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)] whitespace-pre-wrap"
          style={{ backgroundColor: "rgba(253, 245, 230, 0.02)" }}
        >
          {item.bodyMarkdown}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-pink)] transition-colors cursor-pointer"
        style={{ letterSpacing: "1.2px" }}
      >
        {expanded ? "Collapse" : "Show email"}
      </button>
    </div>
  );
}

function RundownTimeline({
  openCount,
  clickedAtMs,
  repliedAtMs,
}: {
  openCount: number;
  clickedAtMs: number | null;
  repliedAtMs: number | null;
}) {
  const steps: Array<{ label: string; active: boolean; color: string }> = [
    { label: "Sent", active: true, color: "var(--color-neutral-400)" },
    { label: "Opened", active: openCount > 0, color: "#93c5fd" },
    { label: "Clicked", active: !!clickedAtMs, color: "#c084fc" },
    { label: "Replied", active: !!repliedAtMs, color: "#fbbf24" },
  ];

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          {i > 0 && (
            <div
              className="h-px w-2"
              style={{
                backgroundColor: step.active
                  ? "rgba(253, 245, 230, 0.15)"
                  : "rgba(253, 245, 230, 0.05)",
              }}
            />
          )}
          <span
            className="font-[family-name:var(--font-label)] text-[8px] uppercase"
            style={{
              letterSpacing: "1px",
              color: step.active ? step.color : "var(--color-neutral-600)",
            }}
          >
            {step.label}
            {step.label === "Opened" && openCount > 1 ? ` (${openCount})` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function RundownCard({ item }: { item: Extract<InboxItem, { kind: "rundown" }> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl p-4 transition-all duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        backgroundColor: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: "rgba(244, 160, 176, 0.1)",
                color: "#f4a0b0",
              }}
            >
              Rundown
            </span>
            <span
              className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: "rgba(253, 245, 230, 0.04)",
                color: "var(--color-neutral-500)",
              }}
            >
              email #{item.emailNumber}
            </span>
            <RundownTimeline
              openCount={item.openCount}
              clickedAtMs={item.clickedAtMs}
              repliedAtMs={item.repliedAtMs}
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="font-[family-name:var(--font-display)] text-[18px] leading-tight text-[color:var(--color-brand-cream)]">
              {item.businessName}
            </span>
            <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
              {item.contactEmail}
            </span>
          </div>

          <p className="mt-1 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-300)]">
            {item.subject ?? "No subject"}
          </p>

          {item.replyClassification && (
            <div className="mt-1.5">
              <ClassificationBadge classification={item.replyClassification} />
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
            {formatDate(item.sentAtMs)}
          </div>
        </div>
      </div>

      {expanded && item.bodyHtml && (
        <div
          className="mt-3 rounded-lg p-3 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)]"
          style={{ backgroundColor: "rgba(253, 245, 230, 0.02)" }}
          dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
        />
      )}

      {item.bodyHtml && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-pink)] transition-colors cursor-pointer"
          style={{ letterSpacing: "1.2px" }}
        >
          {expanded ? "Collapse" : "Show email"}
        </button>
      )}
    </div>
  );
}

function ReplyCard({ item }: { item: Extract<InboxItem, { kind: "reply" }> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl p-4 transition-all duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        backgroundColor: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: item.responseStatus === "pending_approval"
          ? "1px solid rgba(245, 158, 11, 0.15)"
          : "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                color: "#86efac",
              }}
            >
              Reply
            </span>
            <ClassificationBadge classification={item.classification} />
            <StatusBadge status={item.responseStatus} />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Link
              href={`/lite/admin/lead-gen/candidates/${item.candidateId}`}
              className="font-[family-name:var(--font-display)] text-[18px] leading-tight text-[color:var(--color-brand-cream)] hover:text-[color:var(--color-brand-pink)] transition-colors"
            >
              {item.companyName}
            </Link>
            {item.contactEmail && (
              <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                {item.contactEmail}
              </span>
            )}
          </div>

          <div
            className="mt-2 rounded-lg p-2.5 font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-300)]"
            style={{ backgroundColor: "rgba(34, 197, 94, 0.04)" }}
          >
            <span
              className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)] block mb-1"
              style={{ letterSpacing: "1.2px" }}
            >
              Their reply
            </span>
            {item.prospectReplyText.length > 200 && !expanded
              ? item.prospectReplyText.slice(0, 200) + "..."
              : item.prospectReplyText}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
            {formatDate(item.createdAtMs)}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div
            className="rounded-lg p-3"
            style={{ backgroundColor: "rgba(253, 245, 230, 0.02)" }}
          >
            <span
              className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)] block mb-1"
              style={{ letterSpacing: "1.2px" }}
            >
              Draft response — {item.responseSubject}
            </span>
            <div className="font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)] whitespace-pre-wrap">
              {item.responseBody}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-pink)] transition-colors cursor-pointer"
        style={{ letterSpacing: "1.2px" }}
      >
        {expanded ? "Collapse" : "Show draft response"}
      </button>
    </div>
  );
}

interface InboxListProps {
  items: InboxItem[];
}

export function InboxList({ items }: InboxListProps) {
  const [filter, setFilter] = useState<FilterKind>("all");

  const filtered = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "sent") return item.kind === "sent";
    if (filter === "rundown") return item.kind === "rundown";
    return item.kind === "reply";
  });

  const filterLabels: Record<FilterKind, string> = {
    all: "All",
    sent: "Outreach",
    rundown: "Rundown",
    reply: "Replies",
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-1">
        {(["all", "sent", "rundown", "reply"] as FilterKind[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors cursor-pointer"
            style={{
              letterSpacing: "1.2px",
              backgroundColor: filter === f ? "rgba(253, 245, 230, 0.08)" : "transparent",
              color: filter === f ? "var(--color-brand-cream)" : "var(--color-neutral-500)",
            }}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
              No {filter === "all" ? "activity" : filterLabels[filter].toLowerCase()} yet.
            </p>
          </div>
        ) : (
          filtered.map((item) =>
            item.kind === "sent" ? (
              <SentCard key={`sent-${item.id}`} item={item} />
            ) : item.kind === "rundown" ? (
              <RundownCard key={`rundown-${item.id}`} item={item} />
            ) : (
              <ReplyCard key={`reply-${item.id}`} item={item} />
            ),
          )
        )}
      </div>
    </div>
  );
}

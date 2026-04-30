"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X, ExternalLink, Send, Eye } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { NeedsYouItem } from "@/lib/cockpit/needs-you";
import {
  approveOutreachDraftAction,
  rejectOutreachDraftAction,
  approveInstagramReplyAction,
  approveContentDraftAction,
  rejectContentDraftAction,
} from "@/app/lite/cockpit/actions";

interface ActionPanelProps {
  item: NeedsYouItem;
  onResolved: () => void;
}

export function NeedsYouActionPanel({ item, onResolved }: ActionPanelProps) {
  switch (item.type) {
    case "outreach_draft":
      return <OutreachDraftPanel item={item} onResolved={onResolved} />;
    case "instagram_reply":
      return <InstagramReplyPanel item={item} onResolved={onResolved} />;
    case "content_draft":
      return <ContentDraftPanel item={item} onResolved={onResolved} />;
    case "unreplied_email":
      return <EmailPanel item={item} onResolved={onResolved} />;
    case "support_ticket":
      return <TicketPanel item={item} onResolved={onResolved} />;
    case "draft_quote":
    case "expiring_quote":
      return <QuotePanel item={item} onResolved={onResolved} />;
    default:
      return null;
  }
}

function ActionButton({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant: "approve" | "reject" | "neutral";
  children: React.ReactNode;
}) {
  const colors = {
    approve: {
      bg: "var(--color-semantic-success)",
      text: "var(--color-neutral-950)",
    },
    reject: {
      bg: "var(--color-surface-3)",
      text: "var(--color-neutral-300)",
    },
    neutral: {
      bg: "var(--color-surface-3)",
      text: "var(--color-neutral-300)",
    },
  };

  const c = colors[variant];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={houseSpring}
      className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[13px] font-medium transition-opacity disabled:opacity-40"
      style={{ background: c.bg, color: c.text }}
    >
      {children}
    </motion.button>
  );
}

function OutreachDraftPanel({
  item,
  onResolved,
}: ActionPanelProps) {
  const [pending, startTransition] = useTransition();
  const [editedBody, setEditedBody] = useState(
    (item.meta.bodyMarkdown as string) ?? "",
  );

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approveOutreachDraftAction(item.meta.draftId as string);
      if (res.ok) onResolved();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const res = await rejectOutreachDraftAction(item.meta.draftId as string);
      if (res.ok) onResolved();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
        >
          To
        </span>
        <span
          className="font-[family-name:var(--font-dm-sans)] text-[13px]"
          style={{ color: "var(--color-neutral-300)" }}
        >
          {String(item.meta.contactName ?? item.meta.contactEmail ?? "Unknown")}
        </span>
      </div>
      {typeof item.meta.subject === "string" && (
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
          >
            Subject
          </span>
          <span
            className="font-[family-name:var(--font-dm-sans)] text-[13px]"
            style={{ color: "var(--color-neutral-300)" }}
          >
            {item.meta.subject}
          </span>
        </div>
      )}
      <textarea
        value={editedBody}
        onChange={(e) => setEditedBody(e.target.value)}
        rows={6}
        className="w-full resize-none rounded-lg px-3 py-2.5 font-[family-name:var(--font-dm-sans)] text-[13px] leading-relaxed outline-none transition-colors focus:ring-1 focus:ring-[color:var(--color-brand-orange)]"
        style={{
          background: "var(--color-surface-0)",
          color: "var(--color-neutral-200)",
          border: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      />
      <div className="flex items-center gap-2">
        <ActionButton onClick={handleApprove} disabled={pending} variant="approve">
          <Check size={14} /> Approve & Send
        </ActionButton>
        <ActionButton onClick={handleReject} disabled={pending} variant="reject">
          <X size={14} /> Reject
        </ActionButton>
      </div>
    </div>
  );
}

function InstagramReplyPanel({
  item,
  onResolved,
}: ActionPanelProps) {
  const [pending, startTransition] = useTransition();
  const [editedText, setEditedText] = useState(
    (item.meta.draftText as string) ?? "",
  );

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approveInstagramReplyAction(
        item.meta.replyId as string,
        editedText !== item.meta.draftText ? editedText : undefined,
      );
      if (res.ok) onResolved();
    });
  };

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg px-3 py-2.5"
        style={{
          background: "var(--color-surface-0)",
          border: "1px solid rgba(253, 245, 230, 0.04)",
        }}
      >
        <span
          className="font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{ letterSpacing: "1px", color: "var(--color-brand-pink)" }}
        >
          @{item.meta.inboundAuthor as string} said
        </span>
        <p
          className="mt-1 font-[family-name:var(--font-dm-sans)] text-[13px] leading-relaxed"
          style={{ color: "var(--color-neutral-200)" }}
        >
          {item.meta.inboundText as string}
        </p>
      </div>
      <textarea
        value={editedText}
        onChange={(e) => setEditedText(e.target.value)}
        rows={3}
        placeholder="Draft reply..."
        className="w-full resize-none rounded-lg px-3 py-2.5 font-[family-name:var(--font-dm-sans)] text-[13px] leading-relaxed outline-none transition-colors focus:ring-1 focus:ring-[color:var(--color-brand-pink)]"
        style={{
          background: "var(--color-surface-0)",
          color: "var(--color-neutral-200)",
          border: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      />
      <div className="flex items-center gap-2">
        <ActionButton onClick={handleApprove} disabled={pending} variant="approve">
          <Send size={14} /> Send Reply
        </ActionButton>
        <ActionButton onClick={() => onResolved()} disabled={pending} variant="reject">
          <X size={14} /> Skip
        </ActionButton>
      </div>
    </div>
  );
}

function ContentDraftPanel({
  item,
  onResolved,
}: ActionPanelProps) {
  const [pending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approveContentDraftAction(item.meta.postId as string);
      if (res.ok) onResolved();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const res = await rejectContentDraftAction(
        item.meta.postId as string,
        "Needs revision",
      );
      if (res.ok) onResolved();
    });
  };

  return (
    <div className="space-y-3">
      {typeof item.meta.bodyPreview === "string" && (
        <div
          className="max-h-32 overflow-y-auto rounded-lg px-3 py-2.5"
          style={{
            background: "var(--color-surface-0)",
            border: "1px solid rgba(253, 245, 230, 0.04)",
          }}
        >
          <p
            className="font-[family-name:var(--font-dm-sans)] text-[13px] leading-relaxed"
            style={{ color: "var(--color-neutral-300)" }}
          >
            {item.meta.bodyPreview}
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <ActionButton onClick={handleApprove} disabled={pending} variant="approve">
          <Check size={14} /> Approve
        </ActionButton>
        <ActionButton onClick={handleReject} disabled={pending} variant="reject">
          <X size={14} /> Request Changes
        </ActionButton>
        <a
          href={`/lite/content/${item.meta.postId}`}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 font-[family-name:var(--font-dm-sans)] text-[13px] transition-colors hover:bg-[color:var(--color-surface-3)]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          <Eye size={14} /> Full Preview
        </a>
      </div>
    </div>
  );
}

function EmailPanel({ item, onResolved }: ActionPanelProps) {
  return (
    <div className="space-y-3">
      <p
        className="font-[family-name:var(--font-dm-sans)] text-[13px]"
        style={{ color: "var(--color-neutral-300)" }}
      >
        {String(item.meta.contactName ?? "Someone")} is waiting on a reply
        {item.meta.subject ? ` re: ${String(item.meta.subject)}` : ""}.
      </p>
      <div className="flex items-center gap-2">
        <a
          href={`/lite/inbox/${item.meta.threadId}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[13px] font-medium transition-colors"
          style={{
            background: "var(--color-surface-3)",
            color: "var(--color-neutral-200)",
          }}
        >
          <ExternalLink size={14} /> Open in Inbox
        </a>
        <ActionButton onClick={onResolved} variant="reject">
          <X size={14} /> Dismiss
        </ActionButton>
      </div>
    </div>
  );
}

function TicketPanel({ item, onResolved }: ActionPanelProps) {
  return (
    <div className="space-y-3">
      <p
        className="font-[family-name:var(--font-dm-sans)] text-[13px]"
        style={{ color: "var(--color-neutral-300)" }}
      >
        Open ticket from {String(item.meta.contactName ?? "unknown")}
        {item.meta.subject ? `: ${String(item.meta.subject)}` : ""}.
      </p>
      <div className="flex items-center gap-2">
        <a
          href={`/lite/inbox/${item.meta.threadId}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[13px] font-medium transition-colors"
          style={{
            background: "var(--color-surface-3)",
            color: "var(--color-neutral-200)",
          }}
        >
          <ExternalLink size={14} /> Open Ticket
        </a>
        <ActionButton onClick={onResolved} variant="reject">
          <X size={14} /> Dismiss
        </ActionButton>
      </div>
    </div>
  );
}

function QuotePanel({ item, onResolved }: ActionPanelProps) {
  const totalCents = item.meta.totalCents as number | undefined;
  const formatted = totalCents
    ? `$${(totalCents / 100).toLocaleString("en-AU")}`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        {formatted && (
          <span
            className="font-[family-name:var(--font-dm-sans)] text-[20px] font-medium tabular-nums"
            style={{ color: "var(--color-neutral-100)" }}
          >
            {formatted}
          </span>
        )}
        <span
          className="font-[family-name:var(--font-dm-sans)] text-[13px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {item.type === "expiring_quote" ? item.sublabel : "Draft"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`/lite/quotes/${item.meta.quoteId}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[13px] font-medium transition-colors"
          style={{
            background: "var(--color-semantic-success)",
            color: "var(--color-neutral-950)",
          }}
        >
          <Eye size={14} /> Review & Send
        </a>
        <ActionButton onClick={onResolved} variant="reject">
          <X size={14} /> Dismiss
        </ActionButton>
      </div>
    </div>
  );
}

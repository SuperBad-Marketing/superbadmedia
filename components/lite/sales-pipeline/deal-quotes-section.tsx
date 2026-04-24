"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, Send, Plus, Eye, Trash2 } from "lucide-react";
import {
  createQuoteAction,
  sendQuoteAction,
  deleteQuoteAction,
} from "@/app/lite/admin/pipeline/[id]/actions";
import type { QuoteRow } from "@/lib/db/schema/quotes";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft: {
    bg: "rgba(253, 245, 230, 0.06)",
    color: "var(--color-neutral-300)",
    label: "Draft",
  },
  sent: {
    bg: "rgba(59, 130, 246, 0.12)",
    color: "#93c5fd",
    label: "Sent",
  },
  viewed: {
    bg: "rgba(168, 85, 247, 0.12)",
    color: "#c084fc",
    label: "Viewed",
  },
  accepted: {
    bg: "rgba(123, 174, 126, 0.14)",
    color: "#86efac",
    label: "Accepted",
  },
  expired: {
    bg: "rgba(239, 68, 68, 0.12)",
    color: "#fca5a5",
    label: "Expired",
  },
  withdrawn: {
    bg: "rgba(253, 245, 230, 0.04)",
    color: "var(--color-neutral-500)",
    label: "Withdrawn",
  },
  superseded: {
    bg: "rgba(253, 245, 230, 0.04)",
    color: "var(--color-neutral-500)",
    label: "Superseded",
  },
};

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface DealQuotesSectionProps {
  dealId: string;
  companyId: string;
  quotes: QuoteRow[];
}

export function DealQuotesSection({
  dealId,
  companyId,
  quotes,
}: DealQuotesSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreateQuote() {
    startTransition(async () => {
      setError(null);
      const result = await createQuoteAction(dealId, companyId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section
      className="rounded-[12px] p-6"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight), 0 2px 8px rgba(0,0,0,0.2)",
        border: "1px solid rgba(253,245,230,0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Quotes
        </div>
        <button
          type="button"
          onClick={handleCreateQuote}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "white",
          }}
        >
          <Plus size={14} />
          New Quote
        </button>
      </div>

      {error && (
        <p className="mb-3 text-[12px] text-[color:var(--color-brand-red)]">
          {error}
        </p>
      )}

      {quotes.length === 0 ? (
        <div className="py-6 text-center">
          <FileText
            size={32}
            strokeWidth={1}
            className="mx-auto mb-3"
            style={{ color: "var(--color-neutral-600)" }}
          />
          <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
            No quotes yet for this deal.
          </p>
          <p className="mt-1 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-neutral-500)]">
            Create one to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {quotes.map((q) => (
            <QuoteCard key={q.id} quote={q} dealId={dealId} />
          ))}
        </div>
      )}
    </section>
  );
}

function QuoteCard({ quote, dealId }: { quote: QuoteRow; dealId: string }) {
  const [isPending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = STATUS_STYLES[quote.status] ?? STATUS_STYLES.draft;

  function handleSend() {
    startTransition(async () => {
      setSendError(null);
      const result = await sendQuoteAction(quote.id);
      if (!result.ok) setSendError(result.error);
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      setSendError(null);
      const result = await deleteQuoteAction(quote.id, dealId);
      if (!result.ok) setSendError(result.error);
      setConfirmDelete(false);
    });
  }

  const totalDisplay =
    quote.structure === "retainer"
      ? `${formatMoney(quote.retainer_monthly_cents_inc_gst)}/mo`
      : quote.structure === "mixed"
        ? `${formatMoney(quote.retainer_monthly_cents_inc_gst)}/mo + ${formatMoney(quote.one_off_cents_inc_gst)}`
        : formatMoney(quote.total_cents_inc_gst);

  return (
    <div
      className="rounded-xl p-4 transition-all duration-[180ms]"
      style={{
        backgroundColor: "var(--color-surface-3)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
              {quote.quote_number}
            </span>
            <span
              className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1.2px",
                backgroundColor: status.bg,
                color: status.color,
              }}
            >
              {status.label}
            </span>
            {quote.structure && (
              <span
                className="font-[family-name:var(--font-label)] text-[9px] uppercase"
                style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
              >
                {quote.structure}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-[family-name:var(--font-body)] text-[13px]">
            <span
              className="font-mono"
              style={{ color: "var(--color-brand-cream)" }}
            >
              {totalDisplay}
            </span>
            <span style={{ color: "var(--color-neutral-500)" }}>
              {formatDate(quote.created_at_ms)}
            </span>
            {quote.sent_at_ms && (
              <span style={{ color: "var(--color-neutral-500)" }}>
                Sent {formatDate(quote.sent_at_ms)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={
              quote.status === "draft"
                ? `/lite/admin/deals/${dealId}/quotes/${quote.id}/edit`
                : `/lite/quotes/${quote.token}`
            }
            target={quote.status === "draft" ? undefined : "_blank"}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors border"
            style={{
              borderColor: "var(--color-neutral-600)",
              color: "var(--color-neutral-300)",
            }}
          >
            <Eye size={13} />
            {quote.status === "draft" ? "Edit" : "Preview"}
          </Link>

          {quote.status === "draft" && (
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: "rgba(123, 174, 126, 0.15)",
                color: "#86efac",
                border: "1px solid rgba(123, 174, 126, 0.25)",
              }}
            >
              <Send size={13} />
              {isPending ? "Sending…" : "Send"}
            </button>
          )}

          {quote.status !== "accepted" && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: confirmDelete
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(239, 68, 68, 0.08)",
                color: confirmDelete ? "#fca5a5" : "var(--color-neutral-400)",
                border: `1px solid ${confirmDelete ? "rgba(239, 68, 68, 0.4)" : "rgba(239, 68, 68, 0.15)"}`,
              }}
            >
              <Trash2 size={13} />
              {confirmDelete ? "Confirm" : "Delete"}
            </button>
          )}
        </div>
      </div>

      {sendError && (
        <p className="mt-2 text-[11px] text-[color:var(--color-brand-red)]">
          {sendError}
        </p>
      )}
    </div>
  );
}

import type { QuoteStatus } from "@/lib/db/schema/quotes";

/**
 * §5 status chip for quotes. Mirrors InvoiceStatusBadge / CompanyStatusBadge
 * recipe: Righteous 10px / 1.5px tracking, rgba-tinted, 1×1 currentColor dot.
 *
 * Seven states per `QUOTE_STATUSES`. Palette tuned to the state's emotional
 * temperature: draft=neutral, sent=pink-alive, viewed=orange-active, accepted=
 * success, expired/withdrawn/superseded=neutral with strike on terminal negatives.
 */
const TONE: Record<QuoteStatus, { bg: string; color: string }> = {
  draft: {
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
  },
  sent: {
    bg: "rgba(244, 160, 176, 0.10)",
    color: "var(--color-brand-pink)",
  },
  viewed: {
    bg: "rgba(242, 140, 82, 0.14)",
    color: "var(--color-brand-orange)",
  },
  accepted: {
    bg: "rgba(123, 174, 126, 0.14)",
    color: "var(--color-success)",
  },
  expired: {
    bg: "rgba(128, 127, 115, 0.12)",
    color: "var(--color-neutral-500)",
  },
  withdrawn: {
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
  },
  superseded: {
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
  },
};

const LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  expired: "Expired",
  withdrawn: "Withdrawn",
  superseded: "Superseded",
};

const STRIKE: ReadonlySet<QuoteStatus> = new Set(["withdrawn", "superseded"]);

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const tone = TONE[status];
  const strike = STRIKE.has(status);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: tone.bg,
        color: tone.color,
        textDecoration: strike ? "line-through" : undefined,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {LABEL[status]}
    </span>
  );
}
